import { supabaseServer } from "./supabaseServer";

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

  const { data: profile, error: profileErr } = await supabaseServer
    .from("profiles")
    .select("id, role, approved, email")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (
    profileErr ||
    !profile ||
    profile.approved !== true ||
    !allowedRoles.includes(profile.role)
  ) {
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
