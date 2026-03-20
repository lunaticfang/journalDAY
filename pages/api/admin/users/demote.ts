import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { isOwner } from "../../../../lib/isOwner";

function getBearerToken(req: NextApiRequest) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

async function requireOwnerOrAdmin(req: NextApiRequest, res: NextApiResponse) {
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

  const user = userData.user;
  if (isOwner(user)) {
    return { id: user.id, email: user.email ?? null, isOwner: true };
  }

  const { data: profile, error: profileErr } = await supabaseServer
    .from("profiles")
    .select("role, approved")
    .eq("id", user.id)
    .maybeSingle();

  if (profileErr || !profile || profile.approved !== true || profile.role !== "admin") {
    res.status(403).json({ error: "Not authorized" });
    return null;
  }

  return { id: user.id, email: user.email ?? null, isOwner: false };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const actor = await requireOwnerOrAdmin(req, res);
  if (!actor) return;

  const userId = String(req.body?.userId || "").trim();
  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  if (userId === actor.id) {
    return res.status(400).json({ error: "You cannot revoke your own admin access" });
  }

  const { data: target, error: targetErr } = await supabaseServer
    .from("profiles")
    .select("id, email, role, approved")
    .eq("id", userId)
    .maybeSingle();

  if (targetErr) {
    return res.status(500).json({ error: targetErr.message || "Failed to read target user" });
  }
  if (!target) {
    return res.status(404).json({ error: "User profile not found" });
  }

  if (isOwner({ email: target.email })) {
    return res.status(400).json({ error: "Owner access cannot be revoked" });
  }

  const { data: updated, error: updateErr } = await supabaseServer
    .from("profiles")
    .update({ role: "author", approved: false })
    .eq("id", userId)
    .select("id, email, role, approved")
    .maybeSingle();

  if (updateErr) {
    return res.status(500).json({ error: updateErr.message || "Failed to revoke admin" });
  }

  return res.status(200).json({
    ok: true,
    user: updated,
    sanctioned_by: actor.email,
  });
}
