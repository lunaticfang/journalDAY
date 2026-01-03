// app/page.tsx
"use client";

import { useEffect, useState } from "react";
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
};

export default function HomePage() {
  const [issue, setIssue] = useState<Issue | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  const [isOwner, setIsOwner] = useState(false);

  /* -------------------------------------------------- */
  /* Auth + ownership check (FIXED)                      */
  /* -------------------------------------------------- */
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

  /* -------------------------------------------------- */
  /* Load homepage data                                  */
  /* -------------------------------------------------- */
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
      {/* Editor-in-Chief */}
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

      {/* Hero section */}
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

            <div style={{ marginTop: 18 }}>
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

      {/* Current Issue */}
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



/*

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

type BannerContent = {
  title?: string;
  subtitle?: string;
  cta?: string;
};

export default function HomePage() {
  const [issue, setIssue] = useState<Issue | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  const [banner, setBanner] = useState<BannerContent>({
    title:
      "Advancing knowledge, awareness, understanding of the complex biological, environmental, behavioral, and social determinants of metabolic health including obesity and diabetes.",
    subtitle:
      "UpDAYtes brings together peer-reviewed research, clinical perspectives, and educational insights to empower healthcare professionals and the community.",
    cta: "Submit an Article",
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // ---------------- Banner content ---------------- 
        const { data: bannerRow } = await supabase
          .from("site_content")
          .select("value")
          .eq("key", "homepage_banner")
          .maybeSingle();

        if (!cancelled && bannerRow?.value) {
          setBanner((prev) => ({ ...prev, ...bannerRow.value }));
        }

        // ---------------- Latest issue ----------------
        const { data: issues } = await supabase
          .from("issues")
          .select("id, title, volume, issue_number, published_at, cover_url")
          .order("published_at", { ascending: false })
          .limit(1);

        if (!issues || issues.length === 0) return;
        const latest = issues[0];
        if (cancelled) return;

        setIssue(latest);

        // ---------------- Articles ---------------- 
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
      {// Editor-in-Chief marquee /}
      <section
        style={{
          background: "#f9f5ff",
          borderTop: "1px solid #e5e7eb",
          borderBottom: "1px solid #e5e7eb",
          padding: "10px 0",
          overflow: "hidden",
        }}
      >
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 20px" }}>
          <div
            style={{
              animation: "marquee 15s linear infinite",
              whiteSpace: "nowrap",
              display: "inline-block",
              paddingLeft: "100%",
            }}
          >
            <p
              style={{
                margin: 10,
                fontWeight: 1200,
                fontSize: 24,
                color: "BLACK",
                display: "inline-block",
              }}
            >
              Editor-in-Chief: Prof. (Dr.) Satinath Mukhopadhyay
            </p>
          </div>
        </div>
      </section>

      <style jsx>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-100%);
          }
        }
      `}</style>

      {// Hero section /}
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

            <h1
              style={{
                fontSize: 25,
                fontWeight: 500,
                lineHeight: 1.0,
                marginBottom: 14,
              }}
            >
              {banner.title}
            </h1>

            <p style={{ color: "#4b5563", fontSize: 15 }}>
              <span style={{ color: BRAND_PURPLE, fontWeight: 700 }}>
                UpDAYtes
              </span>{" "}
              {banner.subtitle}
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
                {banner.cta}
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

              <Link
                href="/aim"
                style={{
                  padding: "10px 16px",
                  borderRadius: 6,
                  fontSize: 14,
                  border: "1px solid #e5e7eb",
                  textDecoration: "none",
                  color: "#111827",
                }}
              >
                Aim & Scope
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
            <div>
              <img
                src="/journal cover.jpg"
                alt="Issue cover"
                style={{
                  width: "100%",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                }}
              />
            </div>

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