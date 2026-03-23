function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function plainTextToParagraphs(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";

  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

export function siteContentValueToHtml(value, placeholder = "") {
  const fallbackHtml = placeholder ? plainTextToParagraphs(placeholder) : "";

  if (value == null) {
    return fallbackHtml;
  }

  let parsed = value;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return fallbackHtml;
    }

    try {
      parsed = JSON.parse(trimmed);
    } catch {
      if (trimmed.includes('"html":"')) {
        const idx = trimmed.indexOf('html":"') + 7;
        const extracted = trimmed.slice(idx).replace(/"+$/, "");
        parsed = { html: extracted };
      } else {
        parsed = trimmed;
      }
    }
  }

  if (typeof parsed === "string") {
    return plainTextToParagraphs(parsed) || fallbackHtml;
  }

  if (parsed && typeof parsed === "object") {
    if (typeof parsed.html === "string" && parsed.html.trim()) {
      return parsed.html;
    }

    if (typeof parsed.text === "string" && parsed.text.trim()) {
      return plainTextToParagraphs(parsed.text);
    }
  }

  return plainTextToParagraphs(String(parsed)) || fallbackHtml;
}
