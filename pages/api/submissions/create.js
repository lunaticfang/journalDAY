// pages/api/submissions/create.js
import { supabaseServer } from "../../../lib/supabaseServer";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1mb" // small JSON; file content is uploaded to storage already
    }
  }
};

const BUCKET = process.env.SUPABASE_BUCKET_MANUSCRIPTS || "manuscripts";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { title, abstract, authors, file_storage_path, contentType, uploader_id } = req.body;
    if (!title || !file_storage_path) return res.status(400).json({ error: "Missing title or file_storage_path" });

    // sanity: ensure the object exists in storage (optional but recommended)
    const { data: listData, error: statErr } = await supabaseServer.storage.from(BUCKET).list(file_storage_path.split('/').slice(0, -1).join('/') || "/", { limit: 100, offset: 0 });
    // We don't fail the request if list doesn't find it (some SDKs won't allow single stat). Optionally add more checks.

    // Insert manuscript
    const { data: manuscript, error: insertErr } = await supabaseServer
      .from("manuscripts")
      .insert({
        title,
        abstract: abstract || null,
        submitter_id: uploader_id || null,
        status: "submitted",
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Create a version row using the storage path (store storage path)
    const { data: version, error: versionErr } = await supabaseServer
      .from("manuscript_versions")
      .insert({
        manuscript_id: manuscript.id,
        file_path: file_storage_path, // store the storage path (manuscripts/...)
        uploader_id: uploader_id || null,
        version_label: "v1",
        uploaded_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (versionErr) throw versionErr;

    // update manuscript's current_version
    await supabaseServer
      .from("manuscripts")
      .update({ current_version: version.id, updated_at: new Date().toISOString() })
      .eq("id", manuscript.id);

    return res.status(200).json({ ok: true, manuscript, version });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
