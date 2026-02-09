import { supabaseServer } from "../../../../lib/supabaseServer";
import { requireReviewer } from "../../../../lib/adminAuth";

const RECOMMENDATIONS = [
  "accept",
  "minor_revisions",
  "major_revisions",
  "reject",
];

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

    const { data: editors } = await supabaseServer
      .from("profiles")
      .select("id")
      .eq("approved", true)
      .in("role", ["admin", "editor"]);

    const editorIds = (editors || []).map((e) => e.id).filter(Boolean);

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

    return res.status(200).json({ ok: true, review: updated });
  } catch (err) {
    console.error("review decision error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
