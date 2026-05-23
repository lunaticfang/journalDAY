"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import {
  PASSWORD_POLICY_HINT,
  normalizeEmail,
  validatePasswordStrength,
} from "../../../lib/authSecurity";
import PasswordField from "../../components/PasswordField";

type BootstrapStatus = {
  enabled: boolean;
  reason?: string;
  ownerEmail?: string;
  existingAdminEmail?: string | null;
  error?: string;
};

function reasonMessage(status: BootstrapStatus) {
  switch (status.reason) {
    case "missing_secret":
      return "Bootstrap is disabled because ADMIN_BOOTSTRAP_SECRET is not configured on the server.";
    case "owner_exists":
      return "Bootstrap is disabled because the owner account already exists.";
    case "admin_exists":
      return status.existingAdminEmail
        ? `Bootstrap is disabled because an admin already exists (${status.existingAdminEmail}).`
        : "Bootstrap is disabled because an admin already exists.";
    default:
      return "Bootstrap is not available.";
  }
}

export default function AdminBootstrapPage() {
  const router = useRouter();

  const [status, setStatus] = useState<BootstrapStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [email, setEmail] = useState("updaytesjournal@gmail.com");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [secret, setSecret] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const resp = await fetch("/api/admin/bootstrap/status");
        const json = (await resp.json().catch(() => ({}))) as BootstrapStatus;

        if (!resp.ok) {
          throw new Error(json?.error || "Failed to load bootstrap status.");
        }

        if (!cancelled) {
          setStatus(json);
          if (json.ownerEmail) {
            setEmail(json.ownerEmail);
          }
        }
      } catch (err) {
        console.error("bootstrap page status error:", err);
        if (!cancelled) {
          setStatus({
            enabled: false,
            error:
              err instanceof Error
                ? err.message
                : "Failed to load bootstrap status.",
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!status?.enabled) {
      setErrorMsg("Bootstrap is not available.");
      return;
    }

    if (!secret.trim()) {
      setErrorMsg("Enter the bootstrap secret.");
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    const passwordPolicyError = validatePasswordStrength(password);

    if (!normalizedEmail) {
      setErrorMsg("Enter an email address.");
      return;
    }

    if (passwordPolicyError) {
      setErrorMsg(passwordPolicyError);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    try {
      setSaving(true);

      const resp = await fetch("/api/admin/bootstrap/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          secret,
          email: normalizedEmail,
          password,
        }),
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(json?.error || "Failed to create first admin.");
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        setSuccessMsg(
          "Bootstrap completed. Sign in from the admin login page with the credentials you just created."
        );
        return;
      }

      router.replace("/admin");
    } catch (err) {
      console.error("bootstrap create error:", err);
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to create first admin."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1 className="auth-title">First Admin Setup</h1>

        <p className="auth-subtitle">
          This page only works before the first owner/admin exists. Use the owner
          email if you want permanent owner-level access.
        </p>

        <p className="auth-hint">
          Password policy: {PASSWORD_POLICY_HINT}
        </p>

        {loading && <p className="auth-subtitle">Loading bootstrap status...</p>}

        {!loading && status?.error && (
          <div className="auth-alert auth-alert--error">
            {status.error}
          </div>
        )}

        {!loading && status && !status.enabled && (
          <div className="auth-alert auth-alert--neutral">
            {reasonMessage(status)}
          </div>
        )}

        {errorMsg && (
          <div className="auth-alert auth-alert--error">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="auth-alert auth-alert--success">
            {successMsg}
          </div>
        )}

        {status?.enabled && (
          <form onSubmit={handleSubmit} className="auth-form">
            <PasswordField
              label="Bootstrap Secret"
              required
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />

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
              autoComplete="new-password"
            />

            <PasswordField
              label="Confirm Password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />

            <button type="submit" disabled={saving} className="auth-btn">
              {saving ? "Creating..." : "Create First Admin"}
            </button>
          </form>
        )}

        <div className="auth-link-list">
          <Link href="/admin/login">Back to admin login</Link>
        </div>
      </section>
    </main>
  );
}
