// app/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

/**
 * JAPI-like homepage (inline styles, safe / drop-in)
 * - Links buttons to your existing pages and loads the latest issue from the `issues` table.
 * - If an issue has pdf_path as an absolute URL it will be linked directly.
 *   Otherwise the Download action opens /api/issues/{id}/signed-url which you can implement to generate a Supabase signed URL.
 *
 * Images expected in /public: logo-japi.png, seal.png, hero-banner.png, issue-cover.png (fallback).
 */

type Issue = {
  id: string;
  title: string | null;
  volume: string | null;
  issue_number: number | null;
  published_at: string | null;
  cover_url: string | null;
  pdf_path: string | null;
};

export default function HomePage() {
  const [latest, setLatest] = useState<Issue | null>(null);
  const [loadingIssue, setLoadingIssue] = useState(true);
  const [issueErr, setIssueErr] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoadingIssue(true);
        setIssueErr("");

        // Fetch the most recently published issue
        const { data, error } = await supabase
          .from("issues")
          .select("id, title, volume, issue_number, published_at, cover_url, pdf_path")
          .order("published_at", { ascending: false })
          .limit(1);

        if (error) throw error;
        if (!cancelled) setLatest((data && data[0]) || null);
      } catch (err: any) {
        console.error("load latest issue:", err);
        if (!cancelled) setIssueErr(err.message || String(err));
      } finally {
        if (!cancelled) setLoadingIssue(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Helper to produce a download href:
  function getDownloadHref(issue: Issue) {
    if (!issue) return "#";
    if (issue.pdf_path && (issue.pdf_path.startsWith("http://") || issue.pdf_path.startsWith("https://"))) {
      return issue.pdf_path;
    }
    // fallback: API route that should return a signed URL (implement server-side)
    return `/api/issues/${encodeURIComponent(issue.id)}/signed-url`;
  }

  return (
    <div style={{ background: "#fff", minHeight: "100vh", color: "#111827" }}>
      {/* Thin announcement bar */}
      <div style={{ width: "100%", background: "#6b7280", color: "white", fontSize: 13, textAlign: "center", padding: "6px 0" }}>
        Announcement for Vice President Position
      </div>

      {/* Header strip (logo + nav + submit CTA + seal) */}
      <header style={{ borderBottom: "1px solid #e5e7eb", background: "#fff" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img src="/logo-japi.png" alt="JAPI" style={{ height: 36, objectFit: "contain" }} />
            <div style={{ lineHeight: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Journal of</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>The Association of Physicians of India</div>
            </div>
          </div>

          <nav style={{ display: "flex", gap: 20, alignItems: "center", fontSize: 14 }}>
            <Link href="/" style={{ color: "#111827", textDecoration: "none" }}>Home</Link>
            <Link href="/about" style={{ color: "#374151", textDecoration: "none" }}>About</Link>
            <Link href="/issues" style={{ color: "#374151", textDecoration: "none" }}>Current</Link>
            <Link href="/archive" style={{ color: "#374151", textDecoration: "none" }}>Archive</Link>
            <Link href="/podcast" style={{ color: "#374151", textDecoration: "none" }}>Podcast</Link>
            <Link href="/instructions" style={{ color: "#374151", textDecoration: "none" }}>Instructions</Link>
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link href="/author/submit" style={{ background: "#6b7280", color: "white", padding: "8px 12px", borderRadius: 6, textDecoration: "none", fontSize: 13 }}>Submit an Article</Link>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <img src="/seal.png" alt="seal" style={{ width: 40, height: 40, objectFit: "contain", borderRadius: 20, border: "1px solid #e5e7eb" }} />
              <div style={{ fontSize: 12, color: "#6b7280" }}>Vol 73 | Issue 11 | November 2025</div>
            </div>
          </div>
        </div>
      </header>

      {/* Thin editor strip */}
      <div style={{ background: "#6b7280", color: "#fff", padding: "8px 0", fontSize: 13 }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 20px" }}>
          Editor-in-Chief | Prof. Dr. Mangesh Tiwaskar
        </div>
      </div>

      {/* Hero: left featured + right banner */}
      <main style={{ maxWidth: 1120, margin: "28px auto", padding: "0 20px" }}>
        <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 2.2fr) minmax(0, 1.6fr)", gap: 32, alignItems: "center" }}>
          {/* Left */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6b7280", marginBottom: 8 }}>Featured</div>

            <h1 style={{ fontSize: 28, lineHeight: 1.15, fontWeight: 700, color: "#111827", marginBottom: 12 }}>
              “JAPI aspires to be the go-to resource for cutting-edge medical research in India and beyond, shaping a healthier future for all.” - Dr. Mangesh Tiwaskar
            </h1>

            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
              <Link href="/about" style={{ padding: "8px 14px", borderRadius: 6, background: "#e5e7eb", color: "#111827", textDecoration: "none", fontSize: 13 }}>Read More</Link>
              <Link href="/author/submit" style={{ padding: "8px 14px", borderRadius: 6, background: "#6b7280", color: "#fff", textDecoration: "none", fontSize: 13 }}>Submit an Article</Link>
            </div>
          </div>

          {/* Right banner */}
          <div style={{ height: 120, background: "#f6f7f8", border: "1px solid #e5e7eb", borderRadius: 6, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src="/hero-banner.png" alt="banner" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        </section>

        {/* Divider */}
        <div style={{ borderTop: "1px solid #eee", marginTop: 24 }} />
      </main>

      {/* Current Issue band */}
      <section style={{ background: "#f7f7f7", padding: "28px 0" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>Current Issue</h2>
            <Link href="/issues" style={{ color: "#111827", textDecoration: "none" }}>View All →</Link>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 24, alignItems: "start" }}>
            {/* Left: cover + actions */}
            <div>
              <div style={{ background: "#fff", padding: 12, border: "1px solid #e5e7eb", borderRadius: 6, marginBottom: 12 }}>
                <img
                  src={latest?.cover_url || "/issue-cover.png"}
                  alt={latest?.title || "Issue cover"}
                  style={{ display: "block", width: "100%", height: "auto", objectFit: "contain" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Link
                  href={latest ? `/issues/${encodeURIComponent(latest.id)}` : "/issues"}
                  style={{ display: "inline-flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "#6b7280", color: "#fff", borderRadius: 6, textDecoration: "none" }}
                >
                  <span>{loadingIssue ? "Loading…" : latest ? "View Issue" : "View Issues"}</span>
                  <span style={{ marginLeft: 8 }}>→</span>
                </Link>

                <a
                  href={latest ? getDownloadHref(latest) : "#"}
                  target={latest?.pdf_path ? "_blank" : undefined}
                  rel="noreferrer"
                  style={{ display: "inline-flex", justifyContent: "flex-start", alignItems: "center", gap: 8, padding: "10px 12px", background: "#fff", color: "#374151", borderRadius: 6, border: "1px solid #e5e7eb", textDecoration: "none" }}
                >
                  <span>{loadingIssue ? "…" : latest?.pdf_path ? "Download Issue" : "No PDF"}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" style={{ width: 14, height: 14 }} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>
                </a>

                {issueErr && <div style={{ color: "crimson", fontSize: 13 }}>{issueErr}</div>}
              </div>
            </div>

            {/* Right: article grid */}
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {[
                  ["Editorial", "Including Kidney Health in the National Public Health Agenda: The Time is Now", "Sumana Vasishta, Vivekanand Jha"],
                  ["Original Article", "Evaluating Pioglitazone for Managing Type 2 Diabetes Mellitus in Patients with...", "Vijay Panikar, Apoorva Gupta"],
                  ["Original Article", "Oral Iron Absorption Test as a Predictor of Response to Oral Iron Therapy and...", "Sanyam Gaur, Vishnu Sharma"],
                  ["Original Article", "Trends in Glomerular Diseases in Northwest India: Has COVID-19 Altered the Diagnostic...", "Abhishek P Singh, Jaydeep R Damor"],
                  ["Original Article", "Retrospective Observational Electronic Medical Records-based Real World Study t...", "Vasu P Kanuru, Jamshed Dalal"],
                  ["Original Article", "Effect of Sleep Quality on Heart Rate Variability in Medical Students: A Cross...", "Prachi Dawer, Kaushal Kumar Alam"],
                ].map((row, idx) => (
                  <article key={idx} style={{ background: "#fff", border: "1px solid #eee", padding: 12, borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>{row[0]}</div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: "#111827", lineHeight: 1.2 }}>{row[1]}</h3>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{row[2]}</div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer (keeps consistent style with other pages) */}
      <footer style={{ borderTop: "1px solid #e5e7eb", padding: "12px 20px", fontSize: 12, color: "#6b7280", marginTop: 18 }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          © {new Date().getFullYear()} JournalDAY · All rights reserved.
        </div>
      </footer>
    </div>
  );
}
