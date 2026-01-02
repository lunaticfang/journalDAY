import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const { key, value } = req.body || {};
  if (!key || !value) {
    return res.status(400).json({ error: "Missing key or value" });
  }

  const { error } = await supabaseServer
    .from("site_content")
    .upsert({ key, value });

  if (error) {
    return res.status(403).json({ error: error.message });
  }

  res.status(200).json({ ok: true });
}
