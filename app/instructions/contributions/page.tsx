import CmsPage from "../../components/CmsPage";
import { buildPageMetadata } from "../../../lib/seo";

export const metadata = buildPageMetadata({
  title: "Author Contributions",
  description:
    "Review contribution guidance and authorship expectations for UpDAYtes submissions.",
  path: "/instructions/contributions",
});

export default function ContributionsPage() {
  return <CmsPage contentKey="page.contrib" title="Author Contributions" />;
}
