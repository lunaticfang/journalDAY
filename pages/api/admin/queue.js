import { supabaseServer } from "../../../lib/supabaseServer";
import { requireRole } from "../../../lib/adminAuth";

const STATUS_ORDER = [
  "submitted",
  "under_review",
  "revisions_requested",
  "accepted",
  "rejected",
  "published",
];

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const auth = await requireRole(req, res);
    if (!auth) return;

    const role = auth.profile.role;

    let manuscriptIds = null;
    if (role === "reviewer") {
      const { data: assignments, error: aErr } = await supabaseServer
        .from("manuscript_reviews")
        .select("manuscript_id")
        .eq("reviewer_id", auth.user.id);

      if (aErr) throw aErr;
      manuscriptIds = (assignments || [])
        .map((a) => a.manuscript_id)
        .filter(Boolean);

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

    if (ids.length > 0) {
      const { data: reviews, error: rErr } = await supabaseServer
        .from("manuscript_reviews")
        .select("id, manuscript_id, reviewer_id, recommendation, created_at")
        .in("manuscript_id", ids);

      if (rErr) throw rErr;

      const reviewerIds = new Set();
      (reviews || []).forEach((r) => {
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
    });
  } catch (err) {
    console.error("admin queue error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
