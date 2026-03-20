"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminInviteAcceptPage() {
  const router = useRouter();
  const [token, setToken] = useState("");

  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    const parsed = new URLSearchParams(search).get("token") || "";
    setToken(parsed);
  }, []);

  const handleApprove = async () => {
    if (!token || busy || done) return;

    setBusy(true);
    setError("");

    try {
      const resp = await fetch("/api/admin/users/accept-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      const json = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        throw new Error(json?.error || "Could not process invite");
      }

      setDone(true);
    } catch (err: any) {
      setError(err?.message || "Could not process invite");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main
      style={{
        maxWidth: 560,
        margin: "80px auto",
        padding: 24,
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        background: "#ffffff",
      }}
    >
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
        Confirm Admin Invitation
      </h1>

      {!token && (
        <p style={{ color: "#991b1b", marginBottom: 14 }}>
          This invite link is missing a token.
        </p>
      )}

      {token && !done && (
        <p style={{ color: "#374151", marginBottom: 14 }}>
          Click approve to confirm this admin invitation. A second email will be sent
          with your password setup link.
        </p>
      )}

      {error && (
        <p style={{ color: "#991b1b", marginBottom: 14 }}>{error}</p>
      )}

      {done && (
        <>
          <p style={{ color: "#065f46", marginBottom: 14 }}>
            Invitation approved. Check your email for the password setup link.
          </p>
          <button
            type="button"
            onClick={() => router.push("/admin/login")}
            style={primaryBtn}
          >
            Go to Admin Login
          </button>
        </>
      )}

      {!done && (
        <button
          type="button"
          onClick={handleApprove}
          disabled={!token || busy}
          style={{
            ...primaryBtn,
            opacity: !token || busy ? 0.6 : 1,
            cursor: !token || busy ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "Processing..." : "Approve Invitation"}
        </button>
      )}
    </main>
  );
}

const primaryBtn: React.CSSProperties = {
  border: "none",
  borderRadius: 6,
  background: "#6A3291",
  color: "white",
  padding: "10px 14px",
  fontWeight: 600,
};
