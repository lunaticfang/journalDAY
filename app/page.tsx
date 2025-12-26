// app/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

const BRAND_PURPLE = "#6A3291";

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
};

export default function HomePage() {
  const [issue, setIssue] = useState<Issue | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // 1) Load latest published issue
        const { data: issues } = await supabase
          .from("issues")
          .select("id, title, volume, issue_number, published_at, cover_url")
          .order("published_at", { ascending: false })
          .limit(1);

        if (!issues || issues.length === 0) return;
        const latest = issues[0];
        if (cancelled) return;

        setIssue(latest);

        // 2) Load articles for that issue
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
      {/* Hero section */}
      <section
        style={{
          maxWidth: 1120,
          margin: "32px auto",
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

            <h1
              style={{
                fontSize: 30,
                fontWeight: 800,
                lineHeight: 1.2,
                marginBottom: 14,
              }}
            >
              Advancing knowledge, awareness, and care in diabetes through
              timely research and education.
            </h1>

            <p style={{ color: "#4b5563", fontSize: 15 }}>
              UpDAYtes brings together peer-reviewed research, clinical
              perspectives, and educational insights to empower healthcare
              professionals and the community.
            </p>

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
              src="/hero-banner.png"
              alt="UpDAYtes banner"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        </div>
      </section>

      {/* Publisher identity section (YOUR REQUEST — section B) */}
      <section
        style={{
          background: "#f9f5ff",
          borderTop: `1px solid ${BRAND_PURPLE}20`,
          borderBottom: `1px solid ${BRAND_PURPLE}20`,
          padding: "26px 20px",
          marginBottom: 32,
        }}
      >
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <h2
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: BRAND_PURPLE,
              marginBottom: 6,
            }}
          >
            UpDAYtes
          </h2>

          <p style={{ fontSize: 15, color: "#374151", lineHeight: 1.6 }}>
            Published by <strong>Diabetes Awareness and YOU (DAY)</strong>
            <br />
            in collaboration with <strong>WANT</strong>
          </p>
        </div>
      </section>

      {/* Current Issue */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "0 20px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>Current Issue</h2>

          {issue && (
            <Link
              href={`/issues/${issue.id}`}
              style={{
                color: BRAND_PURPLE,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              View Issue →
            </Link>
          )}
        </div>

        {loading && <p>Loading…</p>}

        {!loading && issue && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "220px 1fr",
              gap: 28,
            }}
          >
            {/* Cover */}
            <div>
              <img
                src={issue.cover_url || "/issue-cover.png"}
                alt="Issue cover"
                style={{
                  width: "100%",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                }}
              />
            </div>

            {/* Articles */}
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
                  <h3
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#111827",
                      marginBottom: 6,
                      lineHeight: 1.3,
                    }}
                  >
                    {a.title || "Untitled article"}
                  </h3>

                  {a.authors && (
                    <p
                      style={{
                        fontSize: 12,
                        color: "#6b7280",
                      }}
                    >
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
