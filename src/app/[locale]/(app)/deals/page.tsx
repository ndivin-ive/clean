import { getTranslations, setRequestLocale } from "next-intl/server";
import { LargeTitle } from "@/components/ios/list";
import { longDate, money } from "@/components/quotes/format";
import { displayStatus, quoteReference } from "@/domain/quotes";
import { Link } from "@/i18n/navigation";
import { getDb } from "@/server/db/client";
import { asLocale } from "@/server/navigation";
import { listDealsWithQuotes } from "@/server/services/quotes";
import { requireMember } from "@/server/session";
import { createQuoteAction } from "../quotes/actions";

const pill: Record<string, string> = {
  draft: "ios-pill",
  sent: "ios-pill ios-pill-blue",
  accepted: "ios-pill ios-pill-green",
  declined: "ios-pill ios-pill-red",
  superseded: "ios-pill",
  expired: "ios-pill ios-pill-orange",
};

/** Deals list with their quotes (first slice of P6; the deal page comes next). */
export default async function DealsPage({
  params,
}: PageProps<"/[locale]/deals">) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  const member = await requireMember(locale);
  const t = await getTranslations("Deals");
  const tq = await getTranslations("Quotes");
  const deals = await listDealsWithQuotes(getDb(), member.ctx);
  const today = new Date().toISOString().slice(0, 10);
  const groups = [
    {
      key: "open",
      label: t("open"),
      items: deals.filter((d) => !d.isWon && !d.isLost),
    },
    {
      key: "closed",
      label: t("closed"),
      items: deals.filter((d) => d.isWon || d.isLost),
    },
  ];
  return (
    <>
      <LargeTitle title={t("title")} subtitle={t("subtitle")} />
      {deals.length === 0 ? <p className="ios-empty">{t("empty")}</p> : null}
      {groups.map((g) =>
        g.items.length ? (
          <section className="ios-group" key={g.key}>
            <h2 className="ios-group-header">{g.label}</h2>
            <div className="ios-list">
              {g.items.map((d) => (
                <div className="ios-row deal-row" key={d.id}>
                  <div className="ios-row-main">
                    <span>{d.name}</span>
                    <span className="ios-row-sub">
                      {d.accountName} ·{" "}
                      {locale === "fr" ? d.stageNameFr : d.stageNameEn}
                      {d.amount != null
                        ? ` · ${money(d.amount, d.currency, locale)}`
                        : ""}
                      {d.closeDate
                        ? ` · ${t("closeDate", { date: longDate(d.closeDate, locale) })}`
                        : ""}
                    </span>
                    {d.quotes.length ? (
                      <span className="deal-quotes">
                        {d.quotes.map((q) => {
                          const st = displayStatus(
                            q.status,
                            q.validUntil,
                            today,
                          );
                          return (
                            <Link
                              key={q.id}
                              href={`/quotes/${q.id}`}
                              className={pill[st]}
                            >
                              {quoteReference(q.number, q.revision) ??
                                tq("draftTitle")}
                              {" · "}
                              {tq("status", { status: st })}
                            </Link>
                          );
                        })}
                      </span>
                    ) : null}
                  </div>
                  {!d.isWon && !d.isLost ? (
                    <form action={createQuoteAction}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="dealId" value={d.id} />
                      <button
                        type="submit"
                        className="ios-btn ios-btn-sm ios-btn-secondary"
                      >
                        {t("newQuote")}
                      </button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null,
      )}
    </>
  );
}
