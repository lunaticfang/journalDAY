"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

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

export default function IssuePage() {
  const params = useParams<{ id: string }>();
  const rawId = params?.id;
  const id =
    typeof rawId === "string"
      ? rawId
      : Array.isArray(rawId)
      ? rawId[0]
      : undefined;

  const [issue, setIssue] = useState<Issue | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setErrorMsg(null);

      if (!id) {
        setErrorMsg("Invalid issue id.");
        setLoading(false);
        return;
      }

      try {
        const resp = await fetch(`/api/issues/${id}`);
        const json = await resp.json().catch(() => ({}));

        if (!resp.ok) {
          throw new Error(json?.error || "Failed to load publication.");
        }

        if (!cancelled) {
          setIssue((json?.issue || null) as Issue | null);
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
  }, [id]);

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
          </div>

          <div className="publication-hero__content">
            <div className="publication-eyebrow">Current Publication</div>
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
