"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useRouter } from "next/navigation";

type Profile = {
  id: string;
  role: "admin" | "author";
  approved?: boolean | null;
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  /* ------------------------------------------------------------------ */
  /* Ensure profile exists (first login = signup)                        */
  /* ------------------------------------------------------------------ */
  async function ensureProfile(user: { id: string; email?: string | null }) {
    if (!user?.id) return null;

    const { data: existing } = await supabase
      .from("profiles")
      .select("id, role, approved")
      .eq("id", user.id)
      .maybeSingle();

    if (existing) return existing as Profile;

    const { data: created } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          email: user.email ?? null,
          role: "author", // default
          approved: false,
        },
        { onConflict: "id" }
      )
      .select()
      .maybeSingle();

    return created as Profile | null;
  }

  /* ------------------------------------------------------------------ */
  /* Session check (magic link redirect)                                 */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    let mounted = true;

    async function handleSession() {
      const { data } = await supabase.auth.getUser();
      const user = data?.user ?? null;

      if (!user) {
        if (mounted) setChecking(false);
        return;
      }

      const profile = await ensureProfile(user);
      if (!mounted) return;

      // Admins go to admin only if approved
      if (profile?.role === "admin" && profile.approved === true) {
        router.replace("/admin");
      } else {
        // All normal users land here
        router.replace("/author/submit");
      }
    }

    handleSession();

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const user = session?.user;
        if (!user) return;

        const profile = await ensureProfile(user);

        if (profile?.role === "admin" && profile.approved === true) {
          router.replace("/admin");
        } else {
          router.replace("/author/submit");
        }
      }
    );

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, [router]);

  /* ------------------------------------------------------------------ */
  /* Send magic link                                                     */
  /* ------------------------------------------------------------------ */
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    if (!email) {
      setStatus("Please enter your email address.");
      return;
    }

    setStatus("Sending sign-in link…");

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

  /* ------------------------------------------------------------------ */
  /* UI                                                                  */
  /* ------------------------------------------------------------------ */
  if (checking) {
    return (
      <main style={{ maxWidth: 600, margin: "40px auto" }}>
        <p>Checking session…</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 600, margin: "40px auto" }}>
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>
        Sign in to <span style={{ color: "#6A3291" }}>UpDAYtes</span>
      </h1>

      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
        Sign in to submit manuscripts or manage your submissions.
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
