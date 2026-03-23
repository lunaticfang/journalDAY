import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { requireRole } from "../../../../lib/adminAuth";
import { isOwnerProfile } from "../../../../lib/accessControl";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireRole(req, res, ["admin"]);
  if (!auth) return;

  const { data, error } = await supabaseServer
    .from("profiles")
    .select("id, email, role, approved")
    .order("email", { ascending: true });

  if (error) {
    return res.status(500).json({ error: error.message || "Failed to load users" });
  }

  return res.status(200).json({
    users: data || [],
    actor: {
      id: auth.user.id,
      email: auth.user.email ?? auth.profile?.email ?? null,
      isOwner: isOwnerProfile(auth.profile),
    },
  });
}
