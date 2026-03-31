import ArchivePageClient, { type ArchiveIssue } from "../archive/ArchivePageClient";
import { buildPageMetadata } from "../../lib/seo";
import { getArchiveIssues } from "../../lib/publicContent";

export const metadata = buildPageMetadata({
  title: "All Issues",
  description:
    "Browse all published UpDAYtes issues and explore the journal archive.",
  path: "/issues",
});

export default async function IssuesIndex() {
  let initialIssues: ArchiveIssue[] = [];

  try {
    initialIssues = (await getArchiveIssues()) as ArchiveIssue[];
  } catch (err) {
    console.error("Issues index load error:", err);
  }

  return <ArchivePageClient initialIssues={initialIssues} />;
}
