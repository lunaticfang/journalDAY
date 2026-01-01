import { supabaseServer } from "../../../lib/supabaseServer";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1mb",
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { title, abstract, file_storage_path, uploader_id } = req.body || {};

    if (!title || !file_storage_path || !uploader_id) {
      return res.status(400).json({
        error: "Missing title, file_storage_path, or uploader_id",
      });
    }

    const { data: manuscript, error: mErr } = await supabaseServer
      .from("manuscripts")
      .insert({
        title,
        abstract: abstract ?? null,
        uploader_id,
        status: "submitted",
      })
      .select()
      .single();

    if (mErr) throw mErr;

    const { data: version, error: vErr } = await supabaseServer
      .from("manuscript_versions")
      .insert({
        manuscript_id: manuscript.id,
        file_path: file_storage_path,
      })
      .select()
      .single();

    if (vErr) throw vErr;

    await supabaseServer
      .from("manuscripts")
      .update({ current_version: version.id })
      .eq("id", manuscript.id);

    return res.status(200).json({ ok: true, manuscript, version });
  } catch (err) {
    console.error("create submission error:", err);
    return res.status(500).json({
      error: err.message || String(err),
    });
  }
}
