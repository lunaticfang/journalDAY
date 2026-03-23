import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { requireRole } from "../../../../lib/adminAuth";
import { isOwnerProfile } from "../../../../lib/accessControl";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireRole(req, res, ["admin"]);
  if (!auth) return;

  const userId = String(req.body?.userId || "").trim();
  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  if (userId === auth.user.id) {
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

  if (isOwnerProfile(target)) {
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
    sanctioned_by: auth.user.email ?? auth.profile?.email ?? null,
  });
}
