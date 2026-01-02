// app/owner/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const OWNER_EMAIL = "updaytesjournal@gmail.com";

export default function OwnerPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;

      if (!user || user.email !== OWNER_EMAIL) {
        router.replace("/");
        return;
      }

      setChecking(false);
    })();
  }, [router]);

  if (checking) {
    return <p style={{ padding: 20 }}>Checking permissions…</p>;
  }

  return (
    <main style={{ maxWidth: 900, margin: "40px auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>
        Owner Dashboard
      </h1>

      <p style={{ marginTop: 8, color: "#4b5563" }}>
        You have full control over site content.
      </p>
    </main>
  );
}
