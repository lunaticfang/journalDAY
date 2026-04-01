import { redirect } from "next/navigation";

export default function LegacyTransferRedirectPage() {
  redirect("/instructions/how-to-submit");
}
