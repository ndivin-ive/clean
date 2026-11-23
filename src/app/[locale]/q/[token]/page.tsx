import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PrintButton } from "@/components/quotes/copy-link";
import { longDate } from "@/components/quotes/format";
import { QuoteDocument } from "@/components/quotes/quote-document";
import { brandCss, isHex } from "@/domain/branding";
import { displayStatus, quoteReference } from "@/domain/quotes";
import { getDb } from "@/server/db/client";
import { asLocale } from "@/server/navigation";
import { getQuoteByToken } from "@/server/services/quotes";
import { respondAction } from "./actions";

// The link is private: never indexed, never sent as a referrer.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * Customer page of a quote (D-060). No account: the 256-bit link token is the
 * only key, and the database returns the document fields only. The customer
 * can print it, accept it (name, optional title, explicit consent) or decline.
 */
export default async function PublicQuotePage({
  params,
  searchParams,
}: PageProps<"/[locale]/q/[token]">) {
  const { locale: raw, token } = await params;
  const locale = asLocale(raw);
  setRequestLocale(locale);
  const t = await getTranslations("QuotePublic");
  const q = await getQuoteByToken(getDb(), token);
  const error = (await searchParams).error;

  if (!q || q.status === "superseded" || !q.lines) {
    return (
      <main id="main" className="ios-page quote-public">
        <p className="ios-notice" role="status">
          {q?.status === "superseded" ? t("superseded") : t("notFound")}
        </p>
      </main>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const status = displayStatus(q.status, q.validUntil!, today);
  const seller = q.seller!;
  const brand = isHex(seller.brandColor)
    ? { color: seller.brandColor, ink: seller.brandInk }
    : null;

  return (
    <main id="main" className="ios-page quote-public">
      {brand ? (
        <style dangerouslySetInnerHTML={{ __html: brandCss(brand) }} />
      ) : null}
      <p className="quote-public-intro no-print">
        {t("intro", { seller: seller.legalName ?? seller.sellerName })}
      </p>
      {typeof error === "string" ? (
        <p className="ios-notice ios-notice-error no-print" role="alert">
          {t("error", { code: error })}
        </p>
      ) : null}
      {status === "accepted" ? (
        <p className="ios-notice no-print" role="status">
          {t("accepted", {
            date: longDate(q.respondedAt!, locale),
            name: q.responderName ?? "",
          })}
        </p>
      ) : null}
      {status === "declined" ? (
        <p className="ios-notice no-print" role="status">
          {t("declined", { date: longDate(q.respondedAt!, locale) })}
        </p>
      ) : null}
      {status === "expired" ? (
        <p className="ios-notice ios-notice-error no-print" role="status">
          {t("expired", {
            date: longDate(q.validUntil!, locale),
            seller: seller.legalName ?? seller.sellerName,
          })}
        </p>
      ) : null}

      <QuoteDocument
        doc={{
          reference: quoteReference(q.number ?? null, q.revision ?? 1),
          title: q.title!,
          language: q.language,
          currency: q.currency!,
          date: q.sentAt!,
          validUntil: q.validUntil!,
          introduction: q.introduction ?? null,
          terms: q.terms ?? null,
          recipientName: q.recipientName ?? null,
          customer: q.customer ?? "",
          seller,
          lines: q.lines,
          acceptance:
            q.status === "accepted" && q.responderName && q.respondedAt
              ? {
                  name: q.responderName,
                  title: q.responderTitle ?? null,
                  at: q.respondedAt,
                }
              : null,
        }}
      />

      {status === "sent" ? (
        <div className="quote-respond no-print">
          <form action={respondAction} className="ios-group">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="decision" value="accepted" />
            <h2 className="ios-group-header">{t("acceptTitle")}</h2>
            <div className="ios-list">
              <label className="ios-row quote-field">
                <span>{t("name")}</span>
                <input
                  className="ios-input"
                  name="name"
                  required
                  maxLength={120}
                  autoComplete="name"
                />
              </label>
              <label className="ios-row quote-field">
                <span>{t("jobTitle")}</span>
                <input
                  className="ios-input"
                  name="title"
                  maxLength={120}
                  autoComplete="organization-title"
                />
              </label>
              <label className="ios-row quote-check">
                <input type="checkbox" name="agree" value="1" required />
                <span>{t("agree")}</span>
              </label>
            </div>
            <button type="submit" className="ios-btn">
              {t("accept")}
            </button>
            <p className="ios-group-footer">{t("privacy")}</p>
          </form>
          <details className="ios-group">
            <summary className="ios-group-header">{t("declineTitle")}</summary>
            <form action={respondAction} className="ios-group">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="decision" value="declined" />
              <div className="ios-list">
                <label className="ios-row quote-field">
                  <span>{t("name")}</span>
                  <input
                    className="ios-input"
                    name="name"
                    required
                    maxLength={120}
                    autoComplete="name"
                  />
                </label>
                <label className="ios-row quote-field">
                  <span>{t("reason")}</span>
                  <textarea
                    className="ios-input quote-textarea"
                    name="reason"
                    maxLength={2000}
                  />
                </label>
              </div>
              <button type="submit" className="ios-btn ios-btn-danger">
                {t("decline")}
              </button>
            </form>
          </details>
        </div>
      ) : null}
      <div className="no-print">
        <PrintButton label={t("print")} />
      </div>
      <p className="ios-group-footer quote-powered no-print">
        {t("poweredBy")}
      </p>
    </main>
  );
}
