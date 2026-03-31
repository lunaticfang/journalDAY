import { supabaseServer } from "./supabaseServer";
import {
  ensureProfileForUser,
  isApprovedProfileRole,
} from "./accessControl";

export const ADMIN_ROLES = ["admin", "editor", "reviewer"];

export function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

export async function requireRole(req, res, allowedRoles = ADMIN_ROLES) {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Missing auth token" });
    return null;
  }

  const { data: userData, error: authErr } =
    await supabaseServer.auth.getUser(token);

  if (authErr || !userData?.user) {
    res.status(401).json({ error: "Invalid auth token" });
    return null;
  }

  let profile = null;
  try {
    profile = await ensureProfileForUser(userData.user, supabaseServer);
  } catch (profileErr) {
    res.status(403).json({ error: "Not authorized" });
    return null;
  }

  if (!isApprovedProfileRole(profile, allowedRoles)) {
    res.status(403).json({ error: "Not authorized" });
    return null;
  }

  return { user: userData.user, profile };
}

export async function requireEditor(req, res) {
  return requireRole(req, res, ["admin", "editor"]);
}

export async function requireReviewer(req, res) {
  return requireRole(req, res, ["reviewer"]);
}
