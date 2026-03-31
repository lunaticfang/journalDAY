import CmsPage from "../../components/CmsPage";
import { buildPageMetadata } from "../../../lib/seo";
import { getSiteContentEntries } from "../../../lib/publicContent";

export const metadata = buildPageMetadata({
  title: "Author Contributions",
  description:
    "Review contribution guidance and authorship expectations for UpDAYtes submissions.",
  path: "/instructions/contributions",
});

export default async function ContributionsPage() {
  const content = (await getSiteContentEntries([
    "page.contrib",
  ])) as Record<string, unknown>;

  return (
    <CmsPage
      contentKey="page.contrib"
      title="Author Contributions"
      initialValue={content["page.contrib"]}
    />
  );
}
