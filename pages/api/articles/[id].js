







// pages/api/articles/[id].js
import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const raw = req.query.id;
    const articleId =
      typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;

    if (!articleId) {
      return res.status(400).json({ error: "Invalid article id" });
    }

    const { data: article, error: artErr } = await supabaseServer
      .from("articles")
      .select("id, title, abstract, authors, pdf_path, issue_id, created_at")
      .eq("id", articleId)
      .maybeSingle();

    if (artErr) throw artErr;
    if (!article) {
      return res.status(404).json({ error: "Article not found" });
    }

    const { data: issue, error: issueErr } = await supabaseServer
      .from("issues")
      .select("id, title, volume, issue_number, published_at")
      .eq("id", article.issue_id)
      .maybeSingle();

    if (issueErr) throw issueErr;

    return res.status(200).json({ ok: true, article, issue });
  } catch (err) {
    console.error("article API error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}







