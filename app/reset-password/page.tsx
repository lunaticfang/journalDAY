"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  PASSWORD_POLICY_HINT,
  validatePasswordStrength,
} from "../../lib/authSecurity";
import PasswordField from "../components/PasswordField";

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

    const passwordPolicyError = validatePasswordStrength(password);

    if (passwordPolicyError) {
      setErrorMsg(passwordPolicyError);
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
    <main className="auth-shell">
      <section className="auth-card">
        <h1 className="auth-title">Set a new password</h1>

        <p className="auth-subtitle">
          Use the recovery link from your email once, then choose a new password here.
        </p>

        <p className="auth-hint">
          Password policy: {PASSWORD_POLICY_HINT}
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

        {checking ? (
          <p className="auth-subtitle" style={{ marginBottom: 0 }}>
            Checking your recovery link...
          </p>
        ) : hasRecoveryAccess ? (
          <form onSubmit={handleSubmit} className="auth-form">
            <PasswordField
              placeholder="New password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
            />
            <PasswordField
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
            />
            <button type="submit" disabled={loading} className="auth-btn">
              {loading ? "Updating password..." : "Update password"}
            </button>
          </form>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <p className="auth-subtitle" style={{ textAlign: "left", marginBottom: 0 }}>
              We could not detect an active recovery session yet. Open the password reset
              email on this device and browser, then try again.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }} className="auth-link-list">
              <Link href="/login/author">
                Author login
              </Link>
              <Link href="/admin/login">
                Admin login
              </Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
