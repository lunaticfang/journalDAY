import type { ReactNode } from "react";
import { buildPageMetadata } from "../../lib/seo";

export const metadata = buildPageMetadata({
  title: "Editorial Board",
  description:
    "Meet the editorial leadership and board members guiding the UpDAYtes journal.",
  path: "/editorial-board",
});

export default function EditorialBoardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
