import formidable from "formidable";
import fs from "fs";
import { supabaseServer } from "../../../lib/supabaseServer";

export const config = {
  api: {
    bodyParser: false, // IMPORTANT
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const form = formidable({ multiples: false });

    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const title = fields.title?.[0];
    const abstract = fields.abstract?.[0] || null;
    const uploader_id = fields.uploader_id?.[0];
    const file = files.file?.[0];

    if (!title || !uploader_id || !file) {
      return res.status(400).json({
        error: "Missing title, uploader_id, or file",
      });
    }

    const buffer = fs.readFileSync(file.filepath);
    const cleanName = file.originalFilename.replace(/[^\w.\-]/g, "_");
    const storagePath = `manuscripts/${Date.now()}-${cleanName}`;

    // Upload PDF
    const { error: uploadErr } = await supabaseServer.storage
      .from("manuscripts")
      .upload(storagePath, buffer, {
        contentType: file.mimetype || "application/pdf",
      });

    if (uploadErr) throw uploadErr;

    // Insert manuscript
    const { data: manuscript, error: mErr } = await supabaseServer
      .from("manuscripts")
      .insert({
        title,
        abstract,
        uploader_id,
        status: "submitted",
      })
      .select()
      .single();

    if (mErr) throw mErr;

    // Insert version
    const { data: version, error: vErr } = await supabaseServer
      .from("manuscript_versions")
      .insert({
        manuscript_id: manuscript.id,
        file_path: storagePath,
      })
      .select()
      .single();

    if (vErr) throw vErr;

    await supabaseServer
      .from("manuscripts")
      .update({ current_version: version.id })
      .eq("id", manuscript.id);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
