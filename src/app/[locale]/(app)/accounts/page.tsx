import { setRequestLocale } from "next-intl/server";
import { Placeholder } from "@/components/app/placeholder";
import { asLocale } from "@/server/navigation";

export default async function Page({
  params,
}: PageProps<"/[locale]/accounts">) {
  setRequestLocale(asLocale((await params).locale));
  return <Placeholder screen="accounts" />;
}
