"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type Article = {
  id: string;
  title: string | null;
  abstract: string | null;
  authors: string | null;
  pdf_path: string | null; // legacy backup only
  issue_id: string | null;
  manuscript_id?: string | null; // 🔥 link to manuscripts table
  created_at: string | null;
};

type Issue = {
  id: string;
  title: string | null;
  volume: string | null;
  issue_number: number | null;
  published_at: string | null;
  pdf_path?: string | null; // full issue PDF (not used as main source here)
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
    // authors might already be a plain string
  }
  return authors;
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
        setErrorMsg("Invalid article id");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setErrorMsg("");
        setPdfError(null);
        setPdfUrl(null);

        // 1) Load article + issue metadata
        const resp = await fetch(`/api/articles/${articleId}`);
        const json = await resp.json();
        if (!resp.ok) {
          throw new Error(json?.error || "Failed to load article");
        }
        if (cancelled) return;

        const loadedArticle = json.article as Article;
        const loadedIssue = (json.issue || null) as Issue | null;

        setArticle(loadedArticle);
        setIssue(loadedIssue);

        // 🎯 Use manuscript_id if available, otherwise fall back to article.id
        const manuscriptId =
          loadedArticle.manuscript_id || loadedArticle.id;

        // 2) EXACT SAME LOGIC AS ADMIN "View PDF" but with manuscriptId
        try {
          const signedResp = await fetch(
            `/api/submissions/${manuscriptId}/signed-url`
          );
          const signedJson = await signedResp.json();

          if (!signedResp.ok) {
            throw new Error(signedJson?.error || "Could not get signed URL");
          }
          const url: string | null =
            signedJson?.signedUrl || signedJson?.publicUrl || null;

          if (!url) {
            throw new Error("No signed URL returned");
          }

          if (!cancelled) {
            setPdfUrl(url);
          }
        } catch (err: any) {
          console.error("ArticlePage signed-url error:", err);
          if (!cancelled) {
            setPdfError(err?.message || String(err));
          }
        }

        // 3) OPTIONAL BACKUP: if signed-url failed, but legacy article.pdf_path exists
        if (!cancelled && !pdfUrl && loadedArticle.pdf_path) {
          setPdfUrl(loadedArticle.pdf_path);
          setPdfError(null);
        }
      } catch (err: any) {
        console.error(err);
        if (!cancelled) setErrorMsg(err.message || String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [articleId]);

  if (loading) {
    return (
      <main style={{ maxWidth: 900, margin: "0 auto" }}>
        <p>Loading article…</p>
      </main>
    );
  }

  if (errorMsg || !article) {
    return (
      <main style={{ maxWidth: 900, margin: "0 auto" }}>
        <p style={{ color: "crimson" }}>{errorMsg || "Article not found."}</p>
        <p style={{ marginTop: 8 }}>
          <button
            onClick={() => router.back()}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              background: "white",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Go back
          </button>
        </p>
      </main>
    );
  }

  const issueLabel = issue
    ? [
        issue.volume ? `Vol. ${issue.volume}` : null,
        issue.issue_number != null ? `Issue ${issue.issue_number}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const pubDate = issue?.published_at
    ? new Date(issue.published_at).toLocaleDateString()
    : "";

  return (
    <main style={{ maxWidth: 900, margin: "0 auto" }}>
      <p style={{ marginBottom: 10 }}>
        {issue && (
          <>
            <Link
              href={`/issues/${issue.id}`}
              style={{ fontSize: 14, textDecoration: "underline" }}
            >
              ← Back to issue
            </Link>
            {" · "}
          </>
        )}
        <Link
          href="/issues"
          style={{ fontSize: 14, textDecoration: "underline" }}
        >
          Browse issues
        </Link>
      </p>

      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>
        {article.title || "Untitled article"}
      </h1>

      {article.authors && (
        <p style={{ fontSize: 14, color: "#4b5563", marginBottom: 6 }}>
          {formatAuthors(article.authors)}
        </p>
      )}

      {issue && (
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
          {issueLabel}
          {issueLabel && pubDate ? " · " : ""}
          {pubDate}
        </p>
      )}

      {/* PDF viewer – driven by signed-url for THIS manuscript */}
      {pdfUrl ? (
        <section style={{ marginBottom: 24 }}>
          <h2
            style={{
              fontSize: 16,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Full article
          </h2>

          <div
            style={{
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              overflow: "hidden",
              background: "#111827",
            }}
          >
            <iframe
              src={pdfUrl}
              style={{
                width: "100%",
                height: "80vh",
                border: "none",
                background: "#111827",
              }}
              title={article.title || "Article PDF"}
            />
          </div>

          <p style={{ marginTop: 8, fontSize: 13 }}>
            If the PDF doesn’t display correctly,{" "}
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#2563eb", textDecoration: "underline" }}
            >
              open it in a new tab →
            </a>
          </p>
        </section>
      ) : (
        <section style={{ marginBottom: 24 }}>
          <h2
            style={{
              fontSize: 16,
              fontWeight: 600,
              marginBottom: 4,
            }}
          >
            Full article
          </h2>
          <p style={{ fontSize: 13, color: "#6b7280" }}>
            PDF not available for this article.
          </p>
          {pdfError && (
            <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
              ({pdfError})
            </p>
          )}
        </section>
      )}

      {article.abstract && (
        <section style={{ marginBottom: 20 }}>
          <h2
            style={{
              fontSize: 16,
              fontWeight: 600,
              marginBottom: 4,
            }}
          >
            Abstract
          </h2>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: "#111827",
            }}
          >
            {article.abstract}
          </p>
        </section>
      )}

      <section
        style={{
          borderTop: "1px solid #e5e7eb",
          paddingTop: 14,
          marginTop: 10,
        }}
      >
        <h3
          style={{
            fontSize: 15,
            fontWeight: 600,
            marginBottom: 4,
          }}
        >
          Suggested citation
        </h3>
        <p style={{ fontSize: 13, color: "#4b5563" }}>
          {formatAuthors(article.authors)}
          {formatAuthors(article.authors) ? ". " : ""}
          {article.title || "Untitled article"}.{" "}
          {issueLabel ? issueLabel + ". " : ""}
          {pubDate}.
        </p>
      </section>
    </main>
  );
}
