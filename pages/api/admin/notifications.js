import { supabaseServer } from "../../../lib/supabaseServer";
import { requireRole } from "../../../lib/adminAuth";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const auth = await requireRole(req, res);
    if (!auth) return;

    const limit = Number(req.query.limit || 8);

    const { data, error } = await supabaseServer
      .from("notifications")
      .select("id, title, body, manuscript_id, created_at, read_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(Number.isFinite(limit) ? limit : 8);

    if (error) throw error;

    return res.status(200).json({ ok: true, notifications: data || [] });
  } catch (err) {
    console.error("admin notifications error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
