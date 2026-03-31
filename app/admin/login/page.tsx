"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { getCurrentClientAccess } from "../../../lib/clientPermissions";

type BootstrapStatus = {
  enabled?: boolean;
};

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [bootstrapAvailable, setBootstrapAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [statusResp, access] = await Promise.all([
          fetch("/api/admin/bootstrap/status"),
          getCurrentClientAccess(["admin", "editor", "reviewer"]),
        ]);

        if (!cancelled && access.allowed) {
          router.replace("/admin");
          return;
        }

        const json = (await statusResp.json().catch(() => ({}))) as BootstrapStatus;
        if (!cancelled && statusResp.ok) {
          setBootstrapAvailable(Boolean(json.enabled));
        }
      } catch (err) {
        console.error("Admin login setup error:", err);
      } finally {
        if (!cancelled) {
          setCheckingSession(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user) {
        throw error || new Error("Invalid credentials");
      }

      const access = await getCurrentClientAccess(["admin", "editor", "reviewer"]);
      if (!access.allowed) {
        await supabase.auth.signOut();
        throw new Error(
          "Sign-in worked, but this account is not approved for admin access yet. Use Request admin access if you still need staff access."
        );
      }

      router.replace("/admin");
    } catch (err: any) {
      console.error("Admin login error:", err);
      setErrorMsg(err.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setErrorMsg(null);
    setStatusMsg(null);

    if (!email.trim()) {
      setErrorMsg("Enter your staff email address first, then use Forgot password.");
      return;
    }

    setRecoveryLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password?next=${encodeURIComponent(
          "/admin/login"
        )}`,
      });

      if (error) {
        throw error;
      }

      setStatusMsg(
        "Password reset email sent. Open the link in your inbox to choose a new password."
      );
    } catch (err: any) {
      console.error("Admin password recovery error:", err);
      setErrorMsg(err.message || "Could not send the password reset email.");
    } finally {
      setRecoveryLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main
        style={{
          maxWidth: 420,
          margin: "80px auto",
          padding: 24,
          background: "#ffffff",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
        }}
      >
        <p style={{ margin: 0, color: "#6b7280" }}>Checking session...</p>
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: 420,
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
        Admin Login
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
        Approved staff sign in with email and password. New admins are still added through the existing request and invite flow.
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

      {statusMsg && (
        <div
          style={{
            background: "#ecfdf5",
            color: "#166534",
            padding: "8px 12px",
            borderRadius: 6,
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {statusMsg}
        </div>
      )}

      <form onSubmit={handleLogin}>
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
          <label style={{ fontSize: 13 }}>Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
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
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <button
        type="button"
        disabled={recoveryLoading}
        onClick={() => {
          void handleForgotPassword();
        }}
        style={{
          marginTop: 12,
          padding: 0,
          border: "none",
          background: "transparent",
          color: "#6A3291",
          fontSize: 13,
          fontWeight: 600,
          cursor: recoveryLoading ? "not-allowed" : "pointer",
        }}
      >
        {recoveryLoading ? "Sending reset link..." : "Forgot password?"}
      </button>

      <p style={{ marginTop: 10, fontSize: 13 }}>
        <Link href="/" style={{ color: "#6A3291" }}>
          Back to home
        </Link>
      </p>

      {bootstrapAvailable && (
        <p style={{ marginTop: 8, fontSize: 13 }}>
          <Link href="/admin/bootstrap" style={{ color: "#6A3291" }}>
            First-time setup
          </Link>
        </p>
      )}

      <p style={{ marginTop: 8, fontSize: 13 }}>
        <Link href="/admin/request-access" style={{ color: "#6A3291" }}>
          Request admin access
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
