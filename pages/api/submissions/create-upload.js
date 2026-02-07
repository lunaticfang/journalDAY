import { supabaseServer } from "../../../lib/supabaseServer";

const BUCKET =
  process.env.SUPABASE_BUCKET_MANUSCRIPTS ||
  process.env.NEXT_PUBLIC_SUPABASE_BUCKET_MANUSCRIPTS ||
  "manuscripts";

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

function normalizeFilename(name) {
  return name.replace(/[^\w.\-]/g, "_");
}

function isAllowedContentType(kind, contentType, filename) {
  const lower = (contentType || "").toLowerCase();
  const ext = (filename || "").toLowerCase();

  if (kind === "pdf") {
    return lower === "application/pdf" || ext.endsWith(".pdf");
  }

  if (kind === "word") {
    return (
      lower === "application/msword" ||
      lower ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      ext.endsWith(".doc") ||
      ext.endsWith(".docx")
    );
  }

  return false;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "Missing auth token" });
    }

    const { data: userData, error: authErr } =
      await supabaseServer.auth.getUser(token);

    if (authErr || !userData?.user) {
      return res.status(401).json({ error: "Invalid auth token" });
    }

    const { filename, contentType, size, kind } = req.body || {};

    if (!filename || !kind) {
      return res.status(400).json({ error: "Missing filename or kind" });
    }

    if (size && Number(size) > MAX_FILE_BYTES) {
      return res.status(400).json({ error: "File too large" });
    }

    if (!isAllowedContentType(kind, contentType, filename)) {
      return res.status(400).json({ error: "Invalid file type" });
    }

    const cleanName = normalizeFilename(filename);
    const path = `manuscripts/${userData.user.id}/${Date.now()}-${cleanName}`;

    const { data, error } = await supabaseServer.storage
      .from(BUCKET)
      .createSignedUploadUrl(path, { upsert: false });

    if (error) throw error;

    return res.status(200).json({
      bucket: BUCKET,
      path: data.path,
      token: data.token,
    });
  } catch (err) {
    console.error("create-upload error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
