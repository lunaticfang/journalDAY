import { supabaseServer } from "../../../../../lib/supabaseServer";
import { requireEditor } from "../../../../../lib/adminAuth";

function resolveParam(raw) {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && raw.length > 0) return raw[0];
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const auth = await requireEditor(req, res);
    if (!auth) return;

    const issueId = resolveParam(req.query.id);
    const articleId = resolveParam(req.query.articleId);

    if (!issueId || !articleId) {
      return res.status(400).json({ error: "Invalid issue or article id" });
    }

    const { data: article, error: articleErr } = await supabaseServer
      .from("articles")
      .select("id, title, authors, manuscript_id, issue_id")
      .eq("id", articleId)
      .eq("issue_id", issueId)
      .maybeSingle();

    if (articleErr) throw articleErr;
    if (!article) {
      return res.status(404).json({ error: "Article not found for this issue" });
    }

    const { error: deleteErr } = await supabaseServer
      .from("articles")
      .delete()
      .eq("id", articleId)
      .eq("issue_id", issueId);

    if (deleteErr) throw deleteErr;

    return res.status(200).json({
      ok: true,
      article,
    });
  } catch (err) {
    console.error("remove issue article error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
