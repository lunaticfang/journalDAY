// pages/api/admin/upload-file.js
import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const { fileName, contentBase64, contentType, title, published_at } =
      req.body;

    if (!fileName || !contentBase64)
      return res.status(400).json({ error: "Missing file" });

    const cleanName = fileName.replace(/[^\w.\-]/g, "_");
    const filePath = `issues/${Date.now()}-${cleanName}`;

    // Upload with service role key (RLS bypass)
    const { error: uploadErr } = await supabaseServer.storage
      .from("issues-pdfs")
      .upload(filePath, Buffer.from(contentBase64, "base64"), {
        contentType,
        upsert: true,
      });

    if (uploadErr) throw uploadErr;

    // Get public URL
    const { data: publicData } = supabaseServer.storage
      .from("issues-pdfs")
      .getPublicUrl(filePath);

    const publicUrl = publicData.publicUrl;

    // Insert DB row using service-role
    const { data, error: dbErr } = await supabaseServer
      .from("issues")
      .insert({
        title,
        pdf_path: publicUrl,
        published_at,
      })
      .select()
      .single();

    if (dbErr) throw dbErr;

    return res.status(200).json({
      ok: true,
      publicUrl,
      db: data,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
