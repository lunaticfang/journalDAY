import { supabaseServer } from "../../../lib/supabaseServer";

function parseRequestedKeys(raw) {
  const values = Array.isArray(raw) ? raw : [raw];

  return Array.from(
    new Set(
      values
        .flatMap((value) => String(value || "").split(","))
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

export default async function handler(req, res) {
  const requestedKeys = parseRequestedKeys(req.query?.keys);

  let query = supabaseServer.from("site_content").select("key, value");
  if (requestedKeys.length > 0) {
    query = query.in("key", requestedKeys);
  }

  const { data, error } = await query;

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const result = {};
  for (const row of data) {
    result[row.key] = row.value;
  }

  res.status(200).json(result);
}
