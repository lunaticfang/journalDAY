import { supabaseServer } from "../../../../lib/supabaseServer";
import { requireRole } from "../../../../lib/adminAuth";

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
        "id, title, abstract, status, created_at, authors, submitter_id, author_id, file_storage_path, word_path"
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

    const { data: reviews } = await supabaseServer
      .from("manuscript_reviews")
      .select(
        "id, manuscript_id, reviewer_id, recommendation, notes, created_at, decided_at"
      )
      .eq("manuscript_id", id);

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
    });
  } catch (err) {
    console.error("admin submission detail error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
