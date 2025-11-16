"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

type Issue = {
  id: string;
  title: string | null;
  volume: string | null;
  issue_number: number | null;
  published_at: string | null;
  cover_url: string | null;
  pdf_path: string | null;
};

export default function IssuesIndexPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setErrorMsg("");

        const { data, error } = await supabase
          .from("issues")
          .select(
            "id, title, volume, issue_number, published_at, cover_url, pdf_path"
          )
          .order("published_at", { ascending: false });

        if (error) throw error;
        if (!cancelled) setIssues(data || []);
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
  }, []);

  return (
    <main>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>
          Issues
        </h1>
        <p style={{ fontSize: 14, color: "#4b5563" }}>
          Browse published issues of JournalDAY.
        </p>
      </header>

      {loading && <p>Loading issues…</p>}
      {errorMsg && <p style={{ color: "crimson" }}>Error: {errorMsg}</p>}

      {!loading && !errorMsg && issues.length === 0 && (
        <p>No issues published yet.</p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 18,
          marginTop: 12,
        }}
      >
        {issues.map((issue) => {
          const labelParts: string[] = [];
          if (issue.volume) labelParts.push(`Vol. ${issue.volume}`);
          if (issue.issue_number != null)
            labelParts.push(`Issue ${issue.issue_number}`);
          const label = labelParts.join(" · ");

          const dateText = issue.published_at
            ? new Date(issue.published_at).toLocaleDateString()
            : "";

          return (
            <Link
              key={issue.id}
              href={`/issues/${issue.id}`}
              style={{
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <article
                style={{
                  background: "white",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                }}
              >
                {issue.cover_url && (
                  <div
                    style={{
                      width: "100%",
                      maxHeight: 180,
                      overflow: "hidden",
                    }}
                  >
                    <img
                      src={issue.cover_url}
                      alt={issue.title || "Issue cover"}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  </div>
                )}
                <div style={{ padding: 12 }}>
                  <h2
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      marginBottom: 4,
                      color: "#111827",
                    }}
                  >
                    {issue.title || label || "Untitled issue"}
                  </h2>
                  <p
                    style={{
                      fontSize: 13,
                      color: "#6b7280",
                      marginBottom: 4,
                    }}
                  >
                    {label}
                    {label && dateText ? " · " : ""}
                    {dateText}
                  </p>
                  {issue.pdf_path && (
                    <p
                      style={{
                        fontSize: 12,
                        color: "#2563eb",
                        marginTop: 6,
                      }}
                    >
                      View issue details →
                    </p>
                  )}
                </div>
              </article>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
