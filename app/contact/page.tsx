import CmsPage from "../components/CmsPage";
import { buildPageMetadata } from "../../lib/seo";

export const metadata = buildPageMetadata({
  title: "Contact Us",
  description:
    "Get in touch with the UpDAYtes journal team for editorial, publication, or submission-related questions.",
  path: "/contact",
});

export default function ContactPage() {
  return <CmsPage contentKey="page.contact" title="Contact Us" />;
}
