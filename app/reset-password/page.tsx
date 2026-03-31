"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 14,
  borderRadius: 8,
  border: "1px solid #d1d5db",
  outline: "none",
};

export default function ResetPasswordPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [hasRecoveryAccess, setHasRecoveryAccess] = useState(false);
  const [nextTarget, setNextTarget] = useState("/login/author");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (typeof window !== "undefined") {
      const raw = new URLSearchParams(window.location.search).get("next");
      if (raw && raw.startsWith("/")) {
        setNextTarget(raw);
      }
    }

    async function syncRecoverySession() {
      const { data } = await supabase.auth.getSession();

      if (cancelled) return;

      setHasRecoveryAccess(Boolean(data.session?.user));
      setChecking(false);
    }

    void syncRecoverySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;

      setHasRecoveryAccess(Boolean(session?.user));
      setChecking(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    setErrorMsg(null);

    if (!hasRecoveryAccess) {
      setErrorMsg("Open the password reset link from your email in this browser first.");
      return;
    }

    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        throw error;
      }

      setStatusMsg("Password updated. Redirecting...");

      setTimeout(() => {
        router.replace(nextTarget);
      }, 1200);
    } catch (err: any) {
      console.error("password reset error:", err);
      setErrorMsg(err.message || "Could not update the password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 480,
        margin: "80px auto",
        padding: 24,
        background: "#ffffff",
        borderRadius: 12,
        border: "1px solid #e5e7eb",
      }}
    >
      <h1
        style={{
          fontSize: 24,
          fontWeight: 700,
          marginBottom: 8,
          textAlign: "center",
        }}
      >
        Set a new password
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
        Use the recovery link from your email once, then choose a new password here.
      </p>

      {errorMsg && (
        <div
          style={{
            background: "#fee2e2",
            color: "#991b1b",
            padding: "10px 12px",
            borderRadius: 8,
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {errorMsg}
        </div>
      )}

      {statusMsg && (
        <div
          style={{
            background: "#ecfdf5",
            color: "#166534",
            padding: "10px 12px",
            borderRadius: 8,
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {statusMsg}
        </div>
      )}

      {checking ? (
        <p style={{ margin: 0, color: "#6b7280" }}>Checking your recovery link...</p>
      ) : hasRecoveryAccess ? (
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: "#6A3291",
              color: "white",
              border: "none",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Updating password..." : "Update password"}
          </button>
        </form>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.6 }}>
            We could not detect an active recovery session yet. Open the password reset
            email on this device and browser, then try again.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/login/author" style={{ color: "#6A3291", fontWeight: 600 }}>
              Author login
            </Link>
            <Link href="/admin/login" style={{ color: "#6A3291", fontWeight: 600 }}>
              Admin login
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
