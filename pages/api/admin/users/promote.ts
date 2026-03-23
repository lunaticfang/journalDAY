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

  const { data: existing, error: existingErr } = await supabaseServer
    .from("profiles")
    .select("id, email, role, approved")
    .eq("id", userId)
    .maybeSingle();

  if (existingErr) {
    return res.status(500).json({ error: existingErr.message || "Failed to read target user" });
  }
  if (!existing) {
    return res.status(404).json({ error: "User profile not found" });
  }

  if (isOwnerProfile(existing)) {
    return res.status(400).json({ error: "Owner access is already protected" });
  }

  const { data: updated, error: updateErr } = await supabaseServer
    .from("profiles")
    .update({ role: "admin", approved: true })
    .eq("id", userId)
    .select("id, email, role, approved")
    .maybeSingle();

  if (updateErr) {
    return res.status(500).json({ error: updateErr.message || "Failed to promote user" });
  }

  return res.status(200).json({
    ok: true,
    user: updated,
    sanctioned_by: auth.user.email ?? auth.profile?.email ?? null,
  });
}
