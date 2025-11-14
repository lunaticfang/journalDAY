"use client";

import { useState } from "react";
import { supabase } from "../../../lib/supabaseClient"; // path: app/admin/login -> ../../../lib
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const router = useRouter();

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) { setStatus("Enter an email"); return; }
    setStatus("Sending sign-in link...");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/admin` },
    });
    if (error) setStatus("Error: " + error.message);
    else setStatus("Check your email for the login link.");
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
