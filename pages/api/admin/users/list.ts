import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { isOwner } from "../../../../lib/isOwner";

type Actor = {
  id: string;
  email: string | null;
  isOwner: boolean;
};

function getBearerToken(req: NextApiRequest) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

async function requireOwnerOrAdmin(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<Actor | null> {
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
  const owner = isOwner(user);
  if (owner) {
    return {
      id: user.id,
      email: user.email ?? null,
      isOwner: true,
    };
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

  return {
    id: user.id,
    email: user.email ?? null,
    isOwner: false,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const actor = await requireOwnerOrAdmin(req, res);
  if (!actor) return;

  const { data, error } = await supabaseServer
    .from("profiles")
    .select("id, email, role, approved")
    .order("email", { ascending: true });

  if (error) {
    return res.status(500).json({ error: error.message || "Failed to load users" });
  }

  return res.status(200).json({
    users: data || [],
    actor,
  });
}
