// app/page.tsx

export default function HomePage() {
  return (
    <main>
      {/* Hero */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2.2fr) minmax(0, 1.6fr)",
          gap: 32,
          alignItems: "center",
        }}
      >
        <div>
          <p
            style={{
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#6b7280",
              marginBottom: 8,
            }}
          >
            Online Journal Platform
          </p>
          <h1
            style={{
              fontSize: 32,
              lineHeight: 1.15,
              fontWeight: 700,
              marginBottom: 10,
              color: "#111827",
            }}
          >
            Manage submissions, peer review, and publication in one place.
          </h1>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: "#4b5563",
              maxWidth: 560,
            }}
          >
            JournalDAY supports the full editorial workflow — from manuscript
            submission to final issue publication — for small, focused journals
            and editorial teams.
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 22,
            }}
          >
            <a
              href="/issues"
              style={{
                padding: "9px 18px",
                borderRadius: 999,
                backgroundColor: "#111827",
                color: "white",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              Browse issues →
            </a>
            <a
              href="/author/submit"
              style={{
                padding: "9px 18px",
                borderRadius: 999,
                border: "1px solid #d1d5db",
                backgroundColor: "white",
                color: "#111827",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              Submit a manuscript
            </a>
            <a
              href="/admin"
              style={{
                padding: "9px 18px",
                borderRadius: 999,
                border: "1px solid #e5e7eb",
                color: "#6b7280",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              Editor dashboard
            </a>
          </div>
        </div>

        {/* Side card */}
        <div
          style={{
            background: "white",
            borderRadius: 16,
            border: "1px solid #e5e7eb",
            padding: 20,
            boxShadow: "0 10px 25px rgba(15,23,42,0.05)",
          }}
        >
          <h2
            style={{
              fontSize: 16,
              fontWeight: 600,
              marginBottom: 4,
              color: "#111827",
            }}
          >
            Workflow at a glance
          </h2>
          <p style={{ fontSize: 13, color: "#4b5563", marginBottom: 12 }}>
            A simple, JAPI-style editorial pipeline:
          </p>

          <ol
            style={{
              listStyle: "decimal",
              paddingLeft: 20,
              fontSize: 13,
              color: "#374151",
              display: "grid",
              gap: 4,
            }}
          >
            <li>Authors submit manuscripts and track status.</li>
            <li>Editors manage review and decisions.</li>
            <li>Accepted manuscripts are grouped into issues.</li>
            <li>Issues and articles appear publicly under “Issues”.</li>
          </ol>
        </div>
      </section>

      {/* Section */}
      <section
        style={{
          marginTop: 40,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
          }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
            Submission & review
          </h3>
          <p style={{ fontSize: 13, color: "#4b5563" }}>
            Authors upload PDF manuscripts. Editors track statuses like
            submitted, under review, accepted, and published.
          </p>
        </div>
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
          }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
            Issues & articles
          </h3>
          <p style={{ fontSize: 13, color: "#4b5563" }}>
            Accepted manuscripts are grouped into issues. Readers browse issues,
            open articles, and access PDFs.
          </p>
        </div>
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
          }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
            Secure storage
          </h3>
          <p style={{ fontSize: 13, color: "#4b5563" }}>
            Manuscripts are stored privately via Supabase, with signed URLs for
            editors and public links for published content.
          </p>
        </div>
      </section>
    </main>
  );
}
