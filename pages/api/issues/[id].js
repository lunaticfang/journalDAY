// pages/api/issues/[id].js
import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // In Next.js API routes, id can be string | string[]
    const raw = req.query.id;
    const issueId =
      typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;

    // Only treat completely missing id as invalid
    if (!issueId) {
      return res.status(400).json({ error: "Invalid issue id" });
    }

    // 1) Load issue
    const { data: issue, error: issueErr } = await supabaseServer
      .from("issues")
      .select(
        "id, title, volume, issue_number, published_at, cover_url, pdf_path"
      )
      .eq("id", issueId)
      .maybeSingle();

    if (issueErr) throw issueErr;

    if (!issue) {
      return res.status(404).json({ error: "Issue not found" });
    }

    // 2) Load articles for that issue
    const { data: articles, error: artErr } = await supabaseServer
      .from("articles")
      .select("id, title, abstract, authors, pdf_path")
      .eq("issue_id", issueId)
      .order("created_at", { ascending: true });

    if (artErr) throw artErr;

    return res.status(200).json({
      ok: true,
      issue,
      articles: articles || [],
    });
  } catch (err) {
    console.error("issue API error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
