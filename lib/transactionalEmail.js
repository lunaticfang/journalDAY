const BREVO_API_KEY =
  process.env.BREVO_API_KEY ||
  process.env.SENDINBLUE_API_KEY ||
  process.env.BREVO_TRANSACTIONAL_API_KEY ||
  "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";

const CONFIGURED_FROM_EMAIL =
  process.env.BREVO_FROM_EMAIL ||
  process.env.SENDINBLUE_FROM_EMAIL ||
  process.env.MAIL_FROM_EMAIL ||
  process.env.RESEND_FROM_EMAIL ||
  "";
const DEFAULT_FROM_NAME =
  process.env.BREVO_FROM_NAME ||
  process.env.MAIL_FROM_NAME ||
  "UpDAYtes Editorial Office";

/**
 * @typedef {{ email: string, name?: string }} EmailRecipient
 * @typedef {{
 *   to: string | EmailRecipient | Array<string | EmailRecipient>,
 *   subject: string,
 *   html?: string,
 *   text?: string,
 *   replyTo?: string | EmailRecipient | null,
 *   tags?: string[],
 * }} TransactionalEmailInput
 */

function normalizeRecipient(recipient) {
  if (!recipient) return null;

  if (typeof recipient === "string") {
    const email = recipient.trim();
    return email ? { email } : null;
  }

  if (typeof recipient === "object") {
    const email = String(recipient.email || "").trim();
    const name = String(recipient.name || "").trim();
    if (!email) return null;
    return name ? { email, name } : { email };
  }

  return null;
}

function uniqueRecipients(recipients = []) {
  const seen = new Set();
  const normalized = [];

  recipients.forEach((recipient) => {
    const entry = normalizeRecipient(recipient);
    if (!entry?.email) return;

    const key = entry.email.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push(entry);
  });

  return normalized;
}

function normalizeReplyTo(replyTo) {
  const entry = normalizeRecipient(replyTo);
  return entry?.email ? entry : null;
}

export function getTransactionalEmailProvider() {
  if (BREVO_API_KEY) return "brevo";
  if (RESEND_API_KEY) return "resend";
  return null;
}

export function assertTransactionalEmailConfigured() {
  const provider = getTransactionalEmailProvider();
  if (!provider) {
    throw new Error(
      "Missing email provider configuration. Set BREVO_API_KEY (preferred) or RESEND_API_KEY."
    );
  }

  if (!CONFIGURED_FROM_EMAIL) {
    throw new Error(
      "Missing sender email configuration. Set BREVO_FROM_EMAIL, SENDINBLUE_FROM_EMAIL, MAIL_FROM_EMAIL, or RESEND_FROM_EMAIL to a verified sender."
    );
  }

  return provider;
}

async function sendViaBrevo({
  to,
  subject,
  html,
  text,
  replyTo = null,
  tags = [],
} = {}) {
  const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": BREVO_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: {
        email: CONFIGURED_FROM_EMAIL,
        name: DEFAULT_FROM_NAME,
      },
      to,
      subject,
      htmlContent: html || undefined,
      textContent: text || undefined,
      replyTo: normalizeReplyTo(replyTo) || undefined,
      tags: Array.isArray(tags) && tags.length ? tags : undefined,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(body || "Brevo email send failed");
  }

  return resp.json().catch(() => ({}));
}

async function sendViaResend({
  to,
  subject,
  html,
  text,
  replyTo = null,
  tags = [],
} = {}) {
  const from = DEFAULT_FROM_NAME
    ? `${DEFAULT_FROM_NAME} <${CONFIGURED_FROM_EMAIL}>`
    : CONFIGURED_FROM_EMAIL;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: to.map((recipient) => recipient.email),
      subject,
      html,
      text,
      reply_to: normalizeReplyTo(replyTo)?.email || undefined,
      tags: Array.isArray(tags) && tags.length ? tags : undefined,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(body || "Resend email send failed");
  }

  return resp.json().catch(() => ({}));
}

/**
 * @param {TransactionalEmailInput} options
 */
export async function sendTransactionalEmail(options = {}) {
  const {
    to,
    subject,
    html,
    text,
    replyTo = null,
    tags = [],
  } = options;
  const recipients = uniqueRecipients(Array.isArray(to) ? to : [to]);
  if (!recipients.length) {
    throw new Error("No recipient emails provided.");
  }

  if (!subject) {
    throw new Error("Email subject is required.");
  }

  if (!html && !text) {
    throw new Error("Email content is required.");
  }

  const provider = assertTransactionalEmailConfigured();

  if (provider === "brevo") {
    return sendViaBrevo({
      to: recipients,
      subject,
      html,
      text,
      replyTo,
      tags,
    });
  }

  return sendViaResend({
    to: recipients,
    subject,
    html,
    text,
    replyTo,
    tags,
  });
}
