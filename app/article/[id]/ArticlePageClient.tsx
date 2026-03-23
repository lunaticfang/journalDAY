"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type Article = {
  id: string;
  title: string | null;
  abstract: string | null;
  authors: string | null;
  pdf_path: string | null;
  issue_id: string | null;
  manuscript_id?: string | null;
  created_at: string | null;
};

type Issue = {
  id: string;
  title: string | null;
  volume: string | null;
  issue_number: number | null;
  published_at: string | null;
  pdf_path?: string | null;
};

function formatAuthors(authors: string | null) {
  if (!authors) return "";

  try {
    const parsed = JSON.parse(authors);
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
    // authors may already be stored as plain text
  }

  return authors;
}

function buildIssueLabel(issue: Issue | null) {
  if (!issue) return "";

  return [
    issue.volume ? `Vol. ${issue.volume}` : null,
    issue.issue_number != null ? `Issue ${issue.issue_number}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

export default function ArticlePage() {
  const params = useParams();
  const router = useRouter();
  const articleId = (params?.id as string) || "";

  const [article, setArticle] = useState<Article | null>(null);
  const [issue, setIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!articleId) {
        setErrorMsg("Invalid article id.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setErrorMsg("");
        setPdfError(null);
        setPdfUrl(null);

        const resp = await fetch(`/api/articles/${articleId}`);
        const json = await resp.json().catch(() => ({}));

        if (!resp.ok) {
          throw new Error(json?.error || "Failed to load article.");
        }

        if (cancelled) return;

        const loadedArticle = json.article as Article;
        const loadedIssue = (json.issue || null) as Issue | null;

        setArticle(loadedArticle);
        setIssue(loadedIssue);

        const manuscriptId = loadedArticle.manuscript_id || loadedArticle.id;

        try {
          const signedResp = await fetch(
            `/api/submissions/${manuscriptId}/signed-url`
          );
          const signedJson = await signedResp.json().catch(() => ({}));

          if (!signedResp.ok) {
            throw new Error(
              signedJson?.error || "Could not get article PDF."
            );
          }

          const url: string | null =
            signedJson?.signedUrl || signedJson?.publicUrl || null;

          if (!url) {
            throw new Error("No signed URL returned for this article.");
          }

          if (!cancelled) {
            setPdfUrl(url);
          }
        } catch (err) {
          console.error("ArticlePage signed-url error:", err);
          if (!cancelled) {
            setPdfError(
              err instanceof Error ? err.message : "Could not load article PDF."
            );
          }
        }

        if (!cancelled && loadedArticle.pdf_path) {
          setPdfUrl((current) => current || loadedArticle.pdf_path);
        }
      } catch (err) {
        console.error("ArticlePage load error:", err);
        if (!cancelled) {
          setErrorMsg(
            err instanceof Error ? err.message : "Could not load article."
          );
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
  }, [articleId]);

  const issueLabel = buildIssueLabel(issue);
  const pubDate = issue?.published_at
    ? new Date(issue.published_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";
  const formattedAuthors = formatAuthors(article?.authors || null);

  if (loading) {
    return (
      <main className="reader-page">
        <div className="reader-shell">
          <div className="reader-state">Loading article...</div>
        </div>
      </main>
    );
  }

  if (errorMsg || !article) {
    return (
      <main className="reader-page">
        <div className="reader-shell">
          <div className="reader-back">
            <button
              type="button"
              className="reader-link-button"
              onClick={() => router.back()}
            >
              Back
            </button>
            <Link href="/issues">Browse issues</Link>
          </div>

          <div className="reader-state reader-state--error">
            {errorMsg || "Article not found."}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="reader-page">
      <div className="reader-shell">
        <div className="reader-back">
          {issue && <Link href={`/issues/${issue.id}`}>Back to issue</Link>}
          <Link href="/issues">Browse issues</Link>
        </div>

        <section className="reader-hero">
          <div className="reader-eyebrow">Publication</div>
          <h1>{article.title || "Untitled article"}</h1>

          {formattedAuthors && (
            <p className="reader-authors">{formattedAuthors}</p>
          )}

          <div className="reader-meta">
            {issueLabel && <span>{issueLabel}</span>}
            {pubDate && <span>{pubDate}</span>}
            {article.created_at && (
              <span>
                Added{" "}
                {new Date(article.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
          </div>

          <div className="reader-actions">
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="reader-btn reader-btn--primary"
              >
                Open PDF
              </a>
            )}
            {issue && (
              <Link
                href={`/issues/${issue.id}`}
                className="reader-btn reader-btn--ghost"
              >
                View Publication
              </Link>
            )}
            <Link href="/issues" className="reader-btn reader-btn--ghost">
              Browse Archive
            </Link>
          </div>
        </section>

        <div className="reader-grid">
          <section className="reader-panel reader-panel--wide">
            <div className="reader-panel__head">
              <div>
                <h2>Full Article</h2>
                <p>Read the publication inline or open it in a new tab.</p>
              </div>
            </div>

            {pdfUrl ? (
              <div className="reader-pdf-frame">
                <iframe
                  src={pdfUrl}
                  title={article.title || "Article PDF"}
                  className="reader-pdf-frame__iframe"
                />
              </div>
            ) : (
              <div className="reader-empty">
                <p>PDF not available for this article.</p>
                {pdfError && <span>{pdfError}</span>}
                {issue?.pdf_path && (
                  <a
                    href={issue.pdf_path}
                    target="_blank"
                    rel="noreferrer"
                    className="reader-btn reader-btn--ghost"
                  >
                    Open full issue PDF
                  </a>
                )}
              </div>
            )}
          </section>

          <aside className="reader-sidebar">
            {article.abstract && (
              <section className="reader-panel">
                <div className="reader-panel__head">
                  <div>
                    <h2>Abstract</h2>
                    <p>Summary of the publication.</p>
                  </div>
                </div>
                <div className="reader-copy">{article.abstract}</div>
              </section>
            )}

            <section className="reader-panel">
              <div className="reader-panel__head">
                <div>
                  <h2>Suggested Citation</h2>
                  <p>Use this as a starting point for references.</p>
                </div>
              </div>
              <div className="reader-citation">
                {formattedAuthors}
                {formattedAuthors ? ". " : ""}
                {article.title || "Untitled article"}.
                {issue?.title ? ` ${issue.title}.` : ""}
                {issueLabel ? ` ${issueLabel}.` : ""}
                {pubDate ? ` ${pubDate}.` : ""}
              </div>
            </section>

            <section className="reader-panel">
              <div className="reader-panel__head">
                <div>
                  <h2>Publication Details</h2>
                  <p>Metadata for the issue and article.</p>
                </div>
              </div>
              <dl className="reader-details">
                <div>
                  <dt>Article ID</dt>
                  <dd>{article.id}</dd>
                </div>
                {article.manuscript_id && (
                  <div>
                    <dt>Manuscript ID</dt>
                    <dd>{article.manuscript_id}</dd>
                  </div>
                )}
                {issue?.title && (
                  <div>
                    <dt>Issue</dt>
                    <dd>{issue.title}</dd>
                  </div>
                )}
                {pubDate && (
                  <div>
                    <dt>Published</dt>
                    <dd>{pubDate}</dd>
                  </div>
                )}
              </dl>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
