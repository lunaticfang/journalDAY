export const ADMIN_ACCESS_REQUEST_STATUSES = [
  "pending",
  "invited",
  "approved",
  "rejected",
];

const VALID_REQUEST_STATUSES = new Set(ADMIN_ACCESS_REQUEST_STATUSES);

function toTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeAdminAccessRequestStatus(value) {
  const normalized = toTrimmedString(value).toLowerCase();
  return VALID_REQUEST_STATUSES.has(normalized) ? normalized : "pending";
}

export function isResolvedAdminAccessRequestStatus(value) {
  const status = normalizeAdminAccessRequestStatus(value);
  return status === "approved" || status === "rejected";
}

export function normalizeAdminAccessRequestRow(row) {
  if (!row || typeof row !== "object") {
    return null;
  }

  const id = toTrimmedString(row.id);
  const name = toTrimmedString(row.name);
  const email = toTrimmedString(row.email).toLowerCase();
  const message = toTrimmedString(row.message);

  if (!id || !email) {
    return null;
  }

  return {
    id,
    name: name || "Unknown requester",
    email,
    message,
    status: normalizeAdminAccessRequestStatus(row.status),
    created_at: toTrimmedString(row.created_at) || null,
    updated_at: toTrimmedString(row.updated_at) || null,
    reviewed_at: toTrimmedString(row.reviewed_at) || null,
    reviewed_by_email: toTrimmedString(row.reviewed_by_email) || null,
  };
}
