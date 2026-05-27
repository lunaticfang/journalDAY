// pages/api/issues/latest.js
import { supabaseServer } from "../../../lib/supabaseServer";
import { respondWithApiError } from "../../../lib/apiError";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { data: issues, error: issueErr } = await supabaseServer
      .from("issues")
      .select(
        "id, title, volume, issue_number, published_at, cover_url, pdf_path"
      )
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1);

    if (issueErr) throw issueErr;

    const issue = issues && issues.length ? issues[0] : null;

    let articles = [];
    if (issue?.id) {
      const { data: articleRows, error: artErr } = await supabaseServer
        .from("articles")
        .select("id, title, authors, manuscript_id")
        .eq("issue_id", issue.id)
        .order("created_at", { ascending: true });

      if (artErr) throw artErr;
      articles = articleRows || [];
    }

    return res.status(200).json({ ok: true, issue, articles });
  } catch (err) {
    return respondWithApiError(
      res,
      500,
      "issue-latest",
      err,
      "Failed to load the latest issue."
    );
  }
}
