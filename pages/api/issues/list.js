import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { data, error } = await supabaseServer
      .from("issues")
      .select("id, title, volume, issue_number, published_at, created_at")
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return res.status(200).json({ ok: true, issues: data || [] });
  } catch (err) {
    console.error("issues list error:", err);
    return res.status(500).json({ error: "Failed to load issues." });
  }
}
