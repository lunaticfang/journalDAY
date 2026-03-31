import CmsPage from "../../components/CmsPage";
import { buildPageMetadata } from "../../../lib/seo";
import { getSiteContentEntries } from "../../../lib/publicContent";

export const metadata = buildPageMetadata({
  title: "Call for Papers",
  description:
    "Read the latest call for papers, submission themes, and announcement details from UpDAYtes.",
  path: "/notices/call-for-papers",
});

export default async function CallForPapersPage() {
  const content = (await getSiteContentEntries([
    "page.call_for_papers",
  ])) as Record<string, unknown>;

  return (
    <CmsPage
      contentKey="page.call_for_papers"
      title="Call for Papers"
      initialValue={content["page.call_for_papers"]}
    />
  );
}
