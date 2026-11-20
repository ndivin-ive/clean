import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";
import { LargeTitle } from "@/components/ios/list";
import { asLocale, safeNext } from "@/server/navigation";
import { getCurrentUser } from "@/server/session";

export default async function SignInPage({
  params,
  searchParams,
}: PageProps<"/[locale]/sign-in">) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null, locale);
  if (await getCurrentUser()) redirect(next);
  const t = await getTranslations("Auth");
  return (
    <main
      id="main"
      className="ios-page"
      style={{ maxWidth: 480, paddingTop: 48 }}
    >
      <LargeTitle title={t("title")} subtitle={t("lead")} />
      <SignInForm next={next} />
    </main>
  );
}
