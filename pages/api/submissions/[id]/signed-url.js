// pages/api/submissions/[id]/signed-url.js
import { supabaseServer } from "../../../../lib/supabaseServer";
import { isOwner } from "../../../../lib/isOwner";

const BUCKET = process.env.SUPABASE_BUCKET_MANUSCRIPTS || "manuscripts";

function normalizeId(raw) {
  return typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

async function getAuthContext(req, res) {
  const token = getBearerToken(req);
  if (!token) return { token: null, user: null, profile: null };

  const { data: userData, error: authErr } =
    await supabaseServer.auth.getUser(token);

  if (authErr || !userData?.user) {
    res.status(401).json({ error: "Invalid auth token" });
    return null;
  }

  const user = userData.user;

  // Profiles exist for staff; for authors we allow missing profiles.
  const { data: profile } = await supabaseServer
    .from("profiles")
    .select("id, role, approved, email")
    .eq("id", user.id)
    .maybeSingle();

  return { token, user, profile: profile || null };
}

function isApprovedRole(profile, roles) {
  return !!profile && profile.approved === true && roles.includes(profile.role);
}

async function reviewerHasAssignment(manuscriptId, reviewerId) {
  const { data, error } = await supabaseServer
    .from("manuscript_reviews")
    .select("id")
    .eq("manuscript_id", manuscriptId)
    .eq("reviewer_id", reviewerId)
    .maybeSingle();

  if (error) return false;
  return !!data;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const id = normalizeId(req.query.id);
    const type = normalizeId(req.query.type);
    if (!id) {
      return res.status(400).json({ error: "Missing id" });
    }

    const auth = await getAuthContext(req, res);
    if (!auth) return;

    const user = auth.user;
    const profile = auth.profile;
    const owner = user ? isOwner(user) : false;

    const isStaff = owner || isApprovedRole(profile, ["admin", "editor"]);
    const isReviewer =
      !owner && !!profile && profile.approved === true && profile.role === "reviewer";

    let storagePath = null;
    let manuscript = null;
    let versionId = null;
    let isVersionRequest = false;

    if (type === "word") {
      if (!auth.token) {
        return res.status(401).json({ error: "Missing auth token" });
      }

      if (!owner && !isApprovedRole(profile, ["admin", "editor", "reviewer"])) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const { data: m, error: mErr } = await supabaseServer
        .from("manuscripts")
        .select("id, word_path")
        .eq("id", id)
        .maybeSingle();

      if (mErr) throw mErr;
      if (!m) {
        return res.status(404).json({ error: "Manuscript not found" });
      }

      if (isReviewer) {
        const ok = await reviewerHasAssignment(m.id, user.id);
        if (!ok) {
          return res.status(403).json({ error: "Not assigned to this manuscript" });
        }
      }

      if (!m.word_path) {
        return res.status(404).json({ error: "No Word file found" });
      }

      storagePath = m.word_path;
    } else {
      // 1) Try treating id as manuscript_versions.id
      const { data: versionRow, error: versionErr } = await supabaseServer
        .from("manuscript_versions")
        .select("id, file_path, manuscript_id")
        .eq("id", id)
        .maybeSingle();

      if (versionErr) {
        throw versionErr;
      }

      if (versionRow && versionRow.file_path && versionRow.manuscript_id) {
        isVersionRequest = true;
        versionId = versionRow.id;
        storagePath = versionRow.file_path;

        const { data: m, error: mErr } = await supabaseServer
          .from("manuscripts")
          .select("id, status, current_version, author_id, submitter_id")
          .eq("id", versionRow.manuscript_id)
          .maybeSingle();

        if (mErr) throw mErr;
        if (!m) {
          return res.status(404).json({ error: "Manuscript not found" });
        }

        manuscript = m;
      } else {
        // 2) Otherwise treat id as manuscripts.id, use current_version
        const { data: m, error: mErr } = await supabaseServer
          .from("manuscripts")
          .select("id, status, current_version, author_id, submitter_id")
          .eq("id", id)
          .maybeSingle();

        if (mErr) throw mErr;
        if (!m) {
          return res.status(404).json({ error: "Manuscript not found" });
        }

        manuscript = m;

        if (!m.current_version) {
          return res
            .status(404)
            .json({ error: "No version found for this manuscript" });
        }

        const { data: v2, error: v2Err } = await supabaseServer
          .from("manuscript_versions")
          .select("id, file_path")
          .eq("id", m.current_version)
          .maybeSingle();

        if (v2Err) throw v2Err;
        if (!v2 || !v2.file_path) {
          return res
            .status(404)
            .json({ error: "No file path found for current version" });
        }

        versionId = v2.id;
        storagePath = v2.file_path;
      }
    }

    // Authorization rules
    if (!storagePath || !manuscript) {
      // word requests don't set manuscript var; they're already handled above
      // For pdf requests, manuscript should always be set by now.
    }

    if (type !== "word") {
      if (!manuscript) {
        return res.status(500).json({ error: "Could not resolve manuscript" });
      }

      const isPublished = manuscript.status === "published";
      const ownsManuscript =
        !!user &&
        (manuscript.author_id === user.id || manuscript.submitter_id === user.id);

      // Public access: only published PDFs, and only for current_version when requesting by version id.
      if (!auth.token) {
        if (!isPublished) {
          return res.status(401).json({ error: "Missing auth token" });
        }
        if (isVersionRequest && versionId !== manuscript.current_version) {
          return res.status(403).json({ error: "Not authorized" });
        }
      } else if (!owner && !isStaff) {
        if (isReviewer) {
          const ok = await reviewerHasAssignment(manuscript.id, user.id);
          if (!ok) {
            return res
              .status(403)
              .json({ error: "Not assigned to this manuscript" });
          }
        } else if (!ownsManuscript) {
          return res.status(403).json({ error: "Not authorized" });
        }
      }
    }

    // 3) Create signed URL (1 hour)
    const { data: signedData, error: signedErr } = await supabaseServer.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 60 * 60);

    if (signedErr) throw signedErr;

    return res.status(200).json({
      ok: true,
      signedUrl: signedData.signedUrl,
      expiresAt: signedData.expiry,
    });
  } catch (err) {
    console.error("signed-url error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
