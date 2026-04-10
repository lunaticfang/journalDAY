"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import { getCurrentClientAccess } from "../../../lib/clientPermissions";
import {
  INVALID_CREDENTIALS_MESSAGE,
  PASSWORD_POLICY_HINT,
  RESET_REQUEST_MESSAGE,
  normalizeEmail,
  validatePasswordStrength,
} from "../../../lib/authSecurity";

type AuthMode = "signin" | "signup";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 14,
  borderRadius: 8,
  border: "1px solid #d1d5db",
  outline: "none",
};

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    async function routeCurrentUser() {
      const access = await getCurrentClientAccess(["admin", "editor", "reviewer"]);

      if (!mounted) return;

      if (!access.user) {
        setChecking(false);
        return;
      }

      if (access.allowed) {
        router.replace("/admin");
      } else {
        router.replace("/author/submit");
      }
    }

    void routeCurrentUser();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) return;

      const access = await getCurrentClientAccess(["admin", "editor", "reviewer"]);

      if (access.allowed) {
        router.replace("/admin");
      } else {
        router.replace("/author/submit");
      }
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, [router]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setStatus("");
    setErrorMsg("");

    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      setErrorMsg("Enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error || !data.user) {
        throw error || new Error(INVALID_CREDENTIALS_MESSAGE);
      }

      const access = await getCurrentClientAccess(["admin", "editor", "reviewer"]);
      if (access.allowed) {
        router.replace("/admin");
      } else {
        router.replace("/author/submit");
      }
    } catch (err: any) {
      console.error("author login error:", err);
      setErrorMsg(INVALID_CREDENTIALS_MESSAGE);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setStatus("");
    setErrorMsg("");

    const normalizedEmail = normalizeEmail(signupEmail);
    const passwordPolicyError = validatePasswordStrength(signupPassword);

    if (!normalizedEmail) {
      setErrorMsg("Enter your email address.");
      return;
    }

    if (passwordPolicyError) {
      setErrorMsg(passwordPolicyError);
      return;
    }

    if (signupPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: signupPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/login/author`,
        },
      });

      if (error) {
        throw error;
      }

      setStatus(
        "If this email is new, check your inbox once to verify it. If you have already signed up with this email, another account was not created — switch to Sign in or use Forgot password instead."
      );
      setMode("signin");
      setEmail(normalizedEmail);
      setPassword("");
      setSignupEmail(normalizedEmail);
      setSignupPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error("author signup error:", err);
      setErrorMsg(err.message || "Could not create your account.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setStatus("");
    setErrorMsg("");

    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      setErrorMsg("Enter your email address first, then use Forgot password.");
      return;
    }

    setRecoveryLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/reset-password?next=${encodeURIComponent(
          "/login/author"
        )}`,
      });

      if (error) {
        throw error;
      }

      setStatus(RESET_REQUEST_MESSAGE);
    } catch (err: any) {
      console.error("author password recovery error:", err);
      setErrorMsg(err.message || "Could not send the password reset email.");
    } finally {
      setRecoveryLoading(false);
    }
  }

  if (checking) {
    return (
      <main style={{ maxWidth: 640, margin: "40px auto" }}>
        <p>Checking session...</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 640, margin: "40px auto" }}>
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>
        Sign in to <span style={{ color: "#6A3291" }}>UpDAYtes</span>
      </h1>

      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16, lineHeight: 1.6 }}>
        Authors now sign in with email and password. Email verification is only used once when creating a new account.
      </p>

      <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 16, lineHeight: 1.6 }}>
        Password policy: {PASSWORD_POLICY_HINT}
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => {
            setMode("signin");
            setErrorMsg("");
            setStatus("");
          }}
          style={{
            padding: "10px 14px",
            borderRadius: 999,
            border: mode === "signin" ? "1px solid #6A3291" : "1px solid #d1d5db",
            background: mode === "signin" ? "#6A3291" : "#ffffff",
            color: mode === "signin" ? "#ffffff" : "#111827",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("signup");
            setErrorMsg("");
            setStatus("");
          }}
          style={{
            padding: "10px 14px",
            borderRadius: 999,
            border: mode === "signup" ? "1px solid #6A3291" : "1px solid #d1d5db",
            background: mode === "signup" ? "#6A3291" : "#ffffff",
            color: mode === "signup" ? "#ffffff" : "#111827",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Create account
        </button>
      </div>

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

      {status && (
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
          {status}
        </div>
      )}

      {mode === "signin" ? (
        <form onSubmit={handleSignIn} style={{ display: "grid", gap: 12 }}>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            spellCheck={false}
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
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
            {loading ? "Signing in..." : "Sign in"}
          </button>
          <button
            type="button"
            disabled={recoveryLoading}
            onClick={() => {
              void handleForgotPassword();
            }}
            style={{
              justifySelf: "start",
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
        </form>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          <div
            style={{
              background: "#f8f5fc",
              border: "1px solid #e9def3",
              color: "#4b5563",
              padding: "10px 12px",
              borderRadius: 8,
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            If this email was already used before, a second account will not be created.
            In that case, use <strong>Sign in</strong> or <strong>Forgot password?</strong>
            after switching back to the sign-in tab.
          </div>

          <form onSubmit={handleSignUp} style={{ display: "grid", gap: 12 }}>
            <input
              type="email"
              placeholder="you@example.com"
              value={signupEmail}
              onChange={(e) => setSignupEmail(e.target.value)}
              autoComplete="username"
              spellCheck={false}
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="Create password"
              value={signupPassword}
              onChange={(e) => setSignupPassword(e.target.value)}
              autoComplete="new-password"
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
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
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
