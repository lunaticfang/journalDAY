import { supabaseServer } from "../../../lib/supabaseServer";
import { respondWithApiError } from "../../../lib/apiError";

const MAX_KEYS_PER_REQUEST = 200;
const PRIVATE_SITE_CONTENT_KEY_PREFIXES = [
  "admin_access_request.",
  "private_admin_access_request.",
  "admin_invite.",
  "admin_invites.",
];

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

function isPrivateSiteContentKey(key) {
  const normalized = String(key || "").trim().toLowerCase();
  if (!normalized) return true;

  return PRIVATE_SITE_CONTENT_KEY_PREFIXES.some((prefix) =>
    normalized.startsWith(prefix)
  );
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const requestedKeys = parseRequestedKeys(req.query?.keys);
  if (!requestedKeys.length) {
    // Do not allow a full-table dump through this endpoint.
    return res.status(200).json({});
  }

  if (requestedKeys.length > MAX_KEYS_PER_REQUEST) {
    return res.status(400).json({
      error: `Too many keys requested. Limit is ${MAX_KEYS_PER_REQUEST}.`,
    });
  }

  const allowedKeys = requestedKeys.filter(
    (requestedKey) => !isPrivateSiteContentKey(requestedKey)
  );
  if (!allowedKeys.length) {
    return res.status(200).json({});
  }

  const { data, error } = await supabaseServer
    .from("site_content")
    .select("key, value")
    .in("key", allowedKeys);

  if (error) {
    return respondWithApiError(
      res,
      500,
      "site-content-get",
      error,
      "Failed to load content entries."
    );
  }

  const result = {};
  for (const row of data) {
    result[row.key] = row.value;
  }

  res.status(200).json(result);
}
