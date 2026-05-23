export const DEFAULT_REVIEW_DUE_DAYS = 14;
export const REVIEW_REMINDER_LEAD_DAYS = 2;
export const REVIEW_REMINDER_COOLDOWN_HOURS = 24;
export const REVIEW_WORKFLOW_REQUIRED_TABLE = "manuscript_reviews";
export const REVIEW_WORKFLOW_BOOTSTRAP_SQL = "db/admin_flow.sql";
export const REVIEW_WORKFLOW_METADATA_SQL = "db/reviewer_mail_phase1.sql";

const REVIEW_WORKFLOW_METADATA_COLUMNS = [
  "due_at",
  "invited_at",
  "last_reminder_at",
];

function getErrorMessage(err) {
  return String(err?.message || err || "").toLowerCase();
}

export function getReviewerWorkflowMigrationHint() {
  return `Run ${REVIEW_WORKFLOW_BOOTSTRAP_SQL} first, then ${REVIEW_WORKFLOW_METADATA_SQL} in Supabase SQL editor.`;
}

export function isReviewerWorkflowMissingTableError(err) {
  const message = getErrorMessage(err);
  if (!message) return false;

  return (
    message.includes(REVIEW_WORKFLOW_REQUIRED_TABLE) &&
    (message.includes("does not exist") ||
      message.includes("schema cache") ||
      message.includes("relation") ||
      message.includes("table"))
  );
}

export function isReviewerWorkflowMissingColumnError(err, columns = []) {
  const message = getErrorMessage(err);
  if (!message || !message.includes(REVIEW_WORKFLOW_REQUIRED_TABLE)) {
    return false;
  }

  return columns.some((column) => {
    const normalized = String(column || "").toLowerCase();
    return normalized && message.includes(normalized);
  });
}

function parseDate(value) {
  if (!value) return null;

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export function getDefaultReviewDueAt(baseDate = new Date()) {
  const base = parseDate(baseDate) || new Date();
  const due = new Date(base);
  due.setUTCDate(due.getUTCDate() + DEFAULT_REVIEW_DUE_DAYS);
  due.setUTCHours(23, 59, 59, 999);
  return due.toISOString();
}

export function getDefaultReviewDueDateInput(baseDate = new Date()) {
  return getDefaultReviewDueAt(baseDate).slice(0, 10);
}

export function normalizeReviewDueAtInput(
  value,
  { fallbackToDefault = true, baseDate = new Date() } = {}
) {
  const raw = String(value || "").trim();

  if (!raw) {
    return fallbackToDefault ? getDefaultReviewDueAt(baseDate) : null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return `${raw}T23:59:59.999Z`;
  }

  const parsed = parseDate(raw);
  if (!parsed) {
    return fallbackToDefault ? getDefaultReviewDueAt(baseDate) : null;
  }

  return parsed.toISOString();
}

export function formatReviewDueDate(value, options = {}) {
  const parsed = parseDate(value);
  if (!parsed) return "No due date";

  const { withTime = false } = options;

  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime
      ? {
          hour: "numeric",
          minute: "2-digit",
        }
      : {}),
  });
}

export function isPendingReview(review) {
  return !review?.recommendation && !review?.decided_at;
}

export function isPastReviewDueDate(value, now = Date.now()) {
  const due = parseDate(value);
  if (!due) return false;
  return due.getTime() < Number(now);
}

export function daysUntilReviewDue(value, now = Date.now()) {
  const due = parseDate(value);
  if (!due) return null;

  const diffMs = due.getTime() - Number(now);
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function isReviewerWorkflowMetadataMissingError(err) {
  const message = getErrorMessage(err);
  return (
    message.includes("manuscript_reviews") &&
    REVIEW_WORKFLOW_METADATA_COLUMNS.some((column) =>
      message.includes(`'${column}'`) || message.includes(column)
    )
  );
}
