import CmsPage from "../components/CmsPage";
import { buildPageMetadata } from "../../lib/seo";
import { getSiteContentEntries } from "../../lib/publicContent";

export const metadata = buildPageMetadata({
  title: "Contact Us",
  description:
    "Get in touch with the UpDAYtes journal team for editorial, publication, or submission-related questions.",
  path: "/contact",
});

export default async function ContactPage() {
  const content = (await getSiteContentEntries([
    "page.contact",
  ])) as Record<string, unknown>;

  return (
    <CmsPage
      contentKey="page.contact"
      title="Contact Us"
      initialValue={content["page.contact"]}
    />
  );
}
