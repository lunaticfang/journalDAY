// pages/api/admin/publish-issue.js
import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      title,
      volume,
      issue_number,
      published_at,
      cover_url,
      pdf_path,
      manuscript_ids,
    } = req.body;

    if (!title || !Array.isArray(manuscript_ids) || manuscript_ids.length === 0) {
      return res
        .status(400)
        .json({ error: "Title and at least one manuscript are required" });
    }

    // TODO: add real auth check for editor role (using profiles table).

    // 1) Create the issue
    const { data: issue, error: issueErr } = await supabaseServer
      .from("issues")
      .insert({
        title,
        volume: volume || null,
        issue_number: issue_number ?? null,
        published_at: published_at || new Date().toISOString(),
        cover_url: cover_url || null,
        pdf_path: pdf_path || null,
      })
      .select()
      .single();

    if (issueErr) throw issueErr;

    const issueId = issue.id;

    // 2) Load the manuscripts we are including (to copy titles, etc.)
    const { data: manuscripts, error: mErr } = await supabaseServer
      .from("manuscripts")
      .select("id, title")
      .in("id", manuscript_ids);

    if (mErr) throw mErr;

    // 3) Build article rows
    const articleRows = (manuscripts || []).map((m) => ({
      issue_id: issueId,
      title: m.title || "Untitled article",
      abstract: null,
      authors: null,
      pdf_path: pdf_path || null, // for now, use full-issue PDF; you can later make per-article PDFs
    }));

    let articles = [];
    if (articleRows.length > 0) {
      const { data: insertedArticles, error: artErr } = await supabaseServer
        .from("articles")
        .insert(articleRows)
        .select();

      if (artErr) throw artErr;
      articles = insertedArticles;
    }

    // 4) Mark manuscripts as published
    await supabaseServer
      .from("manuscripts")
      .update({ status: "published" })
      .in("id", manuscript_ids);

    return res.status(200).json({
      ok: true,
      issue,
      articles,
    });
  } catch (err) {
    console.error("publish-issue error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
