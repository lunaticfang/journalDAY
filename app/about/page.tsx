import CmsPage from "../components/CmsPage";
import { buildPageMetadata } from "../../lib/seo";
import { getSiteContentEntries } from "../../lib/publicContent";

export const metadata = buildPageMetadata({
  title: "About the Journal",
  description:
    "Learn about UpDAYtes, its mission, editorial direction, and the journal's publishing focus.",
  path: "/about",
});

export default async function AboutPage() {
  const content = (await getSiteContentEntries([
    "page.about",
  ])) as Record<string, unknown>;

  return (
    <CmsPage
      contentKey="page.about"
      title="About the Journal"
      initialValue={content["page.about"]}
    />
  );
}
