import { supabaseServer } from "../../../../lib/supabaseServer";
import { requireEditor } from "../../../../lib/adminAuth";

function resolveIssueId(raw) {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && raw.length > 0) return raw[0];
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const auth = await requireEditor(req, res);
    if (!auth) return;

    const issueId = resolveIssueId(req.query.id);
    if (!issueId) {
      return res.status(400).json({ error: "Invalid issue id" });
    }

    const { manuscript_id, article_id } = req.body || {};

    if (!manuscript_id && !article_id) {
      return res
        .status(400)
        .json({ error: "Provide a manuscript_id or article_id to attach" });
    }

    const { data: issue, error: issueErr } = await supabaseServer
      .from("issues")
      .select("id")
      .eq("id", issueId)
      .maybeSingle();

    if (issueErr) throw issueErr;
    if (!issue) {
      return res.status(404).json({ error: "Issue not found" });
    }

    if (manuscript_id) {
      const { data: existingArticle, error: existingErr } = await supabaseServer
        .from("articles")
        .select("id, title, authors, manuscript_id, issue_id, created_at")
        .eq("issue_id", issueId)
        .eq("manuscript_id", manuscript_id)
        .maybeSingle();

      if (existingErr) throw existingErr;
      if (existingArticle) {
        return res.status(200).json({
          ok: true,
          created: false,
          article: existingArticle,
        });
      }

      const { data: manuscript, error: manuscriptErr } = await supabaseServer
        .from("manuscripts")
        .select("id, title, authors")
        .eq("id", manuscript_id)
        .maybeSingle();

      if (manuscriptErr) throw manuscriptErr;
      if (!manuscript) {
        return res.status(404).json({ error: "Manuscript not found" });
      }

      const { data: article, error: insertErr } = await supabaseServer
        .from("articles")
        .insert({
          issue_id: issueId,
          manuscript_id: manuscript.id,
          title: manuscript.title || "Untitled article",
          authors: manuscript.authors ?? null,
          abstract: null,
          pdf_path: null,
        })
        .select("id, title, authors, manuscript_id, issue_id, created_at")
        .single();

      if (insertErr) throw insertErr;

      await supabaseServer
        .from("manuscripts")
        .update({ status: "published" })
        .eq("id", manuscript.id);

      return res.status(200).json({
        ok: true,
        created: true,
        article,
      });
    }

    const { data: sourceArticle, error: sourceArticleErr } = await supabaseServer
      .from("articles")
      .select(
        "id, title, abstract, authors, pdf_path, manuscript_id, issue_id, created_at"
      )
      .eq("id", article_id)
      .maybeSingle();

    if (sourceArticleErr) throw sourceArticleErr;
    if (!sourceArticle) {
      return res.status(404).json({ error: "Source article not found" });
    }

    if (sourceArticle.issue_id === issueId) {
      return res.status(200).json({
        ok: true,
        created: false,
        article: sourceArticle,
      });
    }

    if (sourceArticle.manuscript_id) {
      const { data: existingArticle, error: existingErr } = await supabaseServer
        .from("articles")
        .select("id, title, authors, manuscript_id, issue_id, created_at")
        .eq("issue_id", issueId)
        .eq("manuscript_id", sourceArticle.manuscript_id)
        .maybeSingle();

      if (existingErr) throw existingErr;
      if (existingArticle) {
        return res.status(200).json({
          ok: true,
          created: false,
          article: existingArticle,
        });
      }
    }

    const { data: clonedArticle, error: cloneErr } = await supabaseServer
      .from("articles")
      .insert({
        issue_id: issueId,
        manuscript_id: sourceArticle.manuscript_id ?? null,
        title: sourceArticle.title || "Untitled article",
        abstract: sourceArticle.abstract ?? null,
        authors: sourceArticle.authors ?? null,
        pdf_path: sourceArticle.pdf_path ?? null,
      })
      .select("id, title, authors, manuscript_id, issue_id, created_at")
      .single();

    if (cloneErr) throw cloneErr;

    if (sourceArticle.manuscript_id) {
      await supabaseServer
        .from("manuscripts")
        .update({ status: "published" })
        .eq("id", sourceArticle.manuscript_id);
    }

    return res.status(200).json({
      ok: true,
      created: true,
      article: clonedArticle,
    });
  } catch (err) {
    console.error("attach article to issue error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
