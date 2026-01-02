import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  const { data, error } = await supabaseServer
    .from("site_content")
    .select("key, value");

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const result = {};
  for (const row of data) {
    result[row.key] = row.value;
  }

  res.status(200).json(result);
}
