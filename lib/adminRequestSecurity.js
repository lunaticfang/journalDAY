import crypto from "crypto";

export const MAX_ADMIN_REQUEST_NAME_LENGTH = 120;
export const MAX_ADMIN_REQUEST_EMAIL_LENGTH = 320;
export const MAX_ADMIN_REQUEST_MESSAGE_LENGTH = 2000;

export const ADMIN_REQUEST_EMAIL_COOLDOWN_MS = 15 * 60 * 1000;
export const ADMIN_REQUEST_IP_MIN_INTERVAL_MS = 60 * 1000;
export const ADMIN_REQUEST_IP_WINDOW_MS = 60 * 60 * 1000;
export const ADMIN_REQUEST_IP_MAX_REQUESTS_PER_WINDOW = 5;

function toHeaderString(value) {
  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return typeof value === "string" ? value : "";
}

function normalizeIpAddress(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (raw === "::1") {
    return "127.0.0.1";
  }

  if (raw.startsWith("::ffff:")) {
    return raw.slice("::ffff:".length);
  }

  return raw;
}

export function getAdminRequestClientIp(req) {
  const forwardedFor = toHeaderString(req?.headers?.["x-forwarded-for"]);
  if (forwardedFor) {
    const firstHop = forwardedFor.split(",")[0];
    const normalized = normalizeIpAddress(firstHop);
    if (normalized) return normalized;
  }

  const realIp = normalizeIpAddress(toHeaderString(req?.headers?.["x-real-ip"]));
  if (realIp) return realIp;

  const socketIp = normalizeIpAddress(req?.socket?.remoteAddress);
  return socketIp || null;
}

export function getAdminRequestClientFingerprint(req) {
  const ip = getAdminRequestClientIp(req);
  if (!ip) return null;

  const secret =
    process.env.ADMIN_REQUEST_FINGERPRINT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";

  if (secret) {
    return crypto.createHmac("sha256", secret).update(ip).digest("hex");
  }

  return crypto.createHash("sha256").update(ip).digest("hex");
}

export function getAdminRequestUserAgent(req) {
  return toHeaderString(req?.headers?.["user-agent"]).slice(0, 500) || null;
}
