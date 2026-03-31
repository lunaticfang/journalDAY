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
    <main
      style={{
        maxWidth: 460,
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
        First Admin Setup
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
        This page only works before the first owner/admin exists. Use the owner
        email if you want permanent owner-level access.
      </p>

      <p
        style={{
          fontSize: 12,
          color: "#6b7280",
          marginBottom: 20,
          textAlign: "center",
          lineHeight: 1.6,
        }}
      >
        Password policy: {PASSWORD_POLICY_HINT}
      </p>

      {loading && <p style={{ fontSize: 13 }}>Loading bootstrap status...</p>}

      {!loading && status?.error && (
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
          {status.error}
        </div>
      )}

      {!loading && status && !status.enabled && (
        <div
          style={{
            background: "#f3f4f6",
            color: "#374151",
            padding: "10px 12px",
            borderRadius: 6,
            fontSize: 13,
            marginBottom: 14,
            lineHeight: 1.6,
          }}
        >
          {reasonMessage(status)}
        </div>
      )}

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

      {status?.enabled && (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13 }}>Bootstrap Secret</label>
            <input
              type="password"
              required
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
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
              autoComplete="username"
              spellCheck={false}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13 }}>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13 }}>Confirm Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              width: "100%",
              padding: "10px 0",
              borderRadius: 6,
              border: "none",
              background: "#6A3291",
              color: "white",
              fontSize: 14,
              fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Creating..." : "Create First Admin"}
          </button>
        </form>
      )}

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
