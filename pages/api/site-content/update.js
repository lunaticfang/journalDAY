import { supabaseServer } from "../../../lib/supabaseServer";
import { isOwner } from "../../../lib/isOwner";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const { key, value } = req.body || {};
  if (!key || !value) {
    return res.status(400).json({ error: "Missing key or value" });
  }

  // IMPORTANT: This endpoint uses the Supabase service role key, which bypasses RLS.
  // We must enforce authorization here (frontend "edit mode" is not a security boundary).
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return res.status(401).json({ error: "Missing auth token" });
  }

  const { data: userData, error: authErr } =
    await supabaseServer.auth.getUser(token);

  if (authErr || !userData?.user) {
    return res.status(401).json({ error: "Invalid auth token" });
  }

  const user = userData.user;

  let allowed = isOwner(user);
  if (!allowed) {
    const { data: profile, error: profileErr } = await supabaseServer
      .from("profiles")
      .select("role, approved")
      .eq("id", user.id)
      .maybeSingle();

    const allowedRoles = ["admin", "editor"];
    allowed =
      !profileErr &&
      !!profile &&
      profile.approved === true &&
      allowedRoles.includes(profile.role);
  }

  if (!allowed) {
    return res.status(403).json({ error: "Not authorized" });
  }

  const { error } = await supabaseServer
    .from("site_content")
    .upsert({ key, value });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(200).json({ ok: true });
}
