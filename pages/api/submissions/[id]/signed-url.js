// pages/api/submissions/[id]/signed-url.js
import { supabaseServer } from "../../../../lib/supabaseServer";
import { requireRole } from "../../../../lib/adminAuth";

const BUCKET = process.env.SUPABASE_BUCKET_MANUSCRIPTS || "manuscripts";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { id } = req.query;
    const type = req.query.type;
    if (!id) {
      return res.status(400).json({ error: "Missing id" });
    }

    let storagePath = null;

    if (type === "word") {
      const auth = await requireRole(req, res, ["admin", "editor", "reviewer"]);
      if (!auth) return;

      const { data: manuscript, error: mErr } = await supabaseServer
        .from("manuscripts")
        .select("word_path")
        .eq("id", id)
        .maybeSingle();

      if (mErr) throw mErr;
      if (!manuscript || !manuscript.word_path) {
        return res.status(404).json({ error: "No Word file found" });
      }

      storagePath = manuscript.word_path;
    } else {
      // 1) Try treating id as manuscript_versions.id
      const { data: versionRow, error: versionErr } = await supabaseServer
        .from("manuscript_versions")
        .select("file_path")
        .eq("id", id)
        .maybeSingle();

      if (versionErr) {
        throw versionErr;
      }

      if (versionRow && versionRow.file_path) {
        storagePath = versionRow.file_path;
      } else {
        // 2) Otherwise treat id as manuscripts.id, use current_version
        const { data: manuscript, error: mErr } = await supabaseServer
          .from("manuscripts")
          .select("current_version")
          .eq("id", id)
          .maybeSingle();

        if (mErr) throw mErr;
        if (!manuscript || !manuscript.current_version) {
          return res.status(404).json({ error: "No version found for this manuscript" });
        }

        const { data: v2, error: v2Err } = await supabaseServer
          .from("manuscript_versions")
          .select("file_path")
          .eq("id", manuscript.current_version)
          .maybeSingle();

        if (v2Err) throw v2Err;
        if (!v2 || !v2.file_path) {
          return res.status(404).json({ error: "No file path found for current version" });
        }

        storagePath = v2.file_path;
      }
    }

    // 3) Create signed URL (1 hour)
    const { data: signedData, error: signedErr } = await supabaseServer.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 60 * 60);

    if (signedErr) throw signedErr;

    return res.status(200).json({
      ok: true,
      signedUrl: signedData.signedUrl,
      expiresAt: signedData.expiry,
    });
  } catch (err) {
    console.error("signed-url error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
