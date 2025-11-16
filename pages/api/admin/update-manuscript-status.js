// pages/api/admin/update-manuscript-status.js
import { supabaseServer } from "../../../lib/supabaseServer";

const ALLOWED_STATUSES = [
  "submitted",
  "under_review",
  "accepted",
  "rejected",
  "published",
];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { manuscriptId, status } = req.body || {};

    if (!manuscriptId || typeof manuscriptId !== "string") {
      return res.status(400).json({ error: "Missing or invalid manuscriptId" });
    }

    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    // TODO: add real editor-role check using profiles table

    const { data, error } = await supabaseServer
      .from("manuscripts")
      .update({ status })
      .eq("id", manuscriptId)
      .select("id, title, status, created_at, submitter_id, author_id")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: "Manuscript not found" });
    }

    return res.status(200).json({ ok: true, manuscript: data });
  } catch (err) {
    console.error("update-manuscript-status error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
