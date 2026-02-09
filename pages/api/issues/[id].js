// pages/api/issues/[id].js
import { supabaseServer } from "../../../lib/supabaseServer";
import { isOwner } from "../../../lib/isOwner";

export default async function handler(req, res) {
  try {
    // In Next.js API routes, id can be string | string[]
    const raw = req.query.id;
    const issueId =
      typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;

    // Only treat completely missing id as invalid
    if (!issueId) {
      return res.status(400).json({ error: "Invalid issue id" });
    }

    // ------------------------------------------------------------
    // POST: Update issue cover_url (owner or approved editor/admin)
    // ------------------------------------------------------------
    if (req.method === "POST") {
      const authHeader = req.headers.authorization || "";
      const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice("Bearer ".length)
        : null;

      if (!token) {
        return res.status(401).json({ error: "Missing auth token" });
      }

      const { data: userData, error: userErr } =
        await supabaseServer.auth.getUser(token);

      if (userErr || !userData?.user) {
        return res.status(401).json({ error: "Invalid auth token" });
      }

      const user = userData.user;

      let allowed = isOwner(user);
      if (!allowed) {
        const { data: profile, error: profErr } = await supabaseServer
          .from("profiles")
          .select("role, approved")
          .eq("id", user.id)
          .maybeSingle();

        const staffRoles = ["admin", "editor"];
        allowed =
          !profErr &&
          !!profile &&
          profile.approved === true &&
          staffRoles.includes(profile.role);
      }

      if (!allowed) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const { cover_url } = req.body || {};
      const nextCoverUrl =
        cover_url === null || cover_url === undefined
          ? null
          : typeof cover_url === "string"
          ? cover_url
          : null;

      if (cover_url !== null && cover_url !== undefined && nextCoverUrl === null) {
        return res.status(400).json({ error: "Invalid cover_url" });
      }

      const { error: updateErr } = await supabaseServer
        .from("issues")
        .update({ cover_url: nextCoverUrl })
        .eq("id", issueId);

      if (updateErr) throw updateErr;

      return res.status(200).json({ ok: true, cover_url: nextCoverUrl });
    }

    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
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
