import { supabaseServer } from "../../lib/supabaseServer";

const CRON_SECRET = process.env.CRON_SECRET;

function hasValidSecret(req) {
  const headerSecret = req.headers["x-cron-secret"];
  const querySecret = req.query?.secret;

  if (!CRON_SECRET) return false;
  if (headerSecret && headerSecret === CRON_SECRET) return true;
  if (typeof querySecret === "string" && querySecret === CRON_SECRET) return true;
  return false;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!CRON_SECRET) {
    return res.status(500).json({ ok: false, error: "CRON_SECRET is not configured" });
  }

  if (!hasValidSecret(req)) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  try {
    // Lightweight DB touch so Supabase sees activity.
    const { error } = await supabaseServer
      .from("issues")
      .select("id", { head: true, count: "exact" })
      .limit(1);

    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.status(200).json({ ok: true, ts: new Date().toISOString() });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
}

