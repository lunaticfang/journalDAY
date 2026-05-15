import { supabaseServer } from "../../../../../lib/supabaseServer";
import { requireEditor } from "../../../../../lib/adminAuth";

function resolveParam(raw) {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && raw.length > 0) return raw[0];
  return null;
}

export default async function handler(req, res) {
  if (!["DELETE", "PATCH"].includes(req.method || "")) {
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

    if (req.method === "PATCH") {
      const rawAuthors = req.body?.authors;
      let nextAuthors = null;

      if (typeof rawAuthors === "string") {
        const trimmed = rawAuthors.trim();
        nextAuthors = trimmed ? trimmed : null;
      } else if (Array.isArray(rawAuthors)) {
        const cleaned = rawAuthors
          .map((entry) => {
            if (typeof entry === "string") {
              const name = entry.trim();
              return name ? { name } : null;
            }

            if (entry && typeof entry === "object") {
              const name = String(entry.name || "").trim();
              const email = String(entry.email || "").trim();
              const role = String(entry.role || "").trim();

              if (!name && !email) return null;

              return {
                ...(name ? { name } : {}),
                ...(email ? { email } : {}),
                ...(role ? { role } : {}),
              };
            }

            return null;
          })
          .filter(Boolean);

        nextAuthors = cleaned.length ? JSON.stringify(cleaned) : null;
      } else if (rawAuthors == null) {
        nextAuthors = null;
      } else {
        return res.status(400).json({ error: "Invalid authors payload" });
      }

      const { data: updated, error: updateErr } = await supabaseServer
        .from("articles")
        .update({ authors: nextAuthors })
        .eq("id", articleId)
        .eq("issue_id", issueId)
        .select("id, title, authors, manuscript_id, issue_id")
        .maybeSingle();

      if (updateErr) throw updateErr;

      return res.status(200).json({
        ok: true,
        article: updated,
      });
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
