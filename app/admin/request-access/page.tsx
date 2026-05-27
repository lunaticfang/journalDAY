"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";

export default function AdminRequestAccessPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function appendErrorReference(message: string, errorId: string | null | undefined) {
    const normalizedMessage = String(message || "").trim();
    const normalizedErrorId = String(errorId || "").trim();
    if (!normalizedErrorId) {
      return normalizedMessage;
    }
    return `${normalizedMessage} Reference: ${normalizedErrorId}.`;
  }

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
        throw new Error(
          appendErrorReference(json?.error || "Failed to submit request.", json?.errorId)
        );
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
      setErrorMsg(err instanceof Error ? err.message : "Failed to submit request.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card auth-card--wide">
        <h1 className="auth-title">Request Admin Access</h1>

        <p className="auth-subtitle">
          Admin access is approved by the owner or an existing admin. Submit one request and
          we will route it to the right person.
        </p>

        {errorMsg && <div className="auth-alert auth-alert--error">{errorMsg}</div>}

        {successMsg && <div className="auth-alert auth-alert--success">{successMsg}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label>Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="auth-input"
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
              onChange={(event) => setWebsite(event.target.value)}
              className="auth-input"
            />
          </div>

          <div className="auth-field">
            <label>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              spellCheck={false}
              className="auth-input"
            />
          </div>

          <div className="auth-field">
            <label>Why do you need admin access?</label>
            <textarea
              required
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="auth-input auth-input--textarea"
            />
          </div>

          <button type="submit" disabled={loading} className="auth-btn">
            {loading ? "Submitting..." : "Submit request"}
          </button>
        </form>

        <div className="auth-link-list">
          <Link href="/admin/login">Back to admin login</Link>
        </div>
      </section>
    </main>
  );
}

const honeypotStyle: CSSProperties = {
  position: "absolute",
  left: "-10000px",
  top: "auto",
  width: 1,
  height: 1,
  overflow: "hidden",
};
