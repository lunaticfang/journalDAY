import {
  assertTransactionalEmailConfigured,
  sendTransactionalEmail,
} from "./transactionalEmail";
import {
  formatReviewDueDate,
  isPastReviewDueDate,
} from "./reviewerWorkflowShared";

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

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatReviewLabel(value) {
  return String(value || "pending")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function getManuscriptTitle(manuscript) {
  return manuscript?.title || "Untitled manuscript";
}

function getSubmissionUrl(req, manuscriptId) {
  return `${getAppBaseUrl(req)}/admin/submissions/${encodeURIComponent(
    manuscriptId
  )}`;
}

function getAuthorDashboardUrl(req) {
  return `${getAppBaseUrl(req)}/author/dashboard`;
}

export async function sendReviewerAssignmentEmail({
  recipient,
  manuscript,
  dueAt,
  req,
}) {
  assertTransactionalEmailConfigured();

  const title = getManuscriptTitle(manuscript);
  const dueLabel = formatReviewDueDate(dueAt);
  const reviewUrl = getSubmissionUrl(req, manuscript?.id);
  const subject = `Review request: ${title}`;

  const html = `
    <div style="font-family: Georgia, 'Times New Roman', serif; color: #1f2937;">
      <h2 style="color: #6A3291; margin-bottom: 12px;">Reviewer assignment</h2>
      <p>You have been assigned a manuscript for peer review in UpDAYtes.</p>
      <div style="margin: 18px 0; padding: 16px; border: 1px solid #e5d8f2; border-radius: 14px; background: #faf7fe;">
        <p style="margin: 0 0 10px;"><strong>Submission ID:</strong> ${escapeHtml(manuscript?.id)}</p>
        <p style="margin: 0 0 10px;"><strong>Title:</strong> ${escapeHtml(title)}</p>
        <p style="margin: 0;"><strong>Review due:</strong> ${escapeHtml(dueLabel)}</p>
      </div>
      <p>Sign in with your approved reviewer email to open the reviewer portal, access the protected files, and record your recommendation.</p>
      <p style="margin: 18px 0;">
        <a
          href="${escapeHtml(reviewUrl)}"
          style="display: inline-block; padding: 10px 14px; border-radius: 999px; background: #6A3291; color: #ffffff; text-decoration: none; font-weight: 600;"
        >
          Open reviewer portal
        </a>
      </p>
      <p style="margin-top: 16px;">&mdash; UpDAYtes Editorial Office</p>
    </div>
  `;

  const text = [
    "Reviewer assignment",
    "",
    "You have been assigned a manuscript for peer review in UpDAYtes.",
    `Submission ID: ${manuscript?.id}`,
    `Title: ${title}`,
    `Review due: ${dueLabel}`,
    "",
    "Sign in with your approved reviewer email to access the protected files and submit your recommendation.",
    "",
    `Open reviewer portal: ${reviewUrl}`,
    "",
    "- UpDAYtes Editorial Office",
  ].join("\n");

  return sendTransactionalEmail({
    to: [recipient],
    subject,
    html,
    text,
    tags: ["review", "assignment"],
  });
}

export async function sendReviewerReminderEmail({
  recipient,
  manuscript,
  dueAt,
  req,
}) {
  assertTransactionalEmailConfigured();

  const title = getManuscriptTitle(manuscript);
  const reviewUrl = getSubmissionUrl(req, manuscript?.id);
  const dueLabel = formatReviewDueDate(dueAt, { withTime: false });
  const overdue = isPastReviewDueDate(dueAt);
  const subject = overdue
    ? `Overdue review reminder: ${title}`
    : `Review reminder: ${title}`;

  const intro = overdue
    ? "This is a gentle reminder that your assigned review is now overdue."
    : "This is a gentle reminder that your assigned review is coming due soon.";

  const html = `
    <div style="font-family: Georgia, 'Times New Roman', serif; color: #1f2937;">
      <h2 style="color: #6A3291; margin-bottom: 12px;">Reviewer reminder</h2>
      <p>${escapeHtml(intro)}</p>
      <div style="margin: 18px 0; padding: 16px; border: 1px solid #e5d8f2; border-radius: 14px; background: #faf7fe;">
        <p style="margin: 0 0 10px;"><strong>Submission ID:</strong> ${escapeHtml(manuscript?.id)}</p>
        <p style="margin: 0 0 10px;"><strong>Title:</strong> ${escapeHtml(title)}</p>
        <p style="margin: 0;"><strong>Review due:</strong> ${escapeHtml(dueLabel)}</p>
      </div>
      <p>Please sign in to the reviewer portal to finish your recommendation and view the protected files.</p>
      <p style="margin: 18px 0;">
        <a
          href="${escapeHtml(reviewUrl)}"
          style="display: inline-block; padding: 10px 14px; border-radius: 999px; background: #6A3291; color: #ffffff; text-decoration: none; font-weight: 600;"
        >
          Return to reviewer portal
        </a>
      </p>
      <p style="margin-top: 16px;">&mdash; UpDAYtes Editorial Office</p>
    </div>
  `;

  const text = [
    "Reviewer reminder",
    "",
    intro,
    `Submission ID: ${manuscript?.id}`,
    `Title: ${title}`,
    `Review due: ${dueLabel}`,
    "",
    "Sign in to the reviewer portal to view the protected files and finish your recommendation.",
    "",
    `Return to reviewer portal: ${reviewUrl}`,
    "",
    "- UpDAYtes Editorial Office",
  ].join("\n");

  return sendTransactionalEmail({
    to: [recipient],
    subject,
    html,
    text,
    tags: ["review", "reminder"],
  });
}

export async function sendEditorReviewSubmittedEmail({
  recipients,
  manuscript,
  reviewerEmail,
  recommendation,
  req,
}) {
  assertTransactionalEmailConfigured();

  const title = getManuscriptTitle(manuscript);
  const reviewUrl = getSubmissionUrl(req, manuscript?.id);
  const recommendationLabel = formatReviewLabel(recommendation);
  const subject = `Review submitted: ${title}`;

  const html = `
    <div style="font-family: Georgia, 'Times New Roman', serif; color: #1f2937;">
      <h2 style="color: #6A3291; margin-bottom: 12px;">Review submitted</h2>
      <p>A reviewer has submitted a recommendation for a manuscript in UpDAYtes.</p>
      <div style="margin: 18px 0; padding: 16px; border: 1px solid #e5d8f2; border-radius: 14px; background: #faf7fe;">
        <p style="margin: 0 0 10px;"><strong>Submission ID:</strong> ${escapeHtml(manuscript?.id)}</p>
        <p style="margin: 0 0 10px;"><strong>Title:</strong> ${escapeHtml(title)}</p>
        <p style="margin: 0 0 10px;"><strong>Reviewer:</strong> ${escapeHtml(reviewerEmail || "Reviewer account")}</p>
        <p style="margin: 0;"><strong>Recommendation:</strong> ${escapeHtml(recommendationLabel)}</p>
      </div>
      <p style="margin: 18px 0;">
        <a
          href="${escapeHtml(reviewUrl)}"
          style="display: inline-block; padding: 10px 14px; border-radius: 999px; background: #6A3291; color: #ffffff; text-decoration: none; font-weight: 600;"
        >
          Open editorial case
        </a>
      </p>
      <p style="margin-top: 16px;">&mdash; UpDAYtes Editorial Office</p>
    </div>
  `;

  const text = [
    "Review submitted",
    "",
    "A reviewer has submitted a recommendation for a manuscript in UpDAYtes.",
    `Submission ID: ${manuscript?.id}`,
    `Title: ${title}`,
    `Reviewer: ${reviewerEmail || "Reviewer account"}`,
    `Recommendation: ${recommendationLabel}`,
    "",
    `Open editorial case: ${reviewUrl}`,
    "",
    "- UpDAYtes Editorial Office",
  ].join("\n");

  return sendTransactionalEmail({
    to: recipients,
    subject,
    html,
    text,
    tags: ["review", "decision"],
  });
}

export async function sendAuthorReviewFeedbackEmail({
  recipients,
  manuscript,
  recommendation,
  notes,
  req,
}) {
  assertTransactionalEmailConfigured();

  const title = getManuscriptTitle(manuscript);
  const dashboardUrl = getAuthorDashboardUrl(req);
  const recommendationLabel = formatReviewLabel(recommendation);
  const notesText = String(notes || "").trim();
  const subject = `Reviewer feedback received: ${title}`;

  const html = `
    <div style="font-family: Georgia, 'Times New Roman', serif; color: #1f2937;">
      <h2 style="color: #6A3291; margin-bottom: 12px;">Reviewer feedback received</h2>
      <p>Your manuscript has received reviewer feedback from the editorial process.</p>
      <div style="margin: 18px 0; padding: 16px; border: 1px solid #e5d8f2; border-radius: 14px; background: #faf7fe;">
        <p style="margin: 0 0 10px;"><strong>Submission ID:</strong> ${escapeHtml(manuscript?.id)}</p>
        <p style="margin: 0 0 10px;"><strong>Title:</strong> ${escapeHtml(title)}</p>
        <p style="margin: 0 0 10px;"><strong>Recommendation:</strong> ${escapeHtml(recommendationLabel)}</p>
        ${
          notesText
            ? `<p style="margin: 0;"><strong>Reviewer notes:</strong><br/>${escapeHtml(notesText).replace(/\n/g, "<br/>")}</p>`
            : "<p style=\"margin: 0;\"><strong>Reviewer notes:</strong> Not provided.</p>"
        }
      </div>
      <p>You can view your latest manuscript status and upload a revision from your dashboard.</p>
      <p style="margin: 18px 0;">
        <a
          href="${escapeHtml(dashboardUrl)}"
          style="display: inline-block; padding: 10px 14px; border-radius: 999px; background: #6A3291; color: #ffffff; text-decoration: none; font-weight: 600;"
        >
          Open author dashboard
        </a>
      </p>
      <p style="margin-top: 16px;">&mdash; UpDAYtes Editorial Office</p>
    </div>
  `;

  const text = [
    "Reviewer feedback received",
    "",
    "Your manuscript has received reviewer feedback from the editorial process.",
    `Submission ID: ${manuscript?.id}`,
    `Title: ${title}`,
    `Recommendation: ${recommendationLabel}`,
    `Reviewer notes: ${notesText || "Not provided."}`,
    "",
    `Open author dashboard: ${dashboardUrl}`,
    "",
    "- UpDAYtes Editorial Office",
  ].join("\n");

  return sendTransactionalEmail({
    to: recipients,
    subject,
    html,
    text,
    tags: ["review", "author-feedback"],
  });
}
