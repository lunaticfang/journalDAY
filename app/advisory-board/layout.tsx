import type { ReactNode } from "react";
import { buildPageMetadata } from "../../lib/seo";

export const metadata = buildPageMetadata({
  title: "Advisory Board",
  description:
    "View the advisory board and international advisors contributing to UpDAYtes.",
  path: "/advisory-board",
});

export default function AdvisoryBoardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
