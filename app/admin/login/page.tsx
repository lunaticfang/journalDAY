"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient"; // path: app/admin/login -> ../../../lib
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Helper: ensure there's a profiles row for the user (creates if missing)
  async function ensureProfileExists(user: { id: string; email?: string | null }) {
    if (!user?.id) return null;
    try {
      // Try fetch existing profile
      const { data } = await supabase.from("profiles").select("id, role, full_name").eq("id", user.id).maybeSingle();
      if (data) return data;

      // Create a minimal profile record (default role = author)
      const { data: upserted } = await supabase
        .from("profiles")
        .upsert({ id: user.id, email: user.email ?? null, role: "author" }, { onConflict: "id" })
        .select()
        .maybeSingle();

      return upserted;
    } catch (err) {
      // don't block the flow if profile ops fail; return null and continue with default routing
      console.error("ensureProfileExists error:", err);
      return null;
    }
  }

  // When the page loads, check if user already signed in (e.g., after clicking magic link)
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        // get current session user (works after magic-link redirect)
        const { data: userData } = await supabase.auth.getUser();

        const user = userData?.user ?? null;
        if (!user) {
          // no user signed in yet
          if (mounted) setLoading(false);
          return;
        }

        // ensure profile exists and fetch role
        const profile = await ensureProfileExists({ id: user.id, email: user.email });

        // role-aware redirect
        const role = profile?.role ?? "author";
        if (role === "editor" || profile?.is_editor) {
          router.replace("/admin");
        } else if (role === "author") {
          router.replace("/author/dashboard");
        } else {
          router.replace("/author/submit");
        }
      } catch (err) {
        console.error(err);
        if (mounted) {
          setStatus("Error verifying session. Try signing in again.");
          setLoading(false);
        }
      }
    })();

    // also listen to auth state changes (optional; helps if session is created after page load)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      if (!user) {
        // if user signed out
        return;
      }
      // when auth state changes to signed-in, ensure profile and redirect
      (async () => {
        const profile = await ensureProfileExists({ id: user.id, email: user.email });
        const role = profile?.role ?? "author";
        if (role === "editor" || profile?.is_editor) {
          router.replace("/admin");
        } else if (role === "author") {
          router.replace("/author/dashboard");
        } else {
          router.replace("/author/submit");
        }
      })();
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [router]);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      setStatus("Enter an email");
      return;
    }
    setStatus("Sending sign-in link...");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/admin` },
      });
      if (error) setStatus("Error: " + error.message);
      else setStatus("Check your email for the login link.");
    } catch (err: any) {
      console.error(err);
      setStatus("Error sending link: " + (err.message || String(err)));
    }
  }

  if (loading) {
    return (
      <main style={{ padding: 24, maxWidth: 600, margin: "0 auto" }}>
        <h1 style={{ fontSize: 20, marginBottom: 12 }}>Admin sign in</h1>
        <p>Checking session…</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, marginBottom: 12 }}>Admin sign in</h1>
      <form onSubmit={handleMagicLink} style={{ display: "grid", gap: 10 }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="editor@example.com"
          style={{ padding: 8, borderRadius: 6, border: "1px solid #ddd" }}
        />
        <button style={{ padding: "8px 12px", borderRadius: 6, background: "#0b74de", color: "white", border: "none" }}>
          Send magic link
        </button>
      </form>
      <p style={{ marginTop: 12, color: "#555" }}>{status}</p>
      <p style={{ marginTop: 8 }}>
        Back to <a href="/">home</a>.
      </p>
    </main>
  );
}
