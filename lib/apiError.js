function buildErrorId(scope = "APP") {
  const normalizedScope = String(scope || "APP")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "APP";

  const timePart = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${normalizedScope}-${timePart}-${randomPart}`;
}

export function logApiError(scope, err, meta = {}) {
  const errorId = buildErrorId(scope);
  console.error(`[${errorId}] ${scope}`, {
    message: err?.message || String(err),
    stack: err?.stack || null,
    meta,
  });
  return errorId;
}

export function respondWithApiError(res, status, scope, err, fallbackMessage, meta = {}) {
  const errorId = logApiError(scope, err, meta);
  return res.status(status).json({
    error: fallbackMessage || "Something went wrong.",
    errorId,
  });
}
