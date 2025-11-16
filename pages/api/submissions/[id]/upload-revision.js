// pages/api/submissions/[id]/upload-revision.js
import { supabaseServer } from "../../../../lib/supabaseServer";

const BUCKET = process.env.SUPABASE_BUCKET_MANUSCRIPTS || "manuscripts";

// Allow bigger JSON body (base64 PDF)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "20mb",
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const raw = req.query.id;
    const manuscriptId =
      typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;

    if (!manuscriptId) {
      return res.status(400).json({ error: "Invalid manuscript id" });
    }

    const { fileName, contentBase64, contentType } = req.body || {};
    if (!fileName || !contentBase64) {
      return res.status(400).json({ error: "Missing file" });
    }

    const cleanName = fileName.replace(/[^\w.\-]/g, "_");
    const filePath = `manuscripts/${manuscriptId}/${Date.now()}-${cleanName}`;

    const buffer = Buffer.from(contentBase64, "base64");

    // Upload new version to storage
    const { error: uploadErr } = await supabaseServer.storage
      .from(BUCKET)
      .upload(filePath, buffer, {
        contentType: contentType || "application/pdf",
        upsert: true,
      });

    if (uploadErr) throw uploadErr;

    // Insert version row – NOTE: no "public_url" field here
    const { data: version, error: verErr } = await supabaseServer
      .from("manuscript_versions")
      .insert({
        manuscript_id: manuscriptId,
        file_path: filePath,
      })
      .select()
      .single();

    if (verErr) throw verErr;

    // Set this as the current version on the manuscript
    await supabaseServer
      .from("manuscripts")
      .update({ current_version: version.id })
      .eq("id", manuscriptId);

    return res.status(200).json({
      ok: true,
      version,
    });
  } catch (err) {
    console.error("upload-revision error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
