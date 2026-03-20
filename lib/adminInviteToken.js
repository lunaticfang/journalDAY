import crypto from "crypto";

const DEFAULT_TTL_HOURS = 24 * 7;

export function getInviteSecret() {
  return (
    process.env.ADMIN_INVITE_SECRET ||
    process.env.CRON_SECRET ||
    process.env.KEEPALIVE_SECRET ||
    ""
  );
}

export function getInviteTtlHours() {
  const raw = Number(process.env.ADMIN_INVITE_TTL_HOURS || DEFAULT_TTL_HOURS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_TTL_HOURS;
  return raw;
}

function signPart(part, secret) {
  return crypto.createHmac("sha256", secret).update(part).digest("base64url");
}

export function createInviteToken(payload, secret) {
  const part = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = signPart(part, secret);
  return `${part}.${sig}`;
}

export function verifyInviteToken(token, secret) {
  const [part, sig] = String(token || "").split(".");
  if (!part || !sig) return null;

  const expected = signPart(part, secret);
  if (expected !== sig) return null;

  try {
    const payload = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    if (!payload || typeof payload !== "object") return null;
    const exp = Number(payload.exp || 0);
    if (!exp || exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
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

