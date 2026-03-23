"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentClientAccess } from "../../lib/clientPermissions";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (
      pathname === "/admin/login" ||
      pathname === "/admin/bootstrap" ||
      pathname === "/admin/request-access"
    ) {
      return;
    }

    (async () => {
      const access = await getCurrentClientAccess(["admin", "editor", "reviewer"]);
      if (!access.user) {
        router.replace("/admin/login");
        return;
      }

      if (!access.allowed) {
        router.replace("/");
        return;
      }
    })();
  }, [pathname, router]);

  return <>{children}</>;
}
