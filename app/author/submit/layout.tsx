import type { ReactNode } from "react";
import { buildPageMetadata } from "../../../lib/seo";

export const metadata = buildPageMetadata({
  title: "Submit a Manuscript",
  description:
    "Submit your manuscript to UpDAYtes through the journal's online submission portal.",
  path: "/author/submit",
});

export default function AuthorSubmitLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
