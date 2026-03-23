// app/issues/page.tsx
import ArchivePage from "../archive/page";
import { buildPageMetadata } from "../../lib/seo";

export const metadata = buildPageMetadata({
  title: "All Issues",
  description:
    "Browse all published UpDAYtes issues and explore the journal archive.",
  path: "/issues",
});

export default function IssuesIndex() {
  // Just reuse the archive UI here
  return <ArchivePage />;
}
