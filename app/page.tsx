/*// app/page.tsx
"use client";

import FileAttachment from "./components/FileAttachment";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import EditableBlock from "./components/EditableBlock";

const BRAND_PURPLE = "#6A3291";
const OWNER_EMAIL = "updaytesjournal@gmail.com";

type Issue = {
  id: string;
  title: string | null;
  volume: string | null;
  issue_number: number | null;
  published_at: string | null;
  cover_url: string | null;
};

type Article = {
  id: string;
  title: string | null;
  authors: string | null;
  manuscript_id?: string | null;
};

type ManualIssueArticle = {
  id: string;
  title: string;
  authors: string | null;
  href: string | null;
  article_id: string | null;
};

type ManualIssueArticleDraft = {
  title: string;
  authors: string;
  articleId: string;
  href: string;
};

type HomeIssueArticle = {
  key: string;
  title: string;
  authors: string | null;
  href: string | null;
  external: boolean;
  source: "live" | "manual" | "merged";
};

type HomeIssueFeedback = {
  type: "error" | "success";
  text: string;
};

const CURRENT_ISSUE_ARTICLES_KEY_PREFIX = "home.current_issue_articles";

function createManualIssueArticleId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `manual-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function currentIssueArticlesKey(issueId: string) {
  return `${CURRENT_ISSUE_ARTICLES_KEY_PREFIX}.${issueId}`;
}

function normalizeArticleString(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function optionalArticleString(value: string | null | undefined) {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed : null;
}

function articleFingerprint(title: string | null | undefined, authors: string | null | undefined) {
  const normalizedTitle = normalizeArticleString(title);
  const normalizedAuthors = normalizeArticleString(authors);

  if (!normalizedTitle && !normalizedAuthors) {
    return "";
  }

  return `${normalizedTitle}::${normalizedAuthors}`;
}

function parseManualIssueArticles(raw: unknown): ManualIssueArticle[] {
  if (typeof raw !== "string" || !raw.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }

        const record = entry as Record<string, unknown>;
        const id = optionalArticleString(record.id as string | null | undefined);
        const title = String(record.title || "").trim();
        const authors = optionalArticleString(record.authors as string | null | undefined);
        const href = optionalArticleString(record.href as string | null | undefined);
        const articleId = optionalArticleString(
          record.article_id as string | null | undefined
        );

        if (!id && !title && !href && !articleId) {
          return null;
        }

        return {
          id: id || createManualIssueArticleId(),
          title,
          authors,
          href,
          article_id: articleId,
        };
      })
      .filter((entry): entry is ManualIssueArticle => Boolean(entry));
  } catch (err) {
    console.error("Could not parse manual current-issue articles:", err);
    return [];
  }
}

function mergeCurrentIssueArticles(
  liveArticles: Article[],
  manualArticles: ManualIssueArticle[]
): HomeIssueArticle[] {
  const merged: HomeIssueArticle[] = [];
  const usedLiveIds = new Set<string>();
  const usedFingerprints = new Set<string>();

  manualArticles.forEach((manualEntry, index) => {
    const manualArticleId = optionalArticleString(manualEntry.article_id);
    const manualHref = optionalArticleString(manualEntry.href);
    const manualTitle = String(manualEntry.title || "").trim();
    const manualAuthors = optionalArticleString(manualEntry.authors);
    const manualPrint = articleFingerprint(manualTitle, manualAuthors);

    let matchedLive: Article | null = null;

    for (const liveArticle of liveArticles) {
      if (usedLiveIds.has(liveArticle.id)) {
        continue;
      }

      if (manualArticleId && liveArticle.id === manualArticleId) {
        matchedLive = liveArticle;
        break;
      }

      if (
        manualPrint &&
        articleFingerprint(liveArticle.title, liveArticle.authors) === manualPrint
      ) {
        matchedLive = liveArticle;
        break;
      }
    }

    if (matchedLive?.id) {
      usedLiveIds.add(matchedLive.id);
    }

    const title =
      manualTitle ||
      optionalArticleString(matchedLive?.title) ||
      "Untitled article";
    const authors = manualAuthors ?? optionalArticleString(matchedLive?.authors);
    const href = manualHref || (matchedLive?.id ? `/article/${matchedLive.id}` : null);
    const fingerprint = articleFingerprint(title, authors);

    if (fingerprint) {
      usedFingerprints.add(fingerprint);
    }

    merged.push({
      key: `manual-${manualEntry.id || index}`,
      title,
      authors,
      href,
      external: Boolean(href && /^https?:\/\//i.test(href)),
      source: matchedLive ? "merged" : "manual",
    });
  });

  liveArticles.forEach((liveArticle) => {
    if (usedLiveIds.has(liveArticle.id)) {
      return;
    }

    const fingerprint = articleFingerprint(liveArticle.title, liveArticle.authors);
    if (fingerprint && usedFingerprints.has(fingerprint)) {
      return;
    }

    if (fingerprint) {
      usedFingerprints.add(fingerprint);
    }

    merged.push({
      key: `live-${liveArticle.id}`,
      title: optionalArticleString(liveArticle.title) || "Untitled article",
      authors: optionalArticleString(liveArticle.authors),
      href: `/article/${liveArticle.id}`,
      external: false,
      source: "live",
    });
  });

  return merged;
}

export default function HomePage() {
  const [issue, setIssue] = useState<Issue | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  const [isOwner, setIsOwner] = useState(false);

  // -------------------------------------------------- 
  // Auth + ownership check (FIXED)                     
  // -------------------------------------------------- 
  useEffect(() => {
    let mounted = true;

    // Initial check
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setIsOwner(data?.user?.email === OWNER_EMAIL);
    });

    // React to auth changes (CRITICAL)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setIsOwner(session?.user?.email === OWNER_EMAIL);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // -------------------------------------------------- 
  // Load homepage data                                 
  // -------------------------------------------------- 
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data: issues } = await supabase
          .from("issues")
          .select("id, title, volume, issue_number, published_at, cover_url")
          .order("published_at", { ascending: false })
          .limit(1);

        if (!issues || issues.length === 0) return;
        if (cancelled) return;

        const latest = issues[0];
        setIssue(latest);

        const { data: articleRows } = await supabase
          .from("articles")
          .select("id, title, authors")
          .eq("issue_id", latest.id)
          .order("created_at", { ascending: true });

        if (!cancelled) {
          setArticles(articleRows || []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ background: "#ffffff", color: "#111827" }}>
      {// Editor-in-Chief /}
      <section
        style={{
          background: "#f9f5ff",
          borderTop: "1px solid #e5e7eb",
          borderBottom: "1px solid #e5e7eb",
          padding: "10px 0",
        }}
      >
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 20px" }}>
          <EditableBlock
            contentKey="home.editor_in_chief"
            isEditor={isOwner}
            placeholder="Editor-in-Chief: Prof. (Dr.) Satinath Mukhopadhyay"
          />
        </div>
      </section>

      {// Hero section }
      <section
        style={{
          maxWidth: 1120,
          margin: "16px auto 32px auto",
          padding: "0 20px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1.5fr",
            gap: 32,
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: BRAND_PURPLE,
                marginBottom: 10,
              }}
            >
              Featured
            </div>

            <EditableBlock
              contentKey="home.hero_title"
              isEditor={isOwner}
              placeholder="Advancing knowledge, awareness, understanding of metabolic health..."
            />

            <EditableBlock
              contentKey="home.hero_subtitle"
              isEditor={isOwner}
              placeholder="UpDAYtes brings together peer-reviewed research and clinical perspectives."
            />

           <div style={{ marginTop: 18, display: "flex", gap: 12 }}>
  <Link
    href="/author/submit"
    style={{
      background: BRAND_PURPLE,
      color: "white",
      padding: "10px 16px",
      borderRadius: 6,
      fontSize: 14,
      textDecoration: "none",
    }}
  >
    Submit an Article
  </Link>

  <Link
    href="/about"
    style={{
      padding: "10px 16px",
      borderRadius: 6,
      fontSize: 14,
      border: "1px solid #e5e7eb",
      textDecoration: "none",
      color: "#111827",
      background: "white",
    }}
  >
    About the Journal
  </Link>
</div>

          </div>

          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <img
              src="/Website Banner.jpg"
              alt="UpDAYtes banner"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        </div>
      </section>

      {// Current Issue }
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "0 20px" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>
          Current Issue
        </h2>

        {loading && <p>Loading…</p>}

        {!loading && issue && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "220px 1fr",
              gap: 28,
            }}
          >
            <img
              src="/journal cover.jpg"
              alt="Issue cover"
              style={{
                width: "100%",
                borderRadius: 6,
                border: "1px solid #e5e7eb",
              }}
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 14,
              }}
            >
              {articles.map((a) => (
                <Link
                  key={a.id}
                  href={`/article/${a.id}`}
                  style={{
                    textDecoration: "none",
                    border: "1px solid #e5e7eb",
                    borderRadius: 6,
                    padding: 12,
                    background: "white",
                  }}
                >
                  <h3 style={{ fontSize: 14, fontWeight: 700 }}>
                    {a.title || "Untitled article"}
                  </h3>
                  {a.authors && (
                    <p style={{ fontSize: 12, color: "#6b7280" }}>
                      {a.authors}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      <div style={{ height: 48 }} />
    </div>
  );
}
*/


// app/page.tsx
"use client";

import FileAttachment from "./components/FileAttachment";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import EditableBlock from "./components/EditableBlock";

const BRAND_PURPLE = "#6A3291";
const OWNER_EMAIL = "updaytesjournal@gmail.com";

type Issue = {
  id: string;
  title: string | null;
  volume: string | null;
  issue_number: number | null;
  published_at: string | null;
  cover_url: string | null;
  pdf_path?: string | null;
};

type Article = {
  id: string;
  title: string | null;
  authors: string | null;
  manuscript_id?: string | null;
};

type ManuscriptOption = {
  id: string;
  title: string | null;
  authors: string | null;
  status: string | null;
  created_at: string | null;
};

type ManualIssueArticle = {
  id: string;
  title: string;
  authors: string | null;
  href: string | null;
  article_id: string | null;
};

type ManualIssueArticleDraft = {
  title: string;
  authors: string;
  articleId: string;
  href: string;
};

type HomeIssueArticle = {
  key: string;
  title: string;
  authors: string | null;
  href: string | null;
  external: boolean;
  source: "live" | "manual" | "merged";
};

type HomeIssueFeedback = {
  type: "error" | "success";
  text: string;
};

const CURRENT_ISSUE_ARTICLES_KEY_PREFIX = "home.current_issue_articles";

function createManualIssueArticleId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `manual-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function currentIssueArticlesKey(issueId: string) {
  return `${CURRENT_ISSUE_ARTICLES_KEY_PREFIX}.${issueId}`;
}

function normalizeArticleString(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function optionalArticleString(value: string | null | undefined) {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed : null;
}

function articleFingerprint(
  title: string | null | undefined,
  authors: string | null | undefined
) {
  const normalizedTitle = normalizeArticleString(title);
  const normalizedAuthors = normalizeArticleString(authors);

  if (!normalizedTitle && !normalizedAuthors) {
    return "";
  }

  return `${normalizedTitle}::${normalizedAuthors}`;
}

function parseManualIssueArticles(raw: unknown): ManualIssueArticle[] {
  if (typeof raw !== "string" || !raw.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }

        const record = entry as Record<string, unknown>;
        const id = optionalArticleString(record.id as string | null | undefined);
        const title = String(record.title || "").trim();
        const authors = optionalArticleString(record.authors as string | null | undefined);
        const href = optionalArticleString(record.href as string | null | undefined);
        const articleId = optionalArticleString(
          record.article_id as string | null | undefined
        );

        if (!id && !title && !href && !articleId) {
          return null;
        }

        return {
          id: id || createManualIssueArticleId(),
          title,
          authors,
          href,
          article_id: articleId,
        };
      })
      .filter((entry): entry is ManualIssueArticle => Boolean(entry));
  } catch (err) {
    console.error("Could not parse manual current-issue articles:", err);
    return [];
  }
}

function mergeCurrentIssueArticles(
  liveArticles: Article[],
  manualArticles: ManualIssueArticle[]
): HomeIssueArticle[] {
  const merged: HomeIssueArticle[] = [];
  const usedLiveIds = new Set<string>();
  const usedFingerprints = new Set<string>();

  manualArticles.forEach((manualEntry, index) => {
    const manualArticleId = optionalArticleString(manualEntry.article_id);
    const manualHref = optionalArticleString(manualEntry.href);
    const manualTitle = String(manualEntry.title || "").trim();
    const manualAuthors = optionalArticleString(manualEntry.authors);
    const manualPrint = articleFingerprint(manualTitle, manualAuthors);

    let matchedLive: Article | null = null;

    for (const liveArticle of liveArticles) {
      if (usedLiveIds.has(liveArticle.id)) {
        continue;
      }

      if (manualArticleId && liveArticle.id === manualArticleId) {
        matchedLive = liveArticle;
        break;
      }

      if (
        manualPrint &&
        articleFingerprint(liveArticle.title, liveArticle.authors) === manualPrint
      ) {
        matchedLive = liveArticle;
        break;
      }
    }

    if (matchedLive?.id) {
      usedLiveIds.add(matchedLive.id);
    }

    const title =
      manualTitle || optionalArticleString(matchedLive?.title) || "Untitled article";
    const authors = manualAuthors ?? optionalArticleString(matchedLive?.authors);
    const href = manualHref || (matchedLive?.id ? `/article/${matchedLive.id}` : null);
    const fingerprint = articleFingerprint(title, authors);

    if (fingerprint) {
      usedFingerprints.add(fingerprint);
    }

    merged.push({
      key: `manual-${manualEntry.id || index}`,
      title,
      authors,
      href,
      external: Boolean(href && /^https?:\/\//i.test(href)),
      source: matchedLive ? "merged" : "manual",
    });
  });

  liveArticles.forEach((liveArticle) => {
    if (usedLiveIds.has(liveArticle.id)) {
      return;
    }

    const fingerprint = articleFingerprint(liveArticle.title, liveArticle.authors);
    if (fingerprint && usedFingerprints.has(fingerprint)) {
      return;
    }

    if (fingerprint) {
      usedFingerprints.add(fingerprint);
    }

    merged.push({
      key: `live-${liveArticle.id}`,
      title: optionalArticleString(liveArticle.title) || "Untitled article",
      authors: optionalArticleString(liveArticle.authors),
      href: `/article/${liveArticle.id}`,
      external: false,
      source: "live",
    });
  });

  return merged;
}

export default function HomePage() {
  const [issue, setIssue] = useState<Issue | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [manualArticles, setManualArticles] = useState<ManualIssueArticle[]>([]);
  const [manuscriptOptions, setManuscriptOptions] = useState<ManuscriptOption[]>(
    []
  );
  const [loading, setLoading] = useState(true);

  const [isOwner, setIsOwner] = useState(false);

  const [coverSrc, setCoverSrc] = useState<string | null>(null);
  const [coverIsPdf, setCoverIsPdf] = useState(false);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [manualDraft, setManualDraft] = useState<ManualIssueArticleDraft>({
    title: "",
    authors: "",
    articleId: "",
    href: "",
  });
  const [manualSaving, setManualSaving] = useState(false);
  const [manualFeedback, setManualFeedback] = useState<HomeIssueFeedback | null>(
    null
  );
  const [attachQuery, setAttachQuery] = useState("");
  const [attachLoading, setAttachLoading] = useState(false);
  const [attachSavingId, setAttachSavingId] = useState<string | null>(null);
  const [attachFeedback, setAttachFeedback] =
    useState<HomeIssueFeedback | null>(null);

  const handleBannerChange = useCallback(
    (url: string | null) => {
      setBannerUrl(url);
    },
    []
  );

  const resolveCoverFromIssue = useCallback(
    (latest: Issue | null) => {
      if (!latest) {
        setCoverSrc(null);
        setCoverIsPdf(false);
        return;
      }

      if (latest.cover_url) {
        setCoverSrc(latest.cover_url);
        setCoverIsPdf(false);
        return;
      }

      if (latest.pdf_path) {
        const raw = latest.pdf_path as string;

        // If pdf_path is already a URL, just use it
        if (raw.startsWith("http")) {
          setCoverSrc(raw + "#page=1");
          setCoverIsPdf(true);
          return;
        }

        try {
          const { data: publicData } = supabase.storage
            .from("instructions-pdfs")
            .getPublicUrl(raw);

          if (publicData?.publicUrl) {
            setCoverSrc(publicData.publicUrl + "#page=1");
            setCoverIsPdf(true);
          } else {
            setCoverSrc(null);
            setCoverIsPdf(false);
          }
        } catch (err) {
          console.error("Could not resolve pdf public URL:", err);
          setCoverSrc(null);
          setCoverIsPdf(false);
        }

        return;
      }

      setCoverSrc(null);
      setCoverIsPdf(false);
    },
    []
  );

  /* ---------------- Auth + ownership ---------------- */
  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setIsOwner(data?.user?.email === OWNER_EMAIL);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setIsOwner(session?.user?.email === OWNER_EMAIL);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!isOwner) {
      setManuscriptOptions([]);
      setAttachFeedback(null);
      setAttachQuery("");
      return;
    }

    (async () => {
      try {
        setAttachLoading(true);

        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;

        if (!token) {
          throw new Error("Please sign in again to load available submissions.");
        }

        const resp = await fetch("/api/admin/list-manuscripts", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          throw new Error(json?.error || "Failed to load existing submissions.");
        }

        if (!cancelled) {
          setManuscriptOptions((json?.manuscripts || []) as ManuscriptOption[]);
        }
      } catch (err) {
        console.error("Homepage manuscript options load failed:", err);
        if (!cancelled) {
          setAttachFeedback({
            type: "error",
            text:
              err instanceof Error
                ? err.message
                : "Could not load existing submissions.",
          });
        }
      } finally {
        if (!cancelled) {
          setAttachLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOwner]);

  /* ---------------- Load homepage data ---------------- */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);

        const [issueResp, siteContentResp] = await Promise.all([
          fetch("/api/issues/latest"),
          fetch("/api/site-content/get"),
        ]);

        const json = await issueResp.json().catch(() => ({}));

        if (!issueResp.ok) {
          throw new Error(json?.error || "Failed to load latest issue");
        }

        const latest = (json?.issue || null) as Issue | null;
        const articleRows = (json?.articles || []) as Article[];
        let manualRows: ManualIssueArticle[] = [];

        if (siteContentResp.ok) {
          const siteContentJson = await siteContentResp.json().catch(() => ({}));
          if (latest?.id) {
            manualRows = parseManualIssueArticles(
              siteContentJson?.[currentIssueArticlesKey(latest.id)]
            );
          }
        } else {
          const siteContentJson = await siteContentResp.json().catch(() => ({}));
          console.warn(
            "Could not load homepage manual issue articles:",
            siteContentJson?.error || siteContentResp.statusText
          );
        }

        if (cancelled) return;

        setIssue(latest);
        setArticles(articleRows);
        setManualArticles(manualRows);
        setManualFeedback(null);
        resolveCoverFromIssue(latest);
      } catch (err) {
        console.error("HomePage load error:", err);
        if (!cancelled) {
          setIssue(null);
          setArticles([]);
          setManualArticles([]);
          resolveCoverFromIssue(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [resolveCoverFromIssue]);

  const handleIssueCoverChange = useCallback(
    async (url: string | null) => {
      // Update UI immediately
      if (url) {
        setCoverSrc(url);
        setCoverIsPdf(false);
      } else {
        resolveCoverFromIssue(issue ? { ...issue, cover_url: null } : null);
      }

      if (!issue?.id) return;

      // Avoid spamming updates when FileAttachment is just hydrating state
      const current = issue.cover_url ?? null;
      if (url === current) return;

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;

        if (!token) {
          console.warn("No auth token found for cover update");
          return;
        }

        const resp = await fetch(`/api/issues/${issue.id}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ cover_url: url }),
        });

        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          throw new Error(json?.error || "Failed to update issue cover");
        }

        setIssue((prev) => (prev ? { ...prev, cover_url: url } : prev));
      } catch (err) {
        console.error("Issue cover update failed:", err);
      }
    },
    [issue, resolveCoverFromIssue]
  );

  const persistManualArticles = useCallback(
    async (nextManualArticles: ManualIssueArticle[]) => {
      if (!issue?.id) {
        throw new Error("No current issue is available.");
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("Please sign in again to manage current-issue articles.");
      }

      const resp = await fetch("/api/site-content/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          key: currentIssueArticlesKey(issue.id),
          value: JSON.stringify(nextManualArticles),
        }),
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(json?.error || "Failed to save manual article entries.");
      }
    },
    [issue]
  );

  const handleAddManualArticle = async () => {
    const title = String(manualDraft.title || "").trim();
    const authors = optionalArticleString(manualDraft.authors);
    const articleId = optionalArticleString(manualDraft.articleId);
    const href = optionalArticleString(manualDraft.href);

    if (!title && !articleId && !href) {
      setManualFeedback({
        type: "error",
        text: "Enter a title, article id, or link URL before adding an article card.",
      });
      return;
    }

    const duplicateFingerprint = articleFingerprint(title, authors);
    const hasDuplicate = manualArticles.some((entry) => {
      const entryArticleId = optionalArticleString(entry.article_id);
      const entryHref = optionalArticleString(entry.href);
      const entryFingerprint = articleFingerprint(entry.title, entry.authors);

      return Boolean(
        (articleId && entryArticleId === articleId) ||
          (href && entryHref === href) ||
          (duplicateFingerprint && entryFingerprint === duplicateFingerprint)
      );
    });

    if (hasDuplicate) {
      setManualFeedback({
        type: "error",
        text: "A matching manual article entry already exists for this issue.",
      });
      return;
    }

    const nextManualArticles = [
      ...manualArticles,
      {
        id: createManualIssueArticleId(),
        title,
        authors,
        href,
        article_id: articleId,
      },
    ];

    try {
      setManualSaving(true);
      await persistManualArticles(nextManualArticles);
      setManualArticles(nextManualArticles);
      setManualDraft({
        title: "",
        authors: "",
        articleId: "",
        href: "",
      });
      setManualFeedback({
        type: "success",
        text: "Manual article entry saved. Matching live articles will be merged automatically.",
      });
    } catch (err) {
      console.error("Manual homepage article save failed:", err);
      setManualFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Could not save the manual article entry.",
      });
    } finally {
      setManualSaving(false);
    }
  };

  const handleRemoveManualArticle = async (manualId: string) => {
    const nextManualArticles = manualArticles.filter((entry) => entry.id !== manualId);

    try {
      setManualSaving(true);
      await persistManualArticles(nextManualArticles);
      setManualArticles(nextManualArticles);
      setManualFeedback({
        type: "success",
        text: "Manual article entry removed.",
      });
    } catch (err) {
      console.error("Manual homepage article removal failed:", err);
      setManualFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Could not remove the manual article entry.",
      });
    } finally {
      setManualSaving(false);
    }
  };

  const attachedManuscriptIds = useMemo(() => {
    const ids = articles
      .map((article) => optionalArticleString(article.manuscript_id))
      .filter((value): value is string => Boolean(value));

    return new Set(ids);
  }, [articles]);

  const visibleManuscriptOptions = useMemo(() => {
    const normalizedQuery = normalizeArticleString(attachQuery);

    return manuscriptOptions
      .filter((option) => !attachedManuscriptIds.has(option.id))
      .filter((option) => {
        if (!normalizedQuery) {
          return true;
        }

        const haystack = [
          option.id,
          option.title,
          option.authors,
          option.status,
        ]
          .map((value) => normalizeArticleString(value))
          .join(" ");

        return haystack.includes(normalizedQuery);
      })
      .slice(0, normalizedQuery ? 8 : 6);
  }, [attachQuery, attachedManuscriptIds, manuscriptOptions]);

  const handleAttachManuscript = async (manuscriptId: string) => {
    if (!issue?.id) {
      setAttachFeedback({
        type: "error",
        text: "No current issue is available.",
      });
      return;
    }

    try {
      setAttachSavingId(manuscriptId);
      setAttachFeedback(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("Please sign in again to manage current-issue articles.");
      }

      const resp = await fetch(`/api/issues/${issue.id}/attach-article`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ manuscript_id: manuscriptId }),
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(json?.error || "Failed to attach the submission.");
      }

      const attachedArticle = (json?.article || null) as Article | null;
      if (attachedArticle?.id) {
        setArticles((prev) => {
          const next = [...prev];
          const existingIndex = next.findIndex(
            (article) =>
              article.id === attachedArticle.id ||
              (attachedArticle.manuscript_id &&
                optionalArticleString(article.manuscript_id) ===
                  optionalArticleString(attachedArticle.manuscript_id))
          );

          if (existingIndex >= 0) {
            next[existingIndex] = {
              ...next[existingIndex],
              ...attachedArticle,
            };
            return next;
          }

          return [...next, attachedArticle];
        });
      }

      setAttachFeedback({
        type: "success",
        text: json?.created
          ? "Submission attached to the current issue."
          : "That submission was already attached to the current issue.",
      });
      setAttachQuery("");
    } catch (err) {
      console.error("Attach current-issue article failed:", err);
      setAttachFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Could not attach the submission to the issue.",
      });
    } finally {
      setAttachSavingId(null);
    }
  };

  const heroShowPdf = !bannerUrl && coverIsPdf && !!coverSrc;
  const heroImageSrc =
    bannerUrl || (!coverIsPdf ? coverSrc : null) || "/Website Banner.jpg";
  const currentIssueArticles = mergeCurrentIssueArticles(articles, manualArticles);

  return (
    <div className="home-page">
      {/* Editor-in-Chief */}
      <section className="home-eic">
        <div className="home-eic__inner">
          <EditableBlock
            contentKey="home.editor_in_chief"
            isEditor={isOwner}
            placeholder="Editor-in-Chief: Prof. (Dr.) Satinath Mukhopadhyay"
          />
        </div>
      </section>

      {/* Hero section */}
      <section className="home-hero">
        <div className="home-hero__card">
          <div className="home-hero__grid">
            <div className="home-hero__content">
              <div className="home-eyebrow">Featured</div>

              <div className="home-hero__title">
                <EditableBlock
                  contentKey="home.hero_title"
                  isEditor={isOwner}
                  placeholder="Advancing knowledge, awareness..."
                />
              </div>

              <div className="home-hero__subtitle">
                <EditableBlock
                  contentKey="home.hero_subtitle"
                  isEditor={isOwner}
                  placeholder="UpDAYtes brings together peer-reviewed research..."
                />
              </div>

              <div className="home-hero__actions">
                <Link href="/author/submit" className="home-btn home-btn--primary">
                  Submit an Article
                </Link>

                <Link href="/about" className="home-btn home-btn--ghost">
                  About the Journal
                </Link>
              </div>
            </div>

            <div className="home-hero__media">
              <div className="home-banner">
                {heroShowPdf ? (
                  <object
                    data={coverSrc ?? undefined}
                    type="application/pdf"
                    className="home-banner__pdf"
                  >
                    <a href={coverSrc ?? "#"} target="_blank" rel="noreferrer">
                      View issue PDF
                    </a>
                  </object>
                ) : (
                  <img
                    src={heroImageSrc}
                    alt="Banner"
                    className="home-banner__image"
                  />
                )}

                <div className="home-banner__controls">
                  <FileAttachment
                    contentKey="home.banner"
                    isEditor={isOwner}
                    bucketName="cms-media"
                    accept="image/*"
                    hidePreview
                    onFileChange={handleBannerChange}
                    containerStyle={{
                      marginTop: 0,
                      display: isOwner ? "block" : "none",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Current Issue */}
      <section className="home-issue">
        <div className="home-issue__header">
          <h2>Current Issue</h2>
        </div>

        {loading && <p className="home-muted">Loading current issue…</p>}

        {!loading && !issue && (
          <p className="home-muted">No issue found yet.</p>
        )}

        {!loading && issue && (
          <div className="home-issue__grid">
            <div className="home-issue__cover">
              {coverSrc ? (
                coverIsPdf ? (
                  <object
                    data={coverSrc}
                    type="application/pdf"
                    className="home-banner__pdf"
                  >
                    <a href={coverSrc} target="_blank" rel="noreferrer">
                      View issue PDF
                    </a>
                  </object>
                ) : (
                  <img src={coverSrc} alt="Issue cover" />
                )
              ) : (
                <div className="home-muted">No cover yet.</div>
              )}

              {isOwner && (
                <FileAttachment
                  contentKey={`issue.${issue.id}.cover`}
                  isEditor={isOwner}
                  bucketName="cms-media"
                  accept="image/*"
                  hidePreview
                  onFileChange={(url) => handleIssueCoverChange(url)}
                  containerStyle={{ marginTop: 10 }}
                />
              )}
            </div>

            <div className="home-issue__content">
              {isOwner && (
                <div className="home-issue__owner-stack">
                  <div className="home-issue__owner-tools">
                    <div className="home-issue__owner-copy">
                      <h3>Attach Submission To Current Issue</h3>
                      <p>
                        This writes a real row to the <code>articles</code> table
                        for the current issue, so the homepage gets a normal
                        article link automatically.
                      </p>
                    </div>

                    <div className="home-issue__attach-search">
                      <input
                        type="text"
                        placeholder="Search submissions by title, author, status, or id"
                        value={attachQuery}
                        onChange={(event) => setAttachQuery(event.target.value)}
                      />
                    </div>

                    {attachFeedback && (
                      <p
                        className={`home-issue__owner-feedback home-issue__owner-feedback--${attachFeedback.type}`}
                      >
                        {attachFeedback.text}
                      </p>
                    )}

                    <div className="home-issue__attach-results">
                      {attachLoading ? (
                        <p className="home-muted">
                          Loading available submissions...
                        </p>
                      ) : visibleManuscriptOptions.length > 0 ? (
                        visibleManuscriptOptions.map((option) => (
                          <div
                            key={option.id}
                            className="home-issue__attach-card"
                          >
                            <div className="home-issue__attach-copy">
                              <strong>{option.title || "Untitled submission"}</strong>
                              {option.authors && <p>{option.authors}</p>}
                              <div className="home-issue__attach-meta">
                                <span>{option.id}</span>
                                {option.status && (
                                  <span className="home-issue__attach-pill">
                                    {option.status}
                                  </span>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              className="home-issue__attach-button"
                              onClick={() => {
                                void handleAttachManuscript(option.id);
                              }}
                              disabled={attachSavingId === option.id}
                            >
                              {attachSavingId === option.id
                                ? "Attaching..."
                                : "Attach"}
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="home-muted">
                          {attachQuery.trim()
                            ? "No matching submissions available to attach."
                            : "No unattached submissions available right now."}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="home-issue__owner-tools">
                    <div className="home-issue__owner-copy">
                      <h3>Article Visibility Override</h3>
                      <p>
                        Use this only when you need a temporary display card.
                        Matching title/authors or article id merges with live
                        articles so duplicates do not render twice.
                      </p>
                    </div>

                    <div className="home-issue__owner-form">
                      <input
                        type="text"
                        placeholder="Article title"
                        value={manualDraft.title}
                        onChange={(event) =>
                          setManualDraft((prev) => ({
                            ...prev,
                            title: event.target.value,
                          }))
                        }
                      />
                      <input
                        type="text"
                        placeholder="Authors"
                        value={manualDraft.authors}
                        onChange={(event) =>
                          setManualDraft((prev) => ({
                            ...prev,
                            authors: event.target.value,
                          }))
                        }
                      />
                      <input
                        type="text"
                        placeholder="Article ID (optional)"
                        value={manualDraft.articleId}
                        onChange={(event) =>
                          setManualDraft((prev) => ({
                            ...prev,
                            articleId: event.target.value,
                          }))
                        }
                      />
                      <input
                        type="url"
                        placeholder="Link URL (optional)"
                        value={manualDraft.href}
                        onChange={(event) =>
                          setManualDraft((prev) => ({
                            ...prev,
                            href: event.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="home-issue__owner-submit"
                        onClick={() => {
                          void handleAddManualArticle();
                        }}
                        disabled={manualSaving}
                      >
                        {manualSaving ? "Saving..." : "Add Article Card"}
                      </button>
                    </div>

                    {manualFeedback && (
                      <p
                        className={`home-issue__owner-feedback home-issue__owner-feedback--${manualFeedback.type}`}
                      >
                        {manualFeedback.text}
                      </p>
                    )}

                    {manualArticles.length > 0 && (
                      <div className="home-issue__owner-list">
                        {manualArticles.map((entry) => (
                          <div key={entry.id} className="home-issue__owner-chip">
                            <div>
                              <strong>{entry.title || "Manual article"}</strong>
                              {entry.authors && <span>{entry.authors}</span>}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                void handleRemoveManualArticle(entry.id);
                              }}
                              disabled={manualSaving}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="home-issue__list">
                {currentIssueArticles.length > 0 ? (
                  currentIssueArticles.map((article) => {
                    const articleCard = (
                      <>
                        <div className="home-article__header">
                          <h3>{article.title}</h3>
                          {article.source !== "live" && (
                            <span className="home-article__badge">
                              {article.source === "manual" ? "Manual" : "Merged"}
                            </span>
                          )}
                        </div>
                        {article.authors && <p>{article.authors}</p>}
                      </>
                    );

                    if (!article.href) {
                      return (
                        <div
                          key={article.key}
                          className="home-article home-article--static"
                        >
                          {articleCard}
                        </div>
                      );
                    }

                    if (article.external) {
                      return (
                        <a
                          key={article.key}
                          href={article.href}
                          target="_blank"
                          rel="noreferrer"
                          className="home-article"
                        >
                          {articleCard}
                        </a>
                      );
                    }

                    return (
                      <Link
                        key={article.key}
                        href={article.href}
                        className="home-article"
                      >
                        {articleCard}
                      </Link>
                    );
                  })
                ) : (
                  <p className="home-muted">No articles added to this issue yet.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      <div className="home-spacer" />
    </div>
  );
}
