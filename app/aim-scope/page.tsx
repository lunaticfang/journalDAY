import CmsPage from "../components/CmsPage";
import { buildPageMetadata } from "../../lib/seo";

export const metadata = buildPageMetadata({
  title: "Aim & Scope",
  description:
    "Review the scope, research focus, and publication areas covered by UpDAYtes.",
  path: "/aim-scope",
});

export default function AimScopePage() {
  return <CmsPage contentKey="page.aim_scope" title="Aim & Scope" />;
}
