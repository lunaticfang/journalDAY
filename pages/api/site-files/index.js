import { supabaseServer } from "../../../lib/supabaseServer";
import { requireEditor } from "../../../lib/adminAuth";

function normalizeContentKey(value) {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const contentKey = normalizeContentKey(req.query?.contentKey);
    if (!contentKey) {
      return res.status(400).json({ error: "Missing contentKey" });
    }

    try {
      const { data, error } = await supabaseServer
        .from("site_files")
        .select("content_key, file_url, file_type, updated_at")
        .eq("content_key", contentKey)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return res.status(200).json({
        ok: true,
        file: data
          ? {
              contentKey: data.content_key,
              fileUrl: data.file_url,
              fileType: data.file_type,
              updatedAt: data.updated_at,
            }
          : null,
      });
    } catch (err) {
      console.error("site-files GET error:", err);
      return res.status(500).json({ error: "Failed to load file attachment." });
    }
  }

  if (!["POST", "DELETE"].includes(req.method || "")) {
    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireEditor(req, res);
  if (!auth) return;

  try {
    if (req.method === "POST") {
      const contentKey = normalizeContentKey(req.body?.contentKey);
      const fileUrl = String(req.body?.fileUrl || "").trim();
      const fileType =
        req.body?.fileType === "image" || req.body?.fileType === "pdf"
          ? req.body.fileType
          : null;

      if (!contentKey || !fileUrl || !fileType) {
        return res
          .status(400)
          .json({ error: "contentKey, fileUrl, and fileType are required." });
      }

      const { data, error } = await supabaseServer
        .from("site_files")
        .upsert(
          {
            content_key: contentKey,
            file_url: fileUrl,
            file_type: fileType,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "content_key" }
        )
        .select("content_key, file_url, file_type, updated_at")
        .maybeSingle();

      if (error) {
        throw error;
      }

      return res.status(200).json({
        ok: true,
        file: data
          ? {
              contentKey: data.content_key,
              fileUrl: data.file_url,
              fileType: data.file_type,
              updatedAt: data.updated_at,
            }
          : null,
      });
    }

    const contentKey = normalizeContentKey(req.body?.contentKey);
    if (!contentKey) {
      return res.status(400).json({ error: "Missing contentKey" });
    }

    const { error } = await supabaseServer
      .from("site_files")
      .delete()
      .eq("content_key", contentKey);

    if (error) {
      throw error;
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("site-files write error:", err);
    return res.status(500).json({ error: "Failed to update file attachment." });
  }
}
