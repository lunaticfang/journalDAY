import ArchivePageClient, { type ArchiveIssue } from "./ArchivePageClient";
import { getArchiveIssues } from "../../lib/publicContent";

export const revalidate = 300;

export default async function ArchivePage() {
  let initialIssues: ArchiveIssue[] = [];

  try {
    initialIssues = (await getArchiveIssues()) as ArchiveIssue[];
  } catch (err) {
    console.error("Archive page load error:", err);
  }

  return <ArchivePageClient initialIssues={initialIssues} />;
}
