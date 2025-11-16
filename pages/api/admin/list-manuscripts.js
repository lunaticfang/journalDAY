// pages/api/admin/list-manuscripts.js
import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // TODO: add real auth check so only editors/managers can call this.
    const { data, error } = await supabaseServer
      .from("manuscripts")
      .select("id, title, status, submitter_id, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return res.status(200).json({ ok: true, manuscripts: data });
  } catch (err) {
    console.error("list-manuscripts error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
