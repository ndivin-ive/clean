import { getTranslations, setRequestLocale } from "next-intl/server";
import { LargeTitle } from "@/components/ios/list";
import { asLocale } from "@/server/navigation";
import { requireUser } from "@/server/session";
import { createOrganizationAction } from "./actions";

export default async function OnboardingPage({
  params,
  searchParams,
}: PageProps<"/[locale]/onboarding">) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  await requireUser(locale);
  const error = (await searchParams).error;
  const t = await getTranslations("Onboarding");
  const common = await getTranslations("Common");
  return (
    <main
      id="main"
      className="ios-page"
      style={{ maxWidth: 520, paddingTop: 48 }}
    >
      <LargeTitle title={t("title")} subtitle={t("lead")} />
      <form
        action={createOrganizationAction}
        className="ios-group"
        style={{ gap: 18 }}
      >
        <input type="hidden" name="locale" value={locale} />
        <div className="ios-group">
          <label htmlFor="org-name" className="ios-group-header">
            {t("name")}
          </label>
          <div className="ios-list">
            <input
              id="org-name"
              name="name"
              className="ios-input"
              required
              placeholder={t("namePlaceholder")}
            />
          </div>
        </div>
        <div className="ios-group">
          <label htmlFor="org-lang" className="ios-group-header">
            {t("language")}
          </label>
          <div className="ios-list">
            <div className="ios-row">
              <select
                id="org-lang"
                name="defaultLanguage"
                className="ios-select"
                defaultValue={locale}
                style={{ width: "100%" }}
              >
                <option value="en">
                  {common("localeName", { locale: "en" })}
                </option>
                <option value="fr">
                  {common("localeName", { locale: "fr" })}
                </option>
              </select>
            </div>
          </div>
        </div>
        {error ? (
          <p className="ios-notice ios-notice-error" role="alert">
            {t("error")}
          </p>
        ) : null}
        <button type="submit" className="ios-btn">
          {t("submit")}
        </button>
      </form>
    </main>
  );
}
