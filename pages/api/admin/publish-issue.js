// pages/api/admin/publish-issue.js
import { supabaseServer } from "../../../lib/supabaseServer";

/**
 * Publish issue API
 *
 * Behavior:
 * - Creates a new row in `issues`.
 * - Creates article rows in `articles` for each selected manuscript.
 *   Each article stores `manuscript_id` so the frontend can call
 *   `/api/submissions/:manuscriptId/signed-url` to get the PDF.
 * - Does NOT try to guess or store per-article pdf_path.
 */

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
      pdf_path,       // optional full-issue PDF URL/path
      manuscript_ids, // array of manuscript IDs to include as articles
    } = req.body || {};

    if (!title || !Array.isArray(manuscript_ids) || manuscript_ids.length === 0) {
      return res
        .status(400)
        .json({ error: "Title and at least one manuscript are required" });
    }

    // 1) Create issue (full issue PDF goes here, if provided)
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
      .select("*")
      .single();

    if (issueErr) throw issueErr;
    const issueId = issue.id;

    // 2) Load selected manuscripts – id, title, authors
    const { data: manuscripts, error: mErr } = await supabaseServer
      .from("manuscripts")
      .select("id, title, authors")
      .in("id", manuscript_ids);

    if (mErr) throw mErr;

    // 3) Build article rows linked to manuscripts
    const articleRows = (manuscripts || []).map((m, index) => ({
      issue_id: issueId,
      manuscript_id: m.id,                        // 🔗 key link to manuscript
      title: m.title || `Untitled article ${index + 1}`,
      abstract: null,
      authors: m.authors ?? null,                 // uses new column
      pdf_path: null,                             // we always use signed-url
    }));

    let articles = [];
    if (articleRows.length > 0) {
      const { data: insertedArticles, error: artErr } = await supabaseServer
        .from("articles")
        .insert(articleRows)
        .select("*");

      if (artErr) throw artErr;
      articles = insertedArticles;
    }

    // 4) Mark manuscripts as published (best-effort)
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
