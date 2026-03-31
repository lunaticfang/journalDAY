"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import { getCurrentClientAccess } from "../../../lib/clientPermissions";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [checking, setChecking] = useState(true);
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

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    if (!email) {
      setStatus("Please enter your email address.");
      return;
    }

    setStatus("Sending sign-in link...");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    if (error) {
      setStatus(error.message);
    } else {
      setStatus("Check your email for the sign-in link.");
    }
  }

  if (checking) {
    return (
      <main style={{ maxWidth: 600, margin: "40px auto" }}>
        <p>Checking session...</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 600, margin: "40px auto" }}>
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>
        Sign in to <span style={{ color: "#6A3291" }}>UpDAYtes</span>
      </h1>

      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
        Sign in to submit manuscripts, manage submissions, or continue to the admin dashboard if this email has staff access.
      </p>

      <form onSubmit={handleLogin} style={{ display: "grid", gap: 12 }}>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            padding: 10,
            borderRadius: 6,
            border: "1px solid #d1d5db",
            fontSize: 14,
          }}
        />

        <button
          type="submit"
          style={{
            padding: "10px 14px",
            borderRadius: 6,
            background: "#6A3291",
            color: "white",
            border: "none",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Send login link
        </button>
      </form>

      {status && (
        <p style={{ marginTop: 12, fontSize: 13, color: "#374151" }}>
          {status}
        </p>
      )}
    </main>
  );
}
