import { supabaseServer } from "../../../../lib/supabaseServer";
import { requireEditor } from "../../../../lib/adminAuth";
import { getTransactionalEmailProvider } from "../../../../lib/transactionalEmail";
import { respondWithApiError } from "../../../../lib/apiError";
import { sendReviewerAssignmentEmail } from "../../../../lib/reviewerMail";
import {
  isReviewerWorkflowMetadataMissingError,
  normalizeReviewDueAtInput,
} from "../../../../lib/reviewerWorkflowShared";

const REVIEW_SELECT_FULL =
  "id, manuscript_id, reviewer_id, recommendation, created_at, invited_at, due_at, last_reminder_at, decided_at";
const REVIEW_SELECT_LEGACY =
  "id, manuscript_id, reviewer_id, recommendation, created_at, decided_at";

async function fetchExistingReview(manuscriptId, reviewerId) {
  let workflowMetadataReady = true;

  let query = await supabaseServer
    .from("manuscript_reviews")
    .select(REVIEW_SELECT_FULL)
    .eq("manuscript_id", manuscriptId)
    .eq("reviewer_id", reviewerId)
    .maybeSingle();

  if (query.error && isReviewerWorkflowMetadataMissingError(query.error)) {
    workflowMetadataReady = false;
    query = await supabaseServer
      .from("manuscript_reviews")
      .select(REVIEW_SELECT_LEGACY)
      .eq("manuscript_id", manuscriptId)
      .eq("reviewer_id", reviewerId)
      .maybeSingle();
  }

  return {
    review: query.data || null,
    error: query.error || null,
    workflowMetadataReady,
  };
}

async function createReviewAssignment({ manuscriptId, reviewerId, dueAt }) {
  const invitedAt = new Date().toISOString();
  let workflowMetadataReady = true;

  let insertResult = await supabaseServer
    .from("manuscript_reviews")
    .insert({
      manuscript_id: manuscriptId,
      reviewer_id: reviewerId,
      invited_at: invitedAt,
      due_at: dueAt,
    })
    .select(REVIEW_SELECT_FULL)
    .single();

  if (insertResult.error && isReviewerWorkflowMetadataMissingError(insertResult.error)) {
    workflowMetadataReady = false;
    insertResult = await supabaseServer
      .from("manuscript_reviews")
      .insert({
        manuscript_id: manuscriptId,
        reviewer_id: reviewerId,
      })
      .select(REVIEW_SELECT_LEGACY)
      .single();

    if (insertResult.data) {
      insertResult.data = {
        ...insertResult.data,
        invited_at: invitedAt,
        due_at: dueAt,
        last_reminder_at: null,
      };
    }
  }

  return {
    review: insertResult.data || null,
    error: insertResult.error || null,
    workflowMetadataReady,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const auth = await requireEditor(req, res);
    if (!auth) return;

    const { manuscript_id, reviewer_id, reviewer_email, due_at } = req.body || {};

    if (!manuscript_id) {
      return res.status(400).json({ error: "Missing manuscript_id" });
    }

    const { data: manuscript, error: manuscriptErr } = await supabaseServer
      .from("manuscripts")
      .select("id, title, status")
      .eq("id", manuscript_id)
      .maybeSingle();

    if (manuscriptErr || !manuscript) {
      return res.status(404).json({ error: "Manuscript not found" });
    }

    let reviewerId = reviewer_id;
    let reviewerEmail = reviewer_email || null;

    if (!reviewerId && reviewer_email) {
      const { data: reviewerProfile, error: rErr } = await supabaseServer
        .from("profiles")
        .select("id, role, approved, email")
        .eq("email", reviewer_email)
        .maybeSingle();

      if (rErr || !reviewerProfile) {
        return res.status(404).json({ error: "Reviewer not found" });
      }

      if (reviewerProfile.role !== "reviewer" || reviewerProfile.approved !== true) {
        return res.status(400).json({ error: "Reviewer is not approved" });
      }

      reviewerId = reviewerProfile.id;
      reviewerEmail = reviewerProfile.email;
    }

    if (!reviewerId) {
      return res
        .status(400)
        .json({ error: "Missing reviewer_id or reviewer_email" });
    }

    const dueAt = normalizeReviewDueAtInput(due_at, {
      fallbackToDefault: true,
    });

    if (!reviewerEmail && reviewerId) {
      const { data: reviewerProfile } = await supabaseServer
        .from("profiles")
        .select("email, role, approved")
        .eq("id", reviewerId)
        .maybeSingle();

      if (reviewerProfile?.role && reviewerProfile.role !== "reviewer") {
        return res.status(400).json({ error: "Reviewer is not approved" });
      }

      if (reviewerProfile?.approved === false) {
        return res.status(400).json({ error: "Reviewer is not approved" });
      }

      reviewerEmail = reviewerProfile?.email || null;
    }

    const {
      review: existing,
      error: existingErr,
      workflowMetadataReady: existingWorkflowMetadataReady,
    } = await fetchExistingReview(manuscript_id, reviewerId);

    if (existingErr) {
      throw existingErr;
    }

    if (existing) {
      return res.status(200).json({
        ok: true,
        review: existing,
        alreadyAssigned: true,
        reviewWorkflowMetadataReady: existingWorkflowMetadataReady,
      });
    }

    const {
      review,
      error: reviewErr,
      workflowMetadataReady,
    } = await createReviewAssignment({
      manuscriptId: manuscript_id,
      reviewerId,
      dueAt,
    });

    if (reviewErr) throw reviewErr;

    await supabaseServer
      .from("manuscripts")
      .update({ status: "under_review" })
      .eq("id", manuscript_id)
      .eq("status", "submitted");

    try {
      await supabaseServer.from("notifications").insert([
        {
          user_id: reviewerId,
          manuscript_id,
          title: "New review assigned",
          body: "You have been assigned a new manuscript to review.",
        },
      ]);
    } catch (err) {
      console.warn("notification insert failed:", err);
    }

    if (reviewerEmail) {
      try {
        await sendReviewerAssignmentEmail({
          recipient: reviewerEmail,
          manuscript,
          dueAt,
          req,
        });
      } catch (err) {
        console.warn("reviewer email failed:", err);
      }
    }

    return res.status(200).json({
      ok: true,
      review,
      reviewWorkflowMetadataReady: workflowMetadataReady,
    });
  } catch (err) {
    return respondWithApiError(
      res,
      500,
      "admin-review-assign",
      err,
      "Failed to assign reviewer.",
      {
        manuscriptId: req.body?.manuscript_id || null,
        reviewerEmail: req.body?.reviewer_email || null,
      }
    );
  }
}
