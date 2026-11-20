import { getTranslations, setRequestLocale } from "next-intl/server";
import { LargeTitle } from "@/components/ios/list";
import { Link } from "@/i18n/navigation";
import { asLocale } from "@/server/navigation";
import { getCurrentUser } from "@/server/session";
import { acceptInvitationAction } from "./actions";

const ERRORS = ["invalid", "expired", "used", "wrong_email"] as const;

export default async function InvitePage({
  params,
  searchParams,
}: PageProps<"/[locale]/invite/[token]">) {
  const { locale: raw, token } = await params;
  const locale = asLocale(raw);
  setRequestLocale(locale);
  const t = await getTranslations("Invite");
  const common = await getTranslations("Common");
  const error = (await searchParams).error;
  const user = await getCurrentUser();
  const here = `/${locale}/invite/${encodeURIComponent(token)}`;
  return (
    <main
      id="main"
      className="ios-page"
      style={{ maxWidth: 520, paddingTop: 48 }}
    >
      <LargeTitle title={t("title")} subtitle={t("lead")} />
      {typeof error === "string" &&
      (ERRORS as readonly string[]).includes(error) ? (
        <p className="ios-notice ios-notice-error" role="alert">
          {t(error as (typeof ERRORS)[number])}
        </p>
      ) : null}
      {user ? (
        <form action={acceptInvitationAction}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="token" value={token} />
          <button type="submit" className="ios-btn">
            {t("accept")}
          </button>
        </form>
      ) : (
        <>
          <p className="ios-group-footer">{t("signInFirst")}</p>
          <Link
            className="ios-btn"
            href={{ pathname: "/sign-in", query: { next: here } }}
          >
            {common("signIn")}
          </Link>
        </>
      )}
    </main>
  );
}
