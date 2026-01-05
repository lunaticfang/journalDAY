"use client";

import Link from "next/link";

export default function LoginChooserPage() {
  return (
    <main
      style={{
        maxWidth: 520,
        margin: "80px auto",
        padding: 24,
        background: "#ffffff",
        borderRadius: 8,
        border: "1px solid #e5e7eb",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 10 }}>
        Sign in to UpDAYtes
      </h1>

      <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 30 }}>
        Choose how you want to continue
      </p>

      <div style={{ display: "grid", gap: 14 }}>
        {/* AUTHOR */}
        <Link
          href="/login/author"
          style={{
            display: "block",
            padding: "14px 16px",
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            textDecoration: "none",
            color: "#111827",
            fontSize: 15,
          }}
        >
          <strong>Continue as Author</strong>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
            Submit manuscripts and track submissions
          </div>
        </Link>

        {/* ADMIN */}
        <Link
          href="/admin/login"
          style={{
            display: "block",
            padding: "14px 16px",
            borderRadius: 6,
            border: "1px solid #6A3291",
            textDecoration: "none",
            color: "#6A3291",
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          Continue as Admin
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
            Editorial & site management
          </div>
        </Link>
      </div>

      <p style={{ marginTop: 24, fontSize: 13 }}>
        <Link href="/" style={{ color: "#6A3291" }}>
          ← Back to home
        </Link>
      </p>
    </main>
  );
}
