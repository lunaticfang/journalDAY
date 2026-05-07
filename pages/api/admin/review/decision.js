import { supabaseServer } from "../../../../lib/supabaseServer";
import { requireReviewer } from "../../../../lib/adminAuth";
import { getTransactionalEmailProvider } from "../../../../lib/transactionalEmail";
import {
  sendAuthorReviewFeedbackEmail,
  sendEditorReviewSubmittedEmail,
} from "../../../../lib/reviewerMail";
import { respondWithApiError } from "../../../../lib/apiError";

const RECOMMENDATIONS = [
  "accept",
  "minor_revisions",
  "major_revisions",
  "reject",
];

function parseAuthors(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const auth = await requireReviewer(req, res);
    if (!auth) return;

    const { manuscript_id, recommendation, notes } = req.body || {};

    if (!manuscript_id) {
      return res.status(400).json({ error: "Missing manuscript_id" });
    }

    if (!RECOMMENDATIONS.includes(recommendation)) {
      return res.status(400).json({ error: "Invalid recommendation" });
    }

    const { data: review, error: reviewErr } = await supabaseServer
      .from("manuscript_reviews")
      .select("id, manuscript_id, reviewer_id")
      .eq("manuscript_id", manuscript_id)
      .eq("reviewer_id", auth.user.id)
      .maybeSingle();

    if (reviewErr || !review) {
      return res.status(403).json({ error: "Not assigned to this manuscript" });
    }

    const { data: updated, error: updateErr } = await supabaseServer
      .from("manuscript_reviews")
      .update({
        recommendation,
        notes: notes ?? null,
        decided_at: new Date().toISOString(),
      })
      .eq("id", review.id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    const { data: manuscript } = await supabaseServer
      .from("manuscripts")
      .select("id, title, authors, author_id, submitter_id")
      .eq("id", manuscript_id)
      .maybeSingle();

    const { data: editors } = await supabaseServer
      .from("profiles")
      .select("id, email")
      .eq("approved", true)
      .in("role", ["owner", "admin", "editor"]);

    const editorIds = (editors || []).map((e) => e.id).filter(Boolean);
    const editorEmails = Array.from(
      new Set(
        (editors || [])
          .map((editor) => String(editor.email || "").trim())
          .filter(Boolean)
      )
    );

    if (editorIds.length) {
      try {
        const rows = editorIds.map((user_id) => ({
          user_id,
          manuscript_id,
          title: "Review submitted",
          body: `A reviewer submitted a recommendation: ${recommendation}.`,
        }));
        await supabaseServer.from("notifications").insert(rows);
      } catch (err) {
        console.warn("notification insert failed:", err);
      }
    }

    const authorProfileIds = Array.from(
      new Set(
        [manuscript?.author_id, manuscript?.submitter_id]
          .filter(Boolean)
          .map((id) => String(id))
      )
    );
    const parsedAuthors = parseAuthors(manuscript?.authors);
    const authorEmails = new Set(
      parsedAuthors
        .map((author) => String(author?.email || "").trim())
        .filter(Boolean)
    );

    if (authorProfileIds.length) {
      const { data: authorProfiles } = await supabaseServer
        .from("profiles")
        .select("id, email")
        .in("id", authorProfileIds);

      (authorProfiles || []).forEach((profile) => {
        if (profile?.email) {
          authorEmails.add(String(profile.email).trim());
        }
      });
    }

    const notesSummary = String(notes || "").trim();

    if (authorProfileIds.length) {
      try {
        const rows = authorProfileIds.map((user_id) => ({
          user_id,
          manuscript_id,
          title: "Reviewer feedback received",
          body: notesSummary
            ? `Recommendation: ${recommendation}. Reviewer notes: ${
                notesSummary.length > 500
                  ? `${notesSummary.slice(0, 500)}...`
                  : notesSummary
              }`
            : `Recommendation: ${recommendation}. Reviewer notes are available in the editorial feedback.`,
        }));
        await supabaseServer.from("notifications").insert(rows);
      } catch (err) {
        console.warn("author feedback notification insert failed:", err);
      }
    }

    if (getTransactionalEmailProvider() && editorEmails.length) {
      try {
        await sendEditorReviewSubmittedEmail({
          recipients: editorEmails,
          manuscript: manuscript || { id: manuscript_id, title: null },
          reviewerEmail: auth.user.email || null,
          recommendation,
          req,
        });
      } catch (err) {
        console.warn("review submitted editor email failed:", err);
      }
    }

    if (getTransactionalEmailProvider() && authorEmails.size) {
      try {
        await sendAuthorReviewFeedbackEmail({
          recipients: Array.from(authorEmails),
          manuscript: manuscript || { id: manuscript_id, title: null },
          recommendation,
          notes: notes ?? null,
          req,
        });
      } catch (err) {
        console.warn("author feedback email failed:", err);
      }
    }

    return res.status(200).json({ ok: true, review: updated });
  } catch (err) {
    return respondWithApiError(
      res,
      500,
      "admin-review-decision",
      err,
      "Failed to record the review."
    );
  }
}
