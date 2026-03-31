import { supabaseServer } from "./supabaseServer";

export async function getSiteContentEntries(keys = []) {
  const requestedKeys = Array.from(
    new Set(
      (Array.isArray(keys) ? keys : [keys])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );

  if (!requestedKeys.length) {
    return {};
  }

  const { data, error } = await supabaseServer
    .from("site_content")
    .select("key, value")
    .in("key", requestedKeys);

  if (error) {
    console.error("Could not load site content entries:", error);
    return {};
  }

  return (data || []).reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

export async function getLatestIssueWithArticles() {
  const { data: issues, error: issueError } = await supabaseServer
    .from("issues")
    .select("id, title, volume, issue_number, published_at, cover_url, pdf_path")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1);

  if (issueError) {
    throw issueError;
  }

  const issue = issues?.[0] || null;
  if (!issue?.id) {
    return { issue: null, articles: [] };
  }

  const { data: articles, error: articleError } = await supabaseServer
    .from("articles")
    .select("id, title, abstract, authors, pdf_path, manuscript_id, issue_id, created_at")
    .eq("issue_id", issue.id)
    .order("created_at", { ascending: true });

  if (articleError) {
    throw articleError;
  }

  return { issue, articles: articles || [] };
}

export async function getIssueWithArticles(issueId) {
  if (!issueId) {
    return { issue: null, articles: [] };
  }

  const { data: issue, error: issueError } = await supabaseServer
    .from("issues")
    .select("id, title, volume, issue_number, published_at, cover_url, pdf_path")
    .eq("id", issueId)
    .maybeSingle();

  if (issueError) {
    throw issueError;
  }

  if (!issue) {
    return { issue: null, articles: [] };
  }

  const { data: articles, error: articleError } = await supabaseServer
    .from("articles")
    .select("id, title, abstract, authors, pdf_path, manuscript_id, issue_id, created_at")
    .eq("issue_id", issueId)
    .order("created_at", { ascending: true });

  if (articleError) {
    throw articleError;
  }

  return { issue, articles: articles || [] };
}

export async function getArticleWithIssue(articleId) {
  if (!articleId) {
    return { article: null, issue: null };
  }

  const { data: article, error: articleError } = await supabaseServer
    .from("articles")
    .select("id, title, abstract, authors, pdf_path, manuscript_id, issue_id, created_at")
    .eq("id", articleId)
    .maybeSingle();

  if (articleError) {
    throw articleError;
  }

  if (!article) {
    return { article: null, issue: null };
  }

  const { data: issue, error: issueError } = await supabaseServer
    .from("issues")
    .select("id, title, volume, issue_number, published_at, cover_url, pdf_path")
    .eq("id", article.issue_id)
    .maybeSingle();

  if (issueError) {
    throw issueError;
  }

  return { article, issue: issue || null };
}

export function formatAuthors(raw) {
  if (!raw) return "";

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => {
          if (!item) return "";
          if (typeof item === "string") return item;
          if (typeof item === "object") return item.name || item.email || "";
          return "";
        })
        .filter(Boolean)
        .join(", ");
    }
  } catch {
    // authors may already be stored as text
  }

  return String(raw);
}

export async function getCmsPageBySlug(slug) {
  if (!slug) return null;

  const { data, error } = await supabaseServer
    .from("cms_pages")
    .select("slug, title, content")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

export async function getArchiveIssues() {
  const { data, error } = await supabaseServer
    .from("issues")
    .select("*")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map((row) => {
    const published = row.published_at ? new Date(row.published_at) : null;

    return {
      id: row.id,
      year: published ? published.getFullYear() : null,
      volume: row.volume ?? null,
      issue_number: row.issue_number ?? null,
      month: published
        ? published.toLocaleDateString("en-US", { month: "long" })
        : null,
      supplement: null,
      type: "-",
      title: row.title ?? null,
      category: "Main Issue",
    };
  });
}
