"use client";

import Link from "next/link";
import { useState } from "react";

export default function AdminRequestAccessPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      setLoading(true);

      const resp = await fetch("/api/admin/request-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          message,
          website,
        }),
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(json?.error || "Failed to submit request.");
      }

      setSuccessMsg(
        json?.message ||
          (json?.emailed
            ? "Request submitted. The owner has been notified and can invite you if approved."
            : "Request submitted and logged. The owner can review it and invite you if approved.")
      );
      setName("");
      setEmail("");
      setMessage("");
      setWebsite("");
    } catch (err) {
      console.error("admin request access submit error:", err);
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to submit request."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 520,
        margin: "80px auto",
        padding: 24,
        background: "#ffffff",
        borderRadius: 8,
        border: "1px solid #e5e7eb",
      }}
    >
      <h1
        style={{
          fontSize: 22,
          fontWeight: 600,
          marginBottom: 6,
          textAlign: "center",
        }}
      >
        Request Admin Access
      </h1>

      <p
        style={{
          fontSize: 13,
          color: "#6b7280",
          marginBottom: 20,
          textAlign: "center",
          lineHeight: 1.6,
        }}
      >
        Admin access requires approval from the owner or an existing approved
        admin. Submit your request here and wait for an invitation. One request
        is enough - we will gently stop duplicates so your inbox does not turn
        into a paperwork festival.
      </p>

      {errorMsg && (
        <div
          style={{
            background: "#fee2e2",
            color: "#991b1b",
            padding: "8px 12px",
            borderRadius: 6,
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div
          style={{
            background: "#dcfce7",
            color: "#166534",
            padding: "8px 12px",
            borderRadius: 6,
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 13 }}>Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={honeypotStyle} aria-hidden="true">
          <label htmlFor="admin-request-website">Website</label>
          <input
            id="admin-request-website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 13 }}>Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13 }}>Why do you need admin access?</label>
          <textarea
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={{
              ...inputStyle,
              minHeight: 120,
              resize: "vertical",
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "10px 0",
            borderRadius: 6,
            border: "none",
            background: "#6A3291",
            color: "white",
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Submitting..." : "Submit Request"}
        </button>
      </form>

      <p style={{ marginTop: 12, fontSize: 13, lineHeight: 1.6 }}>
        <Link href="/admin/login" style={{ color: "#6A3291" }}>
          Back to admin login
        </Link>
      </p>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: 14,
  borderRadius: 6,
  border: "1px solid #d1d5db",
  outline: "none",
};

const honeypotStyle: React.CSSProperties = {
  position: "absolute",
  left: "-10000px",
  top: "auto",
  width: 1,
  height: 1,
  overflow: "hidden",
};
