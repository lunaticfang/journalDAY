// app/owner/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentClientProfile } from "@/lib/clientPermissions";

export default function OwnerPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const access = await getCurrentClientProfile();
      if (!access.user || !access.isOwner) {
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
