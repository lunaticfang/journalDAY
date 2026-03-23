import CmsPage from "../../components/CmsPage";
import { buildPageMetadata } from "../../../lib/seo";

export const metadata = buildPageMetadata({
  title: "Transfer of Copyright",
  description:
    "Review the transfer of copyright terms for materials published in UpDAYtes.",
  path: "/instructions/transfer",
});

export default function TransferPage() {
  return <CmsPage contentKey="page.transfer" title="Transfer of Copyright" />;
}
