import crypto from "crypto";

const DEFAULT_TTL_HOURS = 24 * 7;

export function getInviteTtlHours() {
  const raw = Number(process.env.ADMIN_INVITE_TTL_HOURS || DEFAULT_TTL_HOURS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_TTL_HOURS;
  return raw;
}

export function createInviteToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashInviteToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

export function getAppBaseUrl(req) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "";
  if (configured) {
    if (configured.startsWith("http://") || configured.startsWith("https://")) {
      return configured.replace(/\/$/, "");
    }
    return `https://${configured.replace(/\/$/, "")}`;
  }

  const host = req?.headers?.host || "";
  const proto =
    req?.headers?.["x-forwarded-proto"] || (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`.replace(/\/$/, "");
}

export function randomPassword() {
  return crypto.randomBytes(24).toString("base64url");
}
