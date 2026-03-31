import { supabaseServer } from "../../../lib/supabaseServer";
import { getBearerToken } from "../../../lib/adminAuth";
import {
  ensureOwnerProfile,
  getProfileByUserId,
  isApprovedProfileRole,
  isOwnerProfile,
} from "../../../lib/accessControl";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: "Missing auth token" });
  }

  try {
    const { data: userData, error: authErr } = await supabaseServer.auth.getUser(token);

    if (authErr || !userData?.user) {
      return res.status(401).json({ error: "Invalid auth token" });
    }

    let profile = await getProfileByUserId(userData.user.id, supabaseServer);

    if (!profile) {
      const syncedOwner = await ensureOwnerProfile(userData.user, supabaseServer);
      if (syncedOwner) {
        profile = syncedOwner;
      }
    }

    const requestedRoles = String(req.query.roles || "")
      .split(",")
      .map((role) => role.trim())
      .filter(Boolean);

    return res.status(200).json({
      user: {
        id: userData.user.id,
        email: userData.user.email ?? null,
      },
      profile,
      isOwner: isOwnerProfile(profile),
      allowed:
        requestedRoles.length === 0
          ? Boolean(userData.user)
          : isApprovedProfileRole(profile, requestedRoles),
    });
  } catch (err) {
    console.error("auth access error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
