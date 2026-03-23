import CmsPage from "../../components/CmsPage";
import { buildPageMetadata } from "../../../lib/seo";

export const metadata = buildPageMetadata({
  title: "Copyright Statement",
  description:
    "Understand the copyright and publication rights policy for UpDAYtes.",
  path: "/instructions/copyright",
});

export default function CopyrightPage() {
  return <CmsPage contentKey="page.copyright" title="Copyright Statement" />;
}
