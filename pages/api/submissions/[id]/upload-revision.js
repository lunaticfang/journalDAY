// pages/api/submissions/[id]/upload-revision.js
import { supabaseServer } from "../../../../lib/supabaseServer";
import { getProfileByUserId, isApprovedProfileRole } from "../../../../lib/accessControl";
import { respondWithApiError } from "../../../../lib/apiError";

const BUCKET = process.env.SUPABASE_BUCKET_MANUSCRIPTS || "manuscripts";

// Allow bigger JSON body (base64 PDF)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "20mb",
    },
  },
};

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

function isPdfLike(contentType, fileName) {
  const type = (contentType || "").toLowerCase();
  const name = (fileName || "").toLowerCase();
  return type === "application/pdf" || name.endsWith(".pdf");
}

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

    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "Missing auth token" });
    }

    const { data: userData, error: authErr } =
      await supabaseServer.auth.getUser(token);

    if (authErr || !userData?.user) {
      return res.status(401).json({ error: "Invalid auth token" });
    }

    const user = userData.user;

    const { data: manuscript, error: mErr } = await supabaseServer
      .from("manuscripts")
      .select("id, author_id, submitter_id")
      .eq("id", manuscriptId)
      .maybeSingle();

    if (mErr) throw mErr;
    if (!manuscript) {
      return res.status(404).json({ error: "Manuscript not found" });
    }

    const profile = await getProfileByUserId(user.id, supabaseServer);
    const staffAllowed = isApprovedProfileRole(profile, ["admin", "editor"]);

    const ownsManuscript =
      manuscript.author_id === user.id || manuscript.submitter_id === user.id;

    const allowed = staffAllowed || ownsManuscript;

    if (!allowed) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { fileName, contentBase64, contentType } = req.body || {};
    if (!fileName || !contentBase64) {
      return res.status(400).json({ error: "Missing file" });
    }

    if (!isPdfLike(contentType, fileName)) {
      return res.status(400).json({ error: "Only PDF revisions are allowed" });
    }

    const cleanName = fileName.replace(/[^\w.\-]/g, "_");
    const filePath = `manuscripts/${manuscriptId}/${Date.now()}-${cleanName}`;

    const base64 =
      typeof contentBase64 === "string" && contentBase64.includes("base64,")
        ? contentBase64.split("base64,")[1]
        : contentBase64;

    const buffer = Buffer.from(base64, "base64");

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
    const { error: updateErr } = await supabaseServer
      .from("manuscripts")
      .update({ current_version: version.id })
      .eq("id", manuscriptId);

    if (updateErr) throw updateErr;

    return res.status(200).json({
      ok: true,
      version,
    });
  } catch (err) {
    return respondWithApiError(
      res,
      500,
      "submission-upload-revision",
      err,
      "Failed to upload the revision."
    );
  }
}
