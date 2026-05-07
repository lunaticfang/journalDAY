import { supabaseServer } from "../../../../lib/supabaseServer";
import { requireRole } from "../../../../lib/adminAuth";
import { respondWithApiError } from "../../../../lib/apiError";
import { isReviewerWorkflowMetadataMissingError } from "../../../../lib/reviewerWorkflowShared";

const REVIEW_SELECT_FULL =
  "id, manuscript_id, reviewer_id, recommendation, notes, created_at, invited_at, due_at, last_reminder_at, decided_at";
const REVIEW_SELECT_LEGACY =
  "id, manuscript_id, reviewer_id, recommendation, notes, created_at, decided_at";

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
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const auth = await requireRole(req, res, ["admin", "editor", "reviewer"]);
    if (!auth) return;

    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: "Missing id" });
    }

    const { data: manuscript, error: mErr } = await supabaseServer
      .from("manuscripts")
      .select(
        "id, title, abstract, status, created_at, authors, submitter_id, author_id, current_version, word_path"
      )
      .eq("id", id)
      .maybeSingle();

    if (mErr || !manuscript) {
      return res.status(404).json({ error: "Manuscript not found" });
    }

    if (auth.profile.role === "reviewer") {
      const { data: assignment, error: aErr } = await supabaseServer
        .from("manuscript_reviews")
        .select("id")
        .eq("manuscript_id", id)
        .eq("reviewer_id", auth.user.id)
        .maybeSingle();

      if (aErr || !assignment) {
        return res.status(403).json({ error: "Not assigned to this manuscript" });
      }
    }

    let reviewWorkflowMetadataReady = true;
    let reviewQuery = await supabaseServer
      .from("manuscript_reviews")
      .select(REVIEW_SELECT_FULL)
      .eq("manuscript_id", id);

    if (
      reviewQuery.error &&
      isReviewerWorkflowMetadataMissingError(reviewQuery.error)
    ) {
      reviewWorkflowMetadataReady = false;
      reviewQuery = await supabaseServer
        .from("manuscript_reviews")
        .select(REVIEW_SELECT_LEGACY)
        .eq("manuscript_id", id);
    }

    const { data: reviews, error: reviewErr } = reviewQuery;

    if (reviewErr) {
      throw reviewErr;
    }

    const reviewerIds = (reviews || [])
      .map((r) => r.reviewer_id)
      .filter(Boolean);

    let reviewerProfiles = [];
    if (reviewerIds.length) {
      const { data: profiles } = await supabaseServer
        .from("profiles")
        .select("id, email, role")
        .in("id", reviewerIds);

      reviewerProfiles = profiles || [];
    }

    const authors = parseAuthors(manuscript.authors);

    return res.status(200).json({
      ok: true,
      manuscript,
      authors,
      reviews: reviews || [],
      reviewers: reviewerProfiles,
      role: auth.profile.role,
      reviewWorkflowMetadataReady,
    });
  } catch (err) {
    return respondWithApiError(
      res,
      500,
      "admin-submission-detail",
      err,
      "Failed to load the submission."
    );
  }
}
