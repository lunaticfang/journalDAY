import { supabaseServer } from "../../../lib/supabaseServer";
import { requireRole } from "../../../lib/adminAuth";
import { respondWithApiError } from "../../../lib/apiError";
import {
  getReviewerWorkflowMigrationHint,
  isReviewerWorkflowMetadataMissingError,
  isReviewerWorkflowMissingTableError,
} from "../../../lib/reviewerWorkflowShared";

const STATUS_ORDER = [
  "submitted",
  "under_review",
  "revisions_requested",
  "accepted",
  "rejected",
  "published",
];

const REVIEW_SELECT_FULL =
  "id, manuscript_id, reviewer_id, recommendation, created_at, invited_at, due_at, last_reminder_at, decided_at";
const REVIEW_SELECT_LEGACY =
  "id, manuscript_id, reviewer_id, recommendation, created_at, decided_at";
const REVIEW_WORKFLOW_DOWN_MESSAGE = `Reviewer workflow is not configured yet. ${getReviewerWorkflowMigrationHint()}`;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const auth = await requireRole(req, res);
    if (!auth) return;

    const role = auth.profile.role;
    let reviewWorkflowMetadataReady = true;
    let reviewWorkflowAvailable = true;
    let reviewWorkflowMessage = "";

    let manuscriptIds = null;
    if (role === "reviewer") {
      const { data: assignments, error: aErr } = await supabaseServer
        .from("manuscript_reviews")
        .select("manuscript_id")
        .eq("reviewer_id", auth.user.id);

      if (aErr) {
        if (isReviewerWorkflowMissingTableError(aErr)) {
          reviewWorkflowAvailable = false;
          reviewWorkflowMetadataReady = false;
          reviewWorkflowMessage = REVIEW_WORKFLOW_DOWN_MESSAGE;
          manuscriptIds = [];
        } else {
          throw aErr;
        }
      } else {
        manuscriptIds = (assignments || [])
          .map((a) => a.manuscript_id)
          .filter(Boolean);
      }

      if (!manuscriptIds.length) {
        const emptyQueue = {};
        STATUS_ORDER.forEach((s) => {
          emptyQueue[s] = [];
        });
        return res.status(200).json({
          ok: true,
          role,
          queue: emptyQueue,
          assignments: {},
          reviewers: [],
          reviewWorkflowAvailable,
          reviewWorkflowMetadataReady,
          reviewWorkflowMigrationRequired:
            !reviewWorkflowAvailable || !reviewWorkflowMetadataReady,
          reviewWorkflowMessage,
        });
      }
    }

    let query = supabaseServer
      .from("manuscripts")
      .select(
        "id, title, status, created_at, authors, submitter_id, author_id"
      )
      .order("created_at", { ascending: false });

    if (manuscriptIds) {
      query = query.in("id", manuscriptIds);
    }

    const { data: manuscripts, error: mErr } = await query;
    if (mErr) throw mErr;

    const ids = (manuscripts || []).map((m) => m.id).filter(Boolean);
    let assignments = {};
    let reviewers = [];
    let reviewRows = [];

    if (ids.length > 0 && reviewWorkflowAvailable) {
      let reviewQuery = await supabaseServer
        .from("manuscript_reviews")
        .select(REVIEW_SELECT_FULL)
        .in("manuscript_id", ids);

      if (reviewQuery.error && isReviewerWorkflowMissingTableError(reviewQuery.error)) {
        reviewWorkflowAvailable = false;
        reviewWorkflowMetadataReady = false;
        reviewWorkflowMessage = REVIEW_WORKFLOW_DOWN_MESSAGE;
      }

      if (
        reviewQuery.error &&
        isReviewerWorkflowMetadataMissingError(reviewQuery.error)
      ) {
        reviewWorkflowMetadataReady = false;
        reviewQuery = await supabaseServer
          .from("manuscript_reviews")
          .select(REVIEW_SELECT_LEGACY)
          .in("manuscript_id", ids);
      }

      const { data: reviews, error: rErr } = reviewQuery;

      if (rErr) {
        if (isReviewerWorkflowMissingTableError(rErr)) {
          reviewWorkflowAvailable = false;
          reviewWorkflowMetadataReady = false;
          reviewWorkflowMessage = REVIEW_WORKFLOW_DOWN_MESSAGE;
        } else {
          throw rErr;
        }
      } else {
        reviewRows = reviews || [];
      }

      const reviewerIds = new Set();
      reviewRows.forEach((r) => {
        reviewerIds.add(r.reviewer_id);
        if (!assignments[r.manuscript_id]) {
          assignments[r.manuscript_id] = [];
        }
        assignments[r.manuscript_id].push(r);
      });

      if (role !== "reviewer") {
        const { data: reviewerProfiles } = await supabaseServer
          .from("profiles")
          .select("id, email, role, approved")
          .eq("approved", true)
          .in("role", ["reviewer"]);

        reviewers = (reviewerProfiles || []).map((p) => ({
          id: p.id,
          email: p.email,
        }));
      }
    }

    const queue = {};
    STATUS_ORDER.forEach((s) => {
      queue[s] = [];
    });

    (manuscripts || []).forEach((m) => {
      const key = STATUS_ORDER.includes(m.status) ? m.status : "submitted";
      if (!queue[key]) queue[key] = [];
      queue[key].push(m);
    });

    return res.status(200).json({
      ok: true,
      role,
      queue,
      assignments,
      reviewers,
      reviewWorkflowAvailable,
      reviewWorkflowMetadataReady,
      reviewWorkflowMigrationRequired:
        !reviewWorkflowAvailable || !reviewWorkflowMetadataReady,
      reviewWorkflowMessage,
    });
  } catch (err) {
    return respondWithApiError(
      res,
      500,
      "admin-queue",
      err,
      "Failed to load the editorial queue."
    );
  }
}
