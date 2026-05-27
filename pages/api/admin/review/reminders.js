import { supabaseServer } from "../../../../lib/supabaseServer";
import { requireEditor } from "../../../../lib/adminAuth";
import { respondWithApiError } from "../../../../lib/apiError";
import { getTransactionalEmailProvider } from "../../../../lib/transactionalEmail";
import { sendReviewerReminderEmail } from "../../../../lib/reviewerMail";
import {
  getReviewerWorkflowMigrationHint,
  REVIEW_REMINDER_COOLDOWN_HOURS,
  REVIEW_REMINDER_LEAD_DAYS,
  isPendingReview,
  isReviewerWorkflowMetadataMissingError,
  isReviewerWorkflowMissingTableError,
} from "../../../../lib/reviewerWorkflowShared";

const CRON_SECRET = process.env.CRON_SECRET || process.env.KEEPALIVE_SECRET || "";
const ALLOW_QUERY_CRON_SECRET =
  String(process.env.ALLOW_QUERY_CRON_SECRET || "true").toLowerCase() !== "false";
const REVIEW_SELECT =
  "id, manuscript_id, reviewer_id, recommendation, created_at, invited_at, due_at, last_reminder_at, decided_at";
const REVIEW_WORKFLOW_DOWN_MESSAGE = `Reviewer workflow is not configured yet. ${getReviewerWorkflowMigrationHint()}`;

function hasValidCronSecret(req) {
  if (!CRON_SECRET) return false;

  const headerSecret = String(req.headers["x-cron-secret"] || "").trim();
  const querySecret = String(req.query?.secret || "").trim();

  if (headerSecret === CRON_SECRET) {
    return true;
  }

  // Backward-compatible fallback for existing cron setups that still pass
  // secrets in the query string. Prefer x-cron-secret header in production.
  return ALLOW_QUERY_CRON_SECRET && querySecret === CRON_SECRET;
}

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method || "")) {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const hasCronAccess = hasValidCronSecret(req);

    if (!hasCronAccess) {
      const auth = await requireEditor(req, res);
      if (!auth) return;
    }

    if (!getTransactionalEmailProvider()) {
      return res.status(409).json({
        error:
          "Reviewer reminder email is not configured yet. Add BREVO_API_KEY or RESEND_API_KEY first.",
      });
    }

    const { data: reviewRows, error: reviewErr } = await supabaseServer
      .from("manuscript_reviews")
      .select(REVIEW_SELECT)
      .is("decided_at", null)
      .order("due_at", { ascending: true });

    if (reviewErr) {
      if (isReviewerWorkflowMissingTableError(reviewErr)) {
        return res.status(409).json({
          error: REVIEW_WORKFLOW_DOWN_MESSAGE,
          migrationRequired: true,
        });
      }

      if (isReviewerWorkflowMetadataMissingError(reviewErr)) {
        return res.status(409).json({
          error:
            "Reviewer reminder tracking is not ready yet. Run db/reviewer_mail_phase1.sql in Supabase first.",
          migrationRequired: true,
        });
      }

      throw reviewErr;
    }

    const reviews = (reviewRows || []).filter((review) => isPendingReview(review));
    const reviewerIds = Array.from(
      new Set(reviews.map((review) => review.reviewer_id).filter(Boolean))
    );
    const manuscriptIds = Array.from(
      new Set(reviews.map((review) => review.manuscript_id).filter(Boolean))
    );

    const [{ data: reviewerRows, error: reviewerErr }, { data: manuscriptRows, error: manuscriptErr }] =
      await Promise.all([
        reviewerIds.length
          ? supabaseServer
              .from("profiles")
              .select("id, email")
              .in("id", reviewerIds)
          : Promise.resolve({ data: [], error: null }),
        manuscriptIds.length
          ? supabaseServer
              .from("manuscripts")
              .select("id, title")
              .in("id", manuscriptIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

    if (reviewerErr) throw reviewerErr;
    if (manuscriptErr) throw manuscriptErr;

    const reviewerLookup = new Map(
      (reviewerRows || []).map((reviewer) => [reviewer.id, reviewer])
    );
    const manuscriptLookup = new Map(
      (manuscriptRows || []).map((manuscript) => [manuscript.id, manuscript])
    );

    const now = Date.now();
    const leadWindowMs = REVIEW_REMINDER_LEAD_DAYS * 24 * 60 * 60 * 1000;
    const cooldownMs = REVIEW_REMINDER_COOLDOWN_HOURS * 60 * 60 * 1000;

    const eligibleReviews = reviews.filter((review) => {
      if (!review.due_at) return false;

      const dueMs = new Date(review.due_at).getTime();
      if (Number.isNaN(dueMs)) return false;

      const reminderMs = review.last_reminder_at
        ? new Date(review.last_reminder_at).getTime()
        : null;

      if (reminderMs && !Number.isNaN(reminderMs) && now - reminderMs < cooldownMs) {
        return false;
      }

      return dueMs - now <= leadWindowMs;
    });

    let sent = 0;
    let skipped = 0;
    const issues = [];

    for (const review of eligibleReviews) {
      const reviewer = reviewerLookup.get(review.reviewer_id);
      const manuscript = manuscriptLookup.get(review.manuscript_id);
      const email = String(reviewer?.email || "").trim();

      if (!email || !manuscript) {
        skipped += 1;
        issues.push({
          reviewId: review.id,
          manuscriptId: review.manuscript_id,
          reason: !email ? "missing reviewer email" : "missing manuscript",
        });
        continue;
      }

      try {
        await sendReviewerReminderEmail({
          recipient: email,
          manuscript,
          dueAt: review.due_at,
          req,
        });

        const { error: updateErr } = await supabaseServer
          .from("manuscript_reviews")
          .update({ last_reminder_at: new Date().toISOString() })
          .eq("id", review.id);

        if (updateErr) {
          throw updateErr;
        }

        sent += 1;
      } catch (err) {
        skipped += 1;
        issues.push({
          reviewId: review.id,
          manuscriptId: review.manuscript_id,
          reason: err?.message || String(err),
        });
      }
    }

    return res.status(200).json({
      ok: true,
      checked: reviews.length,
      eligible: eligibleReviews.length,
      sent,
      skipped,
      issues,
      cronReady: Boolean(CRON_SECRET),
    });
  } catch (err) {
    return respondWithApiError(
      res,
      500,
      "admin-review-reminders",
      err,
      "Failed to send reviewer reminders."
    );
  }
}
