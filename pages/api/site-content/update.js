import { supabaseServer } from "../../../lib/supabaseServer";
import { requireRole } from "../../../lib/adminAuth";

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
  const auth = await requireRole(req, res, ["admin", "editor"]);
  if (!auth) return;

  const { error } = await supabaseServer
    .from("site_content")
    .upsert({ key, value });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(200).json({ ok: true });
}
