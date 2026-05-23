"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { getCurrentClientAccess } from "../../../lib/clientPermissions";
import FileAttachment from "../../components/FileAttachment";

type Issue = {
  id: string;
  title: string | null;
  volume: string | null;
  issue_number: number | null;
  published_at: string | null;
  cover_url: string | null;
  pdf_path: string | null;
};

type Article = {
  id: string;
  issue_id: string | null;
  title: string | null;
  abstract: string | null;
  authors: string | null;
  pdf_path: string | null;
  manuscript_id?: string | null;
  created_at?: string | null;
};

type IssuePageClientProps = {
  initialIssue?: Issue | null;
  initialArticles?: Article[];
};

function formatAuthors(raw: string | null) {
  if (!raw) return "";

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => {
          if (!item) return "";
          if (typeof item === "string") return item;
          if (typeof item === "object") {
            return item.name || item.email || "";
          }
          return "";
        })
        .filter(Boolean)
        .join(", ");
    }
  } catch {
    // raw may already be plain text
  }

  return raw;
}

function parseAuthorNames(raw: string | null) {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => {
          if (!item) return "";
          if (typeof item === "string") return item.trim();
          if (typeof item === "object") {
            return String(item.name || item.email || "").trim();
          }
          return "";
        })
        .filter(Boolean);
    }
  } catch {
    // raw may be plain text
  }

  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildAuthorsPayload(leadAuthor: string, coAuthorsInput: string) {
  const lead = leadAuthor.trim();
  const coAuthors = coAuthorsInput
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const allNames = [lead, ...coAuthors].filter(Boolean);
  if (!allNames.length) {
    return null;
  }

  return allNames.map((name, index) => ({
    name,
    role: index === 0 ? "corresponding" : "coauthor",
  }));
}

export default function IssuePage({
  initialIssue = null,
  initialArticles = [],
}: IssuePageClientProps) {
  const params = useParams<{ id: string }>();
  const rawId = params?.id;
  const id =
    typeof rawId === "string"
      ? rawId
      : Array.isArray(rawId)
      ? rawId[0]
      : undefined;

  const initialIssueMatchesRoute =
    Boolean(initialIssue?.id) && Boolean(id) && initialIssue?.id === id;

  const [issue, setIssue] = useState<Issue | null>(
    initialIssueMatchesRoute ? initialIssue : null
  );
  const [articles, setArticles] = useState<Article[]>(
    initialIssueMatchesRoute ? initialArticles : []
  );
  const [loading, setLoading] = useState(!initialIssueMatchesRoute);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isEditor, setIsEditor] = useState(false);
  const [editingAuthorsArticleId, setEditingAuthorsArticleId] = useState<string | null>(null);
  const [authorLeadDraft, setAuthorLeadDraft] = useState("");
  const [authorCoDraft, setAuthorCoDraft] = useState("");
  const [authorSaveError, setAuthorSaveError] = useState<string | null>(null);
  const [authorSaving, setAuthorSaving] = useState(false);
  const [coverFeedback, setCoverFeedback] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);

  const handleIssueCoverChange = useCallback(
    async (url: string | null) => {
      if (!issue?.id) return;

      const nextCoverUrl = url || null;
      const previousCoverUrl = issue.cover_url ?? null;
      setCoverFeedback(null);
      setCoverError(null);

      setIssue((current) =>
        current ? { ...current, cover_url: nextCoverUrl } : current
      );

      if (nextCoverUrl === previousCoverUrl) {
        return;
      }

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;

        if (!token) {
          throw new Error("Please sign in again to update this issue cover.");
        }

        const resp = await fetch(`/api/issues/${issue.id}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ cover_url: nextCoverUrl }),
        });

        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          throw new Error(json?.error || "Could not update this issue cover.");
        }

        setCoverFeedback("Cover updated for this publication.");
      } catch (err) {
        console.error("Issue cover update error:", err);
        setIssue((current) =>
          current ? { ...current, cover_url: previousCoverUrl } : current
        );
        setCoverError(
          err instanceof Error ? err.message : "Could not update this issue cover."
        );
      }
    },
    [issue?.cover_url, issue?.id]
  );

  async function handleViewPdf(manuscriptId: string) {
    try {
      setPdfError(null);

      const resp = await fetch(`/api/submissions/${manuscriptId}/signed-url`);
      const json = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        throw new Error(json?.error || "Could not get article PDF.");
      }

      const url = json?.signedUrl || json?.publicUrl;
      if (!url) {
        throw new Error("No signed URL returned for this article.");
      }

      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("IssuePage handleViewPdf error:", err);
      setPdfError(
        err instanceof Error ? err.message : "Could not open the article PDF."
      );
    }
  }

  function startEditingAuthors(article: Article) {
    const names = parseAuthorNames(article.authors || null);
    const [lead = "", ...coAuthors] = names;

    setAuthorLeadDraft(lead);
    setAuthorCoDraft(coAuthors.join(", "));
    setAuthorSaveError(null);
    setEditingAuthorsArticleId(article.id);
  }

  async function handleSaveAuthors(articleId: string) {
    if (!issue?.id) return;

    try {
      setAuthorSaving(true);
      setAuthorSaveError(null);

      const payload = buildAuthorsPayload(authorLeadDraft, authorCoDraft);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("Please sign in again to update author details.");
      }

      const resp = await fetch(`/api/issues/${issue.id}/articles/${articleId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          authors: payload,
        }),
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(json?.error || "Could not update authors.");
      }

      const nextAuthors =
        Array.isArray(payload) && payload.length > 0 ? JSON.stringify(payload) : null;

      setArticles((prev) =>
        prev.map((article) =>
          article.id === articleId ? { ...article, authors: nextAuthors } : article
        )
      );
      setEditingAuthorsArticleId(null);
      setAuthorLeadDraft("");
      setAuthorCoDraft("");
    } catch (err) {
      console.error("IssuePage save authors error:", err);
      setAuthorSaveError(
        err instanceof Error ? err.message : "Could not update author details."
      );
    } finally {
      setAuthorSaving(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      const access = await getCurrentClientAccess(["admin", "editor"]);
      if (!mounted) return;
      setIsEditor(Boolean(access.allowed));
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!id) {
      setIssue(null);
      setArticles([]);
      setLoading(false);
      setErrorMsg("Invalid issue id.");
      return;
    }

    // Keep route data pinned to this issue id so previous covers never bleed through.
    if (initialIssue?.id === id) {
      setIssue(initialIssue);
      setArticles(initialArticles || []);
    } else {
      setIssue(null);
      setArticles([]);
    }
    setErrorMsg(null);

    let cancelled = false;

    (async () => {
      setLoading(true);

      try {
        const resp = await fetch(`/api/issues/${id}`, { cache: "no-store" });
        const json = await resp.json().catch(() => ({}));

        if (!resp.ok) {
          throw new Error(json?.error || "Failed to load publication.");
        }

        if (!cancelled) {
          const nextIssue = (json?.issue || null) as Issue | null;
          setIssue(nextIssue);
          setArticles((json?.articles || []) as Article[]);
        }
      } catch (err) {
        console.error("IssuePage load error:", err);
        if (!cancelled) {
          setErrorMsg(
            err instanceof Error ? err.message : "Could not load publication."
          );
          setIssue(null);
          setArticles([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, initialIssue, initialArticles]);

  const pubDate = issue?.published_at
    ? new Date(issue.published_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";
  const volumeIssueText = [
    issue?.volume ? `Volume ${issue.volume}` : null,
    issue?.issue_number != null ? `Issue ${issue.issue_number}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  if (loading) {
    return (
      <main className="publication-page">
        <div className="publication-shell">
          <div className="publication-state">Loading publication...</div>
        </div>
      </main>
    );
  }

  if (errorMsg || !issue) {
    return (
      <main className="publication-page">
        <div className="publication-shell">
          <div className="publication-back">
            <Link href="/archive">Back to Archive</Link>
          </div>
          <div className="publication-state publication-state--error">
            {errorMsg || "Publication not found."}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="publication-page">
      <div className="publication-shell">
        <div className="publication-back">
          <Link href="/archive">Back to Archive</Link>
          <Link href="/issues">Browse All Issues</Link>
        </div>

        <section className="publication-hero">
          <div className="publication-cover">
            {issue.cover_url ? (
              <img src={issue.cover_url} alt={issue.title || "Issue cover"} />
            ) : (
              <div className="publication-cover__fallback">No Cover</div>
            )}
            {isEditor && (
              <div className="publication-cover__admin">
                <span>Issue cover</span>
                <FileAttachment
                  contentKey={`issue.${issue.id}.cover`}
                  isEditor={isEditor}
                  bucketName="cms-media"
                  accept="image/*"
                  hidePreview
                  onFileChange={(url) => {
                    void handleIssueCoverChange(url);
                  }}
                  containerStyle={{ marginTop: 0 }}
                />
                {coverFeedback && (
                  <p className="publication-cover__message">
                    {coverFeedback}
                  </p>
                )}
                {coverError && (
                  <p className="publication-cover__message publication-cover__message--error">
                    {coverError}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="publication-hero__content">
            <div className="publication-eyebrow">Publication</div>
            <h1>{issue.title || "Untitled issue"}</h1>

            <div className="publication-meta">
              {pubDate && <span>{pubDate}</span>}
              {volumeIssueText && <span>{volumeIssueText}</span>}
              <span>{articles.length} article{articles.length === 1 ? "" : "s"}</span>
            </div>

            <div className="publication-actions">
              {issue.pdf_path && (
                <a
                  href={issue.pdf_path}
                  target="_blank"
                  rel="noreferrer"
                  className="publication-btn publication-btn--primary"
                >
                  Open Full Issue PDF
                </a>
              )}
              <Link
                href="/archive"
                className="publication-btn publication-btn--ghost"
              >
                View Archive
              </Link>
            </div>
          </div>
        </section>

        <section className="publication-panel">
          <div className="publication-panel__head">
            <div>
              <h2>Articles In This Publication</h2>
              <p>Open the article page or view the PDF directly.</p>
            </div>
          </div>

          {articles.length > 0 ? (
            <div className="publication-list">
              {articles.map((article, index) => (
                <article key={article.id} className="publication-card">
                  <div className="publication-card__index">p{index + 1}</div>

                  <div className="publication-card__body">
                    <h3>{article.title || "Untitled article"}</h3>
                    {article.authors && (
                      <p className="publication-card__authors">
                        {formatAuthors(article.authors)}
                      </p>
                    )}

                    {isEditor && (
                      <div style={{ marginBottom: 10 }}>
                        {editingAuthorsArticleId === article.id ? (
                          <div
                            style={{
                              display: "grid",
                              gap: 8,
                              padding: 10,
                              border: "1px solid rgba(106,50,145,0.18)",
                              borderRadius: 10,
                              background: "rgba(106,50,145,0.04)",
                            }}
                          >
                            <input
                              type="text"
                              placeholder="Lead author"
                              value={authorLeadDraft}
                              onChange={(event) =>
                                setAuthorLeadDraft(event.target.value)
                              }
                              style={{
                                border: "1px solid #d1d5db",
                                borderRadius: 8,
                                padding: "8px 10px",
                                fontSize: 13,
                              }}
                            />
                            <input
                              type="text"
                              placeholder="Co-authors (comma separated)"
                              value={authorCoDraft}
                              onChange={(event) => setAuthorCoDraft(event.target.value)}
                              style={{
                                border: "1px solid #d1d5db",
                                borderRadius: 8,
                                padding: "8px 10px",
                                fontSize: 13,
                              }}
                            />
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  void handleSaveAuthors(article.id);
                                }}
                                disabled={authorSaving}
                                style={{
                                  border: "none",
                                  borderRadius: 999,
                                  padding: "6px 12px",
                                  background: "#6A3291",
                                  color: "#fff",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: authorSaving ? "default" : "pointer",
                                }}
                              >
                                {authorSaving ? "Saving..." : "Save authors"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingAuthorsArticleId(null);
                                  setAuthorSaveError(null);
                                }}
                                disabled={authorSaving}
                                style={{
                                  border: "1px solid #d1d5db",
                                  borderRadius: 999,
                                  padding: "6px 12px",
                                  background: "#fff",
                                  color: "#374151",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: authorSaving ? "default" : "pointer",
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                            {authorSaveError && (
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: 12,
                                  color: "#b91c1c",
                                }}
                              >
                                {authorSaveError}
                              </p>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              startEditingAuthors(article);
                            }}
                            style={{
                              border: "1px solid rgba(106,50,145,0.3)",
                              borderRadius: 999,
                              padding: "4px 10px",
                              background: "rgba(106,50,145,0.08)",
                              color: "#6A3291",
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            Edit authors
                          </button>
                        )}
                      </div>
                    )}

                    {article.abstract && (
                      <p className="publication-card__abstract">
                        {article.abstract}
                      </p>
                    )}

                    <div className="publication-card__actions">
                      <Link href={`/article/${article.id}`}>View article</Link>
                      <button
                        type="button"
                        onClick={() =>
                          handleViewPdf(article.manuscript_id || article.id)
                        }
                      >
                        View PDF
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="publication-empty">
              No articles found for this issue.
            </div>
          )}

          {pdfError && (
            <p className="publication-error">PDF error: {pdfError}</p>
          )}
        </section>
      </div>
    </main>
  );
}
