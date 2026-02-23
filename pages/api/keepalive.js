import { supabaseServer } from "../../lib/supabaseServer";

const CRON_SECRET = process.env.CRON_SECRET || process.env.KEEPALIVE_SECRET;

function hasValidSecret(req) {
  const headerSecretRaw = req.headers["x-cron-secret"];
  const headerSecret = Array.isArray(headerSecretRaw)
    ? headerSecretRaw[0]
    : headerSecretRaw;
  const querySecret = req.query?.secret;

  if (!CRON_SECRET) return false;
  if (headerSecret && headerSecret === CRON_SECRET) return true;
  if (typeof querySecret === "string" && querySecret === CRON_SECRET) return true;
  return false;
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!CRON_SECRET) {
    return res.status(500).json({
      ok: false,
      error: "CRON_SECRET/KEEPALIVE_SECRET is not configured",
    });
  }

  if (!hasValidSecret(req)) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  try {
    // Try a few lightweight reads so keepalive still succeeds even if one table changes.
    const tablesToProbe = ["issues", "profiles", "site_content"];
    let lastError = null;
    let touchedTable = null;

    for (const table of tablesToProbe) {
      const { error } = await supabaseServer
        .from(table)
        .select("*", { head: true, count: "exact" })
        .limit(1);

      if (!error) {
        touchedTable = table;
        break;
      }
      lastError = error;
    }

    if (!touchedTable) {
      return res.status(500).json({
        ok: false,
        error: lastError?.message || "No keepalive table probe succeeded",
      });
    }

    return res.status(200).json({
      ok: true,
      table: touchedTable,
      ts: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
}
