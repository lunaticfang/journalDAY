import { supabaseServer } from "../../../lib/supabaseServer";
import formidable from "formidable";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false, // IMPORTANT: we handle multipart manually
  },
};

const BUCKET =
  process.env.SUPABASE_BUCKET_MANUSCRIPTS || "manuscripts";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    /* -------------------------------------------------- */
    /* 1. Parse multipart form                            */
    /* -------------------------------------------------- */
    const form = formidable({ multiples: false });

    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const title = fields.title?.toString();
    const abstract = fields.abstract?.toString() || null;
    const file = files.file;

    if (!title || !file) {
      return res.status(400).json({
        error: "Missing title or PDF file",
      });
    }

    /* -------------------------------------------------- */
    /* 2. Upload PDF to Supabase Storage (SERVER)         */
    /* -------------------------------------------------- */
    const cleanName = file.originalFilename.replace(/[^\w.\-]/g, "_");
    const storagePath = `manuscripts/${Date.now()}-${cleanName}`;

    const buffer = fs.readFileSync(file.filepath);

    const { error: uploadErr } = await supabaseServer.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadErr) throw uploadErr;

    /* -------------------------------------------------- */
    /* 3. Create manuscript                               */
    /* -------------------------------------------------- */
    const { data: manuscript, error: mErr } = await supabaseServer
      .from("manuscripts")
      .insert({
        title,
        abstract,
        status: "submitted",
      })
      .select()
      .single();

    if (mErr) throw mErr;

    /* -------------------------------------------------- */
    /* 4. Create manuscript version                       */
    /* -------------------------------------------------- */
    const { data: version, error: vErr } = await supabaseServer
      .from("manuscript_versions")
      .insert({
        manuscript_id: manuscript.id,
        file_path: storagePath,
      })
      .select()
      .single();

    if (vErr) throw vErr;

    /* -------------------------------------------------- */
    /* 5. Set current version                             */
    /* -------------------------------------------------- */
    const { error: uErr } = await supabaseServer
      .from("manuscripts")
      .update({ current_version: version.id })
      .eq("id", manuscript.id);

    if (uErr) throw uErr;

    return res.status(200).json({
      ok: true,
      manuscript,
      version,
    });
  } catch (err) {
    console.error("create submission error:", err);
    return res.status(500).json({
      error: err.message || String(err),
    });
  }
}
