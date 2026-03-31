import CmsPage from "../../components/CmsPage";
import { buildPageMetadata } from "../../../lib/seo";
import { getSiteContentEntries } from "../../../lib/publicContent";

export const metadata = buildPageMetadata({
  title: "Copyright Statement",
  description:
    "Understand the copyright and publication rights policy for UpDAYtes.",
  path: "/instructions/copyright",
});

export default async function CopyrightPage() {
  const content = (await getSiteContentEntries([
    "page.copyright",
  ])) as Record<string, unknown>;

  return (
    <CmsPage
      contentKey="page.copyright"
      title="Copyright Statement"
      initialValue={content["page.copyright"]}
    />
  );
}
