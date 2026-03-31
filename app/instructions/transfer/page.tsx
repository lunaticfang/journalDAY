import CmsPage from "../../components/CmsPage";
import { buildPageMetadata } from "../../../lib/seo";
import { getSiteContentEntries } from "../../../lib/publicContent";

export const metadata = buildPageMetadata({
  title: "Transfer of Copyright",
  description:
    "Review the transfer of copyright terms for materials published in UpDAYtes.",
  path: "/instructions/transfer",
});

export default async function TransferPage() {
  const content = (await getSiteContentEntries([
    "page.transfer",
  ])) as Record<string, unknown>;

  return (
    <CmsPage
      contentKey="page.transfer"
      title="Transfer of Copyright"
      initialValue={content["page.transfer"]}
    />
  );
}
