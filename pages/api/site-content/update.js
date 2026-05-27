import { supabaseServer } from "../../../lib/supabaseServer";
import { requireRole } from "../../../lib/adminAuth";
import { respondWithApiError } from "../../../lib/apiError";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { key, value } = req.body || {};
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey || typeof value === "undefined") {
    return res.status(400).json({ error: "Missing key or value" });
  }

  // IMPORTANT: This endpoint uses the Supabase service role key, which bypasses RLS.
  // We must enforce authorization here (frontend "edit mode" is not a security boundary).
  const auth = await requireRole(req, res, ["admin", "editor"]);
  if (!auth) return;

  const { error } = await supabaseServer
    .from("site_content")
    .upsert({ key: normalizedKey, value });

  if (error) {
    return respondWithApiError(
      res,
      500,
      "site-content-update",
      error,
      "Failed to save content entry."
    );
  }

  res.status(200).json({ ok: true });
}
