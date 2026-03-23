import CmsPage from "../components/CmsPage";
import { buildPageMetadata } from "../../lib/seo";

export const metadata = buildPageMetadata({
  title: "About the Journal",
  description:
    "Learn about UpDAYtes, its mission, editorial direction, and the journal's publishing focus.",
  path: "/about",
});

export default function AboutPage() {
  return <CmsPage contentKey="page.about" title="About the Journal" />;
}
