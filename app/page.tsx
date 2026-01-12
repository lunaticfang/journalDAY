// app/page.tsx
"use client";

import FileAttachment from "./components/FileAttachment";
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
        const { data: issues } = await supabase
          .from("issues")
          .select(
            "id, title, volume, issue_number, published_at, cover_url, pdf_path"
          )
          .order("published_at", { ascending: false })
          .limit(1);

        if (!issues || issues.length === 0) return;
        const latest = issues[0] as Issue;
        if (cancelled) return;

        setIssue(latest);

        const { data: articleRows } = await supabase
          .from("articles")
          .select("id, title, authors")
          .eq("issue_id", latest.id)
          .order("created_at", { ascending: true });

        if (!cancelled) {
          setArticles(articleRows || []);
        }

        /* -------- COVER RESOLUTION (FIXED BUCKET) -------- */
        if (latest.cover_url) {
          setCoverSrc(latest.cover_url);
          setCoverIsPdf(false);
        } else if (latest.pdf_path) {
          try {
            const { data: publicData } = supabase.storage
              .from("instructions-pdfs") // ✅ FIXED BUCKET
              .getPublicUrl(latest.pdf_path as string);

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
        } else {
          setCoverSrc(null);
          setCoverIsPdf(false);
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
          margin: "20px auto 32px auto",
          padding: "0 20px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.8fr 1.2fr",
            gap: 28,
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
              placeholder="Advancing knowledge, awareness..."
            />

            <div style={{ marginTop: 12 }}>
              <EditableBlock
                contentKey="home.hero_subtitle"
                isEditor={isOwner}
                placeholder="UpDAYtes brings together peer-reviewed research..."
              />
            </div>

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
              minHeight: 220,
            }}
          >
            {coverSrc ? (
              coverIsPdf ? (
                <object
                  data={coverSrc}
                  type="application/pdf"
                  style={{ width: "100%", height: 260 }}
                >
                  <a href={coverSrc} target="_blank" rel="noreferrer">
                    View issue PDF
                  </a>
                </object>
              ) : (
                <img
                  src={coverSrc}
                  alt="Cover"
                  style={{ width: "100%", height: 260, objectFit: "cover" }}
                />
              )
            ) : (
              <img
                src="/Website Banner.jpg"
                alt="Banner"
                style={{ width: "100%", height: 260, objectFit: "cover" }}
              />
            )}
          </div>
        </div>
      </section>

      {/* Current Issue */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "0 20px" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>
          Current Issue
        </h2>

        {!loading && issue && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "280px 1fr",
              gap: 28,
            }}
          >
            <div>
              {coverSrc && !coverIsPdf && (
                <img
                  src={coverSrc}
                  style={{ width: "100%", borderRadius: 6 }}
                />
              )}
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
                    border: "1px solid #e5e7eb",
                    borderRadius: 6,
                    padding: 12,
                    textDecoration: "none",
                    background: "white",
                  }}
                >
                  <h3 style={{ fontSize: 14, fontWeight: 700 }}>{a.title}</h3>
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

import FileAttachment from "./components/FileAttachment";
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

  // derived cover source (either image URL or PDF public URL)
  const [coverSrc, setCoverSrc] = useState<string | null>(null);
  const [coverIsPdf, setCoverIsPdf] = useState(false);

  // -------------------------------------------------- 
  // Auth + ownership check                             
  // -------------------------------------------------- 
  useEffect(() => {
    let mounted = true;

    // initial check
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
      try {
        subscription.unsubscribe();
      } catch (e) {
        // ignore if already unsubscribed
      }
    };
  }, []);

  // -------------------------------------------------- 
  // Load homepage data                                 
  // -------------------------------------------------- 
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // ---------------- Latest issue ---------------- 
        const { data: issues } = await supabase
          .from("issues")
          .select(
            "id, title, volume, issue_number, published_at, cover_url, pdf_path"
          )
          .order("published_at", { ascending: false })
          .limit(1);

        if (!issues || issues.length === 0) return;
        const latest = issues[0] as Issue;
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

        // ---------------- Cover resolution ----------------
           Priority:
         //  1) issue.cover_url (explicit image URL)
         //  2) issue.pdf_path -> public URL from storage (embed PDF)
         //  3) fallback static /journal cover.jpg
        //--------------------------------------------------
        if (latest.cover_url) {
          setCoverSrc(latest.cover_url);
          setCoverIsPdf(false);
        } else if (latest.pdf_path) {
          // try to get a public URL from Supabase storage (bucket: site-files)
          try {
            const getPublic = await (supabase.storage
              .from("site-files")
              .getPublicUrl
              ? // v1 / v2 compatibility: call and check returned shapes
                (supabase.storage.from("site-files").getPublicUrl(
                  latest.pdf_path as string
                ) as any)
              : null);

            // attempt to extract public URL from possible shapes
            let publicUrl: string | null = null;
            if (getPublic) {
              // v2 shape: { data: { publicUrl } }
              if (getPublic.data && getPublic.data.publicUrl) {
                publicUrl = getPublic.data.publicUrl;
              }
              // v1 shape: { publicURL }
              if (!publicUrl && (getPublic as any).publicURL) {
                publicUrl = (getPublic as any).publicURL;
              }
              // some clients may return { data: { publicUrl } } or { publicURL }
            }

            // Fallback: if storage call didn't produce url, attempt to build URL via supabase client (best-effort)
            if (!publicUrl) {
              // If your Supabase project exposes a public bucket, this fallback may work:
              // https://<project>.supabase.co/storage/v1/object/public/site-files/<path>
              // but we avoid constructing this blindly; default to using pdf_path (raw) as link.
              publicUrl = latest.pdf_path as string;
            }

            if (publicUrl) {
              // adding '#page=1' in some browsers will open the PDF at page 1;
              // embedding will still show the PDF; treat as PDF cover.
              setCoverSrc(publicUrl + "#page=1");
              setCoverIsPdf(true);
            } else {
              setCoverSrc(null);
              setCoverIsPdf(false);
            }
          } catch (err) {
            // if anything fails, fallback to static cover
            console.error("Could not resolve pdf public URL:", err);
            setCoverSrc(null);
            setCoverIsPdf(false);
          }
        } else {
          setCoverSrc(null);
          setCoverIsPdf(false);
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
      {// Editor-in-Chief }
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

      {// Hero section - adjusted proportions }
      <section
        style={{
          maxWidth: 1120,
          margin: "20px auto 32px auto",
          padding: "0 20px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.8fr 1.2fr",
            gap: 28,
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

            <div style={{ maxWidth: 720 }}>
              <EditableBlock
                contentKey="home.hero_title"
                isEditor={isOwner}
                placeholder="Advancing knowledge, awareness, understanding of the complex biological, environmental, behavioral, and social determinants of metabolic health including obesity and diabetes."
              />

              <div style={{ marginTop: 12 }}>
                <EditableBlock
                  contentKey="home.hero_subtitle"
                  isEditor={isOwner}
                  placeholder="UpDAYtes brings together peer-reviewed research, clinical perspectives, and educational insights to empower healthcare professionals and the community."
                />
              </div>
            </div>

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
              minHeight: 220,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {// Prefer uploaded cover image / pdf }
            {coverSrc ? (
              coverIsPdf ? (
                // embed PDF (will show first page in many browsers)
                <object
                  data={coverSrc}
                  type="application/pdf"
                  aria-label="Issue PDF cover"
                  style={{ width: "100%", height: 260, display: "block" }}
                >
                  {// fallback link if object not supported }
                  <a href={coverSrc} target="_blank" rel="noreferrer">
                    View issue PDF
                  </a>
                </object>
              ) : (
                <img
                  src={coverSrc}
                  alt="UpDAYtes banner"
                  style={{ width: "100%", height: 260, objectFit: "cover" }}
                />
              )
            ) : (
              // fallback static banner image
              <img
                src="/Website Banner.jpg"
                alt="UpDAYtes banner"
                style={{ width: "100%", height: 260, objectFit: "cover" }}
              />
            )}

            {// Owner: file attachment control for hero area (optional) }
            <div style={{ padding: 12 }}>
              <FileAttachment
                contentKey="home.hero.attachment"
                isEditor={isOwner}
                // FileAttachment should handle upload/display; no further wiring here
              />
            </div>
          </div>
        </div>
      </section>

      {// Current Issue: cover + articles; cover will be first page of PDF if no cover image }
      <section
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "0 20px",
        }}
      >
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
              gridTemplateColumns: "280px 1fr",
              gap: 28,
              alignItems: "start",
            }}
          >
            {// Left: cover (image or embedded PDF first page) }
            <div>
              {issue.cover_url ? (
                <img
                  src={issue.cover_url}
                  alt="Issue cover"
                  style={{
                    width: "100%",
                    borderRadius: 6,
                    border: "1px solid #e5e7eb",
                    objectFit: "cover",
                  }}
                />
              ) : issue.pdf_path ? (
                // try to show embedded pdf (use coverSrc if computed earlier)
                coverSrc ? (
                  coverIsPdf ? (
                    <object
                      data={coverSrc}
                      type="application/pdf"
                      style={{ width: "100%", height: 360, display: "block" }}
                    >
                      <a href={coverSrc} target="_blank" rel="noreferrer">
                        View issue PDF
                      </a>
                    </object>
                  ) : (
                    <img
                      src={coverSrc}
                      alt="Issue cover (derived)"
                      style={{
                        width: "100%",
                        borderRadius: 6,
                        border: "1px solid #e5e7eb",
                        objectFit: "cover",
                      }}
                    />
                  )
                ) : (
                  // final fallback if we couldn't compute public URL
                  <div
                    style={{
                      width: "100%",
                      height: 360,
                      borderRadius: 6,
                      border: "1px solid #e5e7eb",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#6b7280",
                      background: "#fafafa",
                    }}
                  >
                    Issue PDF available — <Link href={`/issues/${issue.id}`}>open issue</Link>
                  </div>
                )
              ) : (
                <img
                  src="/journal cover.jpg"
                  alt="Issue cover"
                  style={{
                    width: "100%",
                    borderRadius: 6,
                    border: "1px solid #e5e7eb",
                    objectFit: "cover",
                  }}
                />
              )}
            </div>

            {// Right: articles grid (side-by-side with cover)}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 14,
              }}
            >
              {articles.length === 0 && (
                <div style={{ gridColumn: "1 / -1", color: "#6b7280" }}>
                  No articles published yet.
                </div>
              )}

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
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
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
                      <p style={{ fontSize: 12, color: "#6b7280" }}>{a.authors}</p>
                    )}
                  </div>
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