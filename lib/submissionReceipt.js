import {
  assertTransactionalEmailConfigured,
  sendTransactionalEmail,
} from "./transactionalEmail";

function getAppBaseUrl(req) {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "";
  if (configured) {
    if (configured.startsWith("http://") || configured.startsWith("https://")) {
      return configured.replace(/\/$/, "");
    }
    return `https://${configured.replace(/\/$/, "")}`;
  }

  const host = req?.headers?.host || "";
  const proto =
    req?.headers?.["x-forwarded-proto"] ||
    (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`.replace(/\/$/, "");
}

function parseAuthors(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatSubmissionTimestamp(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
}

export function buildReceiptCode(manuscriptId, submittedAtIso) {
  const safeId = String(manuscriptId || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 8);
  const datePart = String(submittedAtIso || "")
    .replace(/[-:TZ.]/g, "")
    .slice(0, 12);

  return `UPD-${datePart || "SUBMISSION"}-${safeId || "MANUSCRIPT"}`;
}

export async function sendSubmissionReceiptEmail({
  manuscript,
  userEmail,
  req,
}) {
  assertTransactionalEmailConfigured();

  const authors = parseAuthors(manuscript?.authors);
  const recipients = new Set();

  authors.forEach((author) => {
    const email = String(author?.email || "").trim();
    if (email) recipients.add(email);
  });

  const normalizedUserEmail = String(userEmail || "").trim();
  if (normalizedUserEmail) {
    recipients.add(normalizedUserEmail);
  }

  const toList = Array.from(recipients);
  if (!toList.length) {
    throw new Error("No recipient emails found for this submission.");
  }

  const title = manuscript?.title || "Manuscript";
  const submittedAtIso = formatSubmissionTimestamp(manuscript?.created_at);
  const receiptCode = buildReceiptCode(manuscript?.id, submittedAtIso);
  const authorNames = authors
    .map((author) => String(author?.name || "").trim())
    .filter(Boolean)
    .join(", ");
  const dashboardUrl = `${getAppBaseUrl(req)}/author/dashboard`;
  const subject = `Submission receipt: ${title}`;

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827;">
      <h2 style="color: #6A3291; margin-bottom: 12px;">Submission received</h2>
      <p>Thank you for submitting your manuscript to UpDAYtes. This email is your confirmation receipt.</p>
      <div style="margin: 18px 0; padding: 16px; border: 1px solid #e5d8f2; border-radius: 12px; background: #faf7fe;">
        <p style="margin: 0 0 10px;"><strong>Receipt code:</strong> ${escapeHtml(receiptCode)}</p>
        <p style="margin: 0 0 10px;"><strong>Submission ID:</strong> ${escapeHtml(manuscript?.id)}</p>
        <p style="margin: 0 0 10px;"><strong>Submitted at:</strong> ${escapeHtml(submittedAtIso)} (UTC)</p>
        <p style="margin: 0 0 10px;"><strong>Status:</strong> ${escapeHtml(manuscript?.status || "submitted")}</p>
        <p style="margin: 0;"><strong>Title:</strong> ${escapeHtml(title)}</p>
        ${
          authorNames
            ? `<p style="margin: 10px 0 0;"><strong>Authors:</strong> ${escapeHtml(authorNames)}</p>`
            : ""
        }
      </div>
      <p>Please keep this email for your records. You can track updates from your submissions dashboard.</p>
      <p style="margin: 18px 0;">
        <a
          href="${escapeHtml(dashboardUrl)}"
          style="display: inline-block; padding: 10px 14px; border-radius: 999px; background: #6A3291; color: #ffffff; text-decoration: none; font-weight: 600;"
        >
          View my submissions
        </a>
      </p>
      <p>We will review your submission and notify you of further updates.</p>
      <p style="margin-top: 16px;">&mdash; Editorial Office</p>
    </div>
  `;

  const text = [
    "Submission received",
    "",
    "Thank you for submitting your manuscript to UpDAYtes.",
    `Receipt code: ${receiptCode}`,
    `Submission ID: ${manuscript?.id}`,
    `Submitted at (UTC): ${submittedAtIso}`,
    `Status: ${manuscript?.status || "submitted"}`,
    `Title: ${title}`,
    authorNames ? `Authors: ${authorNames}` : null,
    "",
    `Track your submission: ${dashboardUrl}`,
    "",
    "Please keep this email for your records.",
    "",
    "- Editorial Office",
  ]
    .filter(Boolean)
    .join("\n");

  const providerResponse = await sendTransactionalEmail({
    to: toList,
    subject,
    html,
    text,
    tags: ["submission", "receipt"],
  });

  return {
    manuscriptId: manuscript?.id || null,
    receiptCode,
    submittedAt: submittedAtIso,
    recipients: toList,
    emailId: providerResponse?.messageId || providerResponse?.id || null,
  };
}
