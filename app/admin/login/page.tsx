"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { getCurrentClientAccess } from "../../../lib/clientPermissions";
import PasswordField from "../../components/PasswordField";
import {
  INVALID_CREDENTIALS_MESSAGE,
  RESET_REQUEST_MESSAGE,
  normalizeEmail,
} from "../../../lib/authSecurity";

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

  function resolveNextPath() {
    const next =
      typeof window !== "undefined"
        ? String(new URLSearchParams(window.location.search).get("next") || "").trim()
        : "";
    if (!next.startsWith("/") || next.startsWith("//")) {
      return "/admin";
    }
    return next;
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [statusResp, access] = await Promise.all([
          fetch("/api/admin/bootstrap/status"),
          getCurrentClientAccess(["admin", "editor", "reviewer"]),
        ]);

        if (!cancelled && access.allowed) {
          router.replace(resolveNextPath());
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
      const normalizedEmail = normalizeEmail(email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error || !data.user) {
        throw error || new Error(INVALID_CREDENTIALS_MESSAGE);
      }

      const access = await getCurrentClientAccess(["admin", "editor", "reviewer"]);
      if (!access.allowed) {
        await supabase.auth.signOut();
        throw new Error(
          "Sign-in worked, but this account is not approved for admin access yet. Use Request admin access if you still need staff access."
        );
      }

      router.replace(resolveNextPath());
    } catch (err: any) {
      console.error("Admin login error:", err);
      if (
        err?.message?.includes?.("not approved for admin access yet")
      ) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg(INVALID_CREDENTIALS_MESSAGE);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setErrorMsg(null);
    setStatusMsg(null);

    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      setErrorMsg("Enter your staff email address first, then use Forgot password.");
      return;
    }

    setRecoveryLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/reset-password?next=${encodeURIComponent(
          "/admin/login"
        )}`,
      });

      if (error) {
        throw error;
      }

      setStatusMsg(RESET_REQUEST_MESSAGE);
    } catch (err: any) {
      console.error("Admin password recovery error:", err);
      setErrorMsg(err.message || "Could not send the password reset email.");
    } finally {
      setRecoveryLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <p className="auth-subtitle" style={{ marginBottom: 0 }}>
            Checking session...
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1 className="auth-title">Admin Login</h1>

        <p className="auth-subtitle">
          Approved admins, editors, and reviewers sign in here with email and password. Reviewer assignments are completed inside the portal after sign-in.
        </p>

        {errorMsg && (
          <div className="auth-alert auth-alert--error">
            {errorMsg}
          </div>
        )}

        {statusMsg && (
          <div className="auth-alert auth-alert--success">
            {statusMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="auth-form">
          <div className="auth-field">
            <label>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              spellCheck={false}
              className="auth-input"
            />
          </div>

          <PasswordField
            label="Password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          <button type="submit" disabled={loading} className="auth-btn">
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <button
          type="button"
          disabled={recoveryLoading}
          onClick={() => {
            void handleForgotPassword();
          }}
          className="auth-inline-link"
        >
          {recoveryLoading ? "Sending reset link..." : "Forgot password?"}
        </button>

        <div className="auth-link-list">
          <Link href="/">Back to home</Link>
          {bootstrapAvailable && <Link href="/admin/bootstrap">First-time setup</Link>}
          <Link href="/admin/request-access">Request admin access</Link>
        </div>
      </section>
    </main>
  );
}
