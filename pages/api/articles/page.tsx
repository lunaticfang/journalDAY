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
  created_at: string | null;
};

type Issue = {
  id: string;
  title: string | null;
  volume: string | null;
  issue_number: number | null;
  published_at: string | null;
};

function formatAuthors(authors: string | null) {
  if (!authors) return "";
  try {
    const parsed = JSON.parse(authors);
    if (Array.isArray(parsed)) return parsed.join(", ");
  } catch {
    /* ignore */
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

        const resp = await fetch(`/api/articles/${articleId}`);
        const json = await resp.json();
        if (!resp.ok) throw new Error(json?.error || "Failed to load article");

        if (!cancelled) {
          setArticle(json.article);
          setIssue(json.issue || null);
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
      <main style={{ padding: 24 }}>
        <p>Loading article…</p>
      </main>
    );
  }

  if (errorMsg || !article) {
    return (
      <main style={{ padding: 24 }}>
        <p style={{ color: "crimson" }}>{errorMsg || "Article not found."}</p>
        <p>
          <button onClick={() => router.back()}>Go back</button>
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
    <main style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <p style={{ marginBottom: 8 }}>
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

      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>
        {article.title || "Untitled article"}
      </h1>

      <p style={{ fontSize: 14, color: "#4b5563", marginBottom: 12 }}>
        {formatAuthors(article.authors)}
      </p>

      {issue && (
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
          {issueLabel}
          {issueLabel && pubDate ? " · " : ""}
          {pubDate}
        </p>
      )}

      {article.abstract && (
        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
            Abstract
          </h2>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#111827" }}>
            {article.abstract}
          </p>
        </section>
      )}

      {article.pdf_path && (
        <p style={{ marginBottom: 24 }}>
          <a
            href={article.pdf_path}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#2563eb", textDecoration: "underline" }}
          >
            View full article PDF →
          </a>
        </p>
      )}

      {/* simple citation */}
      <section style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
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
