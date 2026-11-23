import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LargeTitle } from "@/components/ios/list";
import { can } from "@/domain/permissions";
import { getDb } from "@/server/db/client";
import { asLocale } from "@/server/navigation";
import { getQuoteSettings } from "@/server/services/quotes";
import { requireMember } from "@/server/session";
import { saveCompanyAction } from "./actions";

/** Admin: legal identity and quote defaults (D-060). */
export default async function CompanySettingsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/settings/company">) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  const member = await requireMember(locale);
  if (!can(member.roles, "org.settings")) notFound();
  const t = await getTranslations("CompanySettings");
  const s = await getQuoteSettings(getDb(), member.ctx);
  const sp = await searchParams;
  const field = (
    name: keyof typeof s,
    label: string,
    opts: { type?: string; area?: boolean } = {},
  ) => (
    <label className="ios-row quote-field">
      <span>{label}</span>
      {opts.area ? (
        <textarea
          className="ios-input quote-textarea"
          name={name}
          defaultValue={String(s[name] ?? "")}
        />
      ) : (
        <input
          className="ios-input"
          name={name}
          type={opts.type ?? "text"}
          defaultValue={String(s[name] ?? "")}
        />
      )}
    </label>
  );
  return (
    <>
      <LargeTitle title={t("title")} subtitle={t("lead")} />
      {sp.saved ? (
        <p className="ios-notice" role="status">
          {t("saved")}
        </p>
      ) : null}
      {sp.error ? (
        <p className="ios-notice ios-notice-error" role="alert">
          {t("invalid")}
        </p>
      ) : null}
      <form
        action={saveCompanyAction}
        className="ios-group"
        style={{ gap: 18 }}
      >
        <input type="hidden" name="locale" value={locale} />
        <section className="ios-group">
          <h2 className="ios-group-header">{t("identity")}</h2>
          <div className="ios-list">
            {field("legalName", t("legalName"))}
            {field("legalAddress", t("legalAddress"), { area: true })}
            {field("legalId", t("legalId"))}
            {field("vatNumber", t("vatNumber"))}
          </div>
        </section>
        <section className="ios-group">
          <h2 className="ios-group-header">{t("defaults")}</h2>
          <div className="ios-list">
            {field("quoteValidityDays", t("validity"), { type: "number" })}
            {field("defaultVatRate", t("vat"))}
            {field("quoteTerms", t("quoteTerms"), { area: true })}
          </div>
        </section>
        <button type="submit" className="ios-btn">
          {t("save")}
        </button>
      </form>
    </>
  );
}
