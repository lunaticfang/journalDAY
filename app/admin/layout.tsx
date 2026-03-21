"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

const OWNER_EMAIL = "updaytesjournal@gmail.com";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/admin/login" || pathname === "/admin/bootstrap") {
      return;
    }

    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        router.replace("/admin/login");
        return;
      }

      if (user.email === OWNER_EMAIL) {
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role, approved")
        .eq("id", user.id)
        .maybeSingle();

      const allowedRoles = ["admin", "editor", "reviewer"];

      if (
        error ||
        !profile ||
        profile.approved !== true ||
        !allowedRoles.includes(profile.role)
      ) {
        router.replace("/");
        return;
      }
    })();
  }, [pathname, router]);

  return <>{children}</>;
}
