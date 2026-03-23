import type { ReactNode } from "react";
import { buildPageMetadata } from "../../lib/seo";

export const metadata = buildPageMetadata({
  title: "Archive",
  description:
    "Browse the UpDAYtes archive and explore previously published journal issues.",
  path: "/archive",
});

export default function ArchiveLayout({ children }: { children: ReactNode }) {
  return children;
}
