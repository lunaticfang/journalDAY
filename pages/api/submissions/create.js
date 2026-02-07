import { supabaseServer } from "../../../lib/supabaseServer";

const BUCKET =
  process.env.SUPABASE_BUCKET_MANUSCRIPTS ||
  process.env.NEXT_PUBLIC_SUPABASE_BUCKET_MANUSCRIPTS ||
  "manuscripts";

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

async function safeRemove(paths) {
  const valid = paths.filter(Boolean);
  if (!valid.length) return;
  try {
    await supabaseServer.storage.from(BUCKET).remove(valid);
  } catch (err) {
    console.warn("Storage cleanup failed:", err);
  }
}

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
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "Missing auth token" });
    }

    const { data: userData, error: authErr } =
      await supabaseServer.auth.getUser(token);

    if (authErr || !userData?.user) {
      return res.status(401).json({ error: "Invalid auth token" });
    }

    const { title, abstract, file_storage_path, word_storage_path, authors_json } =
      req.body || {};

    if (!title || !file_storage_path || !word_storage_path) {
      return res.status(400).json({
        error: "Missing title, file_storage_path, or word_storage_path",
      });
    }

    const userId = userData.user.id;
    const expectedPrefix = `manuscripts/${userId}/`;
    if (
      !file_storage_path.startsWith(expectedPrefix) ||
      !word_storage_path.startsWith(expectedPrefix)
    ) {
      return res.status(403).json({ error: "Invalid file path" });
    }

    let authorsValue = null;
    if (authors_json) {
      if (typeof authors_json === "string") {
        authorsValue = authors_json;
      } else {
        try {
          authorsValue = JSON.stringify(authors_json);
        } catch {
          authorsValue = null;
        }
      }
    }

    /* ---------------------------------------------------- */
    /* 1. Create manuscript (RLS-COMPLIANT)                 */
    /* ---------------------------------------------------- */
    const { data: manuscript, error: mErr } = await supabaseServer
      .from("manuscripts")
      .insert({
        title,
        abstract: abstract ?? null,

        // 🔑 THESE TWO LINES FIX EVERYTHING
        submitter_id: userId,
        author_id: userId,

        status: "submitted",
        authors: authorsValue,
        word_path: word_storage_path,
        file_storage_path: file_storage_path,
      })
      .select()
      .single();

    if (mErr) {
      await safeRemove([file_storage_path, word_storage_path]);
      throw mErr;
    }

    /* ---------------------------------------------------- */
    /* 2. Create initial version                             */
    /* ---------------------------------------------------- */
    const { data: version, error: vErr } = await supabaseServer
      .from("manuscript_versions")
      .insert({
        manuscript_id: manuscript.id,
        file_path: file_storage_path,
      })
      .select()
      .single();

    if (vErr) {
      await safeRemove([file_storage_path, word_storage_path]);
      throw vErr;
    }

    /* ---------------------------------------------------- */
    /* 3. Set current version                                */
    /* ---------------------------------------------------- */
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
