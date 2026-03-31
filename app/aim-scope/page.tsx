import CmsPage from "../components/CmsPage";
import { buildPageMetadata } from "../../lib/seo";
import { getSiteContentEntries } from "../../lib/publicContent";

export const metadata = buildPageMetadata({
  title: "Aim & Scope",
  description:
    "Review the scope, research focus, and publication areas covered by UpDAYtes.",
  path: "/aim-scope",
});

export default async function AimScopePage() {
  const content = (await getSiteContentEntries([
    "page.aim_scope",
  ])) as Record<string, unknown>;

  return (
    <CmsPage
      contentKey="page.aim_scope"
      title="Aim & Scope"
      initialValue={content["page.aim_scope"]}
    />
  );
}
