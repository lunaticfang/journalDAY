"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";

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
  title: string | null;
  abstract: string | null;
  authors: string | null;
  pdf_path: string | null;
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

export default function IssueDetailPage() {
  const router = useRouter();
  const params = useParams();
  const issueId = (params?.id as string) || "";

  const [issue, setIssue] = useState<Issue | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!issueId) {
        setErrorMsg("Invalid issue id");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setErrorMsg("");

        const resp = await fetch(`/api/issues/${issueId}`);
        const json = await resp.json();

        if (!resp.ok) {
          throw new Error(json?.error || "Failed to load issue");
        }

        if (!cancelled) {
          setIssue(json.issue);
          setArticles(json.articles || []);
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
  }, [issueId]);

  if (loading) {
    return (
      <main>
        <p>Loading issue…</p>
      </main>
    );
  }

  if (errorMsg && !issue) {
    return (
      <main>
        <p style={{ color: "crimson" }}>Error: {errorMsg}</p>
        <p>
          <button onClick={() => router.push("/issues")}>Back to issues</button>
        </p>
      </main>
    );
  }

  if (!issue) {
    return (
      <main>
        <p>Issue not found.</p>
        <p>
          <button onClick={() => router.push("/issues")}>Back to issues</button>
        </p>
      </main>
    );
  }

  const labelParts: string[] = [];
  if (issue.volume) labelParts.push(`Vol. ${issue.volume}`);
  if (issue.issue_number != null) labelParts.push(`Issue ${issue.issue_number}`);
  const label = labelParts.join(" · ");

  const dateText = issue.published_at
    ? new Date(issue.published_at).toLocaleDateString()
    : "";

  return (
    <main>
      <p style={{ marginBottom: 8 }}>
        <Link href="/issues" style={{ fontSize: 14, textDecoration: "underline" }}>
          ← Back to issues
        </Link>
      </p>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2.1fr) minmax(0, 1.4fr)",
          gap: 24,
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
            {issue.title || "Issue"}
          </h1>
          <p style={{ fontSize: 14, color: "#4b5563", marginBottom: 6 }}>
            {label}
            {label && dateText ? " · " : ""}
            {dateText}
          </p>
          {issue.pdf_path && (
            <p style={{ marginTop: 10 }}>
              <a
                href={issue.pdf_path}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#2563eb", textDecoration: "underline" }}
              >
                Download full issue PDF →
              </a>
            </p>
          )}
        </div>

        {issue.cover_url && (
          <div
            style={{
              justifySelf: "end",
              maxWidth: 220,
              width: "100%",
              borderRadius: 12,
              overflow: "hidden",
              border: "1px solid #e5e7eb",
              background: "white",
            }}
          >
            <img
              src={issue.cover_url}
              alt={issue.title || "Issue cover"}
              style={{
                width: "100%",
                display: "block",
                objectFit: "cover",
              }}
            />
          </div>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>
          Table of Contents
        </h2>

        {articles.length === 0 && <p>No articles linked to this issue yet.</p>}

        <div
          style={{
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "white",
            overflow: "hidden",
          }}
        >
          {articles.map((a, idx) => (
            <div
              key={a.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                padding: "10px 14px",
                borderTop: idx === 0 ? "none" : "1px solid #f3f4f6",
              }}
            >
              <div>
                <Link
                  href={`/article/${a.id}`}
                  style={{
                    fontWeight: 600,
                    fontSize: 14,
                    color: "#111827",
                    textDecoration: "none",
                  }}
                >
                  {a.title || "Untitled article"}
                </Link>
                {a.authors && (
                  <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
                    {formatAuthors(a.authors)}
                  </div>
                )}
              </div>
              <div style={{ whiteSpace: "nowrap", fontSize: 13 }}>
                {a.pdf_path && (
                  <a
                    href={a.pdf_path}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#2563eb", textDecoration: "underline" }}
                  >
                    PDF
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
