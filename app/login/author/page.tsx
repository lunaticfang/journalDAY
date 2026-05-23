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
import PasswordField from "../../components/PasswordField";

type AuthMode = "signin" | "signup";

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
        "If this email is new, check your inbox once to verify it. If you have already signed up with this email, another account was not created - switch to Sign in or use Forgot password instead."
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
      <main className="auth-shell">
        <section className="auth-card auth-card--wide">
          <p className="auth-subtitle" style={{ marginBottom: 0 }}>
            Checking session...
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <section className="auth-card auth-card--wide">
        <h1 className="auth-title">
          Sign in to <span style={{ color: "#6A3291" }}>UpDAYtes</span>
        </h1>

        <p className="auth-subtitle">
          Authors now sign in with email and password. Email verification is only used once when creating a new account.
        </p>

        <p className="auth-hint">
          Password policy: {PASSWORD_POLICY_HINT}
        </p>

        <div className="auth-tabs">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setErrorMsg("");
              setStatus("");
            }}
            className={`auth-tab ${mode === "signin" ? "is-active" : ""}`}
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
            className={`auth-tab ${mode === "signup" ? "is-active" : ""}`}
          >
            Create account
          </button>
        </div>

        {errorMsg && (
          <div className="auth-alert auth-alert--error">
            {errorMsg}
          </div>
        )}

        {status && (
          <div className="auth-alert auth-alert--success">
            {status}
          </div>
        )}

        {mode === "signin" ? (
          <form onSubmit={handleSignIn} className="auth-form">
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              spellCheck={false}
              className="auth-input"
            />
            <PasswordField
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button type="submit" disabled={loading} className="auth-btn">
              {loading ? "Signing in..." : "Sign in"}
            </button>
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
          </form>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <div className="auth-alert auth-alert--neutral" style={{ marginBottom: 0 }}>
              If this email was already used before, a second account will not be created.
              In that case, use <strong>Sign in</strong> or <strong>Forgot password?</strong>
              after switching back to the sign-in tab.
            </div>

            <form onSubmit={handleSignUp} className="auth-form">
              <input
                type="email"
                placeholder="you@example.com"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                autoComplete="username"
                spellCheck={false}
                className="auth-input"
              />
              <PasswordField
                placeholder="Create password"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                autoComplete="new-password"
              />
              <PasswordField
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button type="submit" disabled={loading} className="auth-btn">
                {loading ? "Creating account..." : "Create account"}
              </button>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}

