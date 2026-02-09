/*// app/page.tsx
"use client";

import FileAttachment from "./components/FileAttachment";
import { useCallback, useEffect, useState } from "react";
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
import { useCallback, useEffect, useState } from "react";
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
};

export default function HomePage() {
  const [issue, setIssue] = useState<Issue | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  const [isOwner, setIsOwner] = useState(false);

  const [coverSrc, setCoverSrc] = useState<string | null>(null);
  const [coverIsPdf, setCoverIsPdf] = useState(false);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);

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

  /* ---------------- Load homepage data ---------------- */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);

        const resp = await fetch("/api/issues/latest");
        const json = await resp.json().catch(() => ({}));

        if (!resp.ok) {
          throw new Error(json?.error || "Failed to load latest issue");
        }

        const latest = (json?.issue || null) as Issue | null;
        const articleRows = (json?.articles || []) as Article[];

        if (cancelled) return;

        setIssue(latest);
        setArticles(articleRows);
        resolveCoverFromIssue(latest);
      } catch (err) {
        console.error("HomePage load error:", err);
        if (!cancelled) {
          setIssue(null);
          setArticles([]);
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

  const heroShowPdf = !bannerUrl && coverIsPdf && !!coverSrc;
  const heroImageSrc =
    bannerUrl || (!coverIsPdf ? coverSrc : null) || "/Website Banner.jpg";

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

            <div className="home-issue__list">
              {articles.length > 0 ? (
                articles.map((a) => (
                  <Link
                    key={a.id}
                    href={`/article/${a.id}`}
                    className="home-article"
                  >
                    <h3>{a.title}</h3>
                    {a.authors && <p>{a.authors}</p>}
                  </Link>
                ))
              ) : (
                <p className="home-muted">No articles added to this issue yet.</p>
              )}
            </div>
          </div>
        )}
      </section>

      <div className="home-spacer" />
    </div>
  );
}
