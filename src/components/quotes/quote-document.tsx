import { getTranslations } from "next-intl/server";
import { lineAmounts, quoteTotals, type QuoteLineInput } from "@/domain/quotes";
import { dateTime, longDate, money, number } from "./format";

export interface QuoteDocumentData {
  reference: string | null;
  title: string;
  language: "en" | "fr";
  currency: string;
  date: string | Date;
  validUntil: string;
  introduction: string | null;
  terms: string | null;
  recipientName: string | null;
  customer: string;
  seller: {
    legalName: string | null;
    legalAddress: string | null;
    legalId: string | null;
    vatNumber: string | null;
    sellerName?: string | null;
    sellerEmail?: string | null;
  };
  lines: (QuoteLineInput & { unit?: string | null })[];
  acceptance: { name: string; title: string | null; at: string | Date } | null;
}

/**
 * The quote as a document: the same component renders the seller's preview,
 * the sent quote and the customer page, in the quote's own language, so what
 * the seller sees is exactly what the customer accepts. Prints cleanly.
 */
export async function QuoteDocument({ doc }: { doc: QuoteDocumentData }) {
  const l = doc.language;
  const t = await getTranslations({ locale: l, namespace: "QuoteDoc" });
  const totals = quoteTotals(doc.lines);
  const m = (n: number) => money(n, doc.currency, l);
  return (
    <article className="quote-doc" lang={l} aria-label={doc.title}>
      <header className="quote-doc-head">
        <div>
          <p className="quote-doc-kicker">{t("quote")}</p>
          <h2 className="quote-doc-title">{doc.title}</h2>
          <p className="quote-doc-ref">
            {doc.reference
              ? t("reference", { ref: doc.reference })
              : t("draft")}
          </p>
        </div>
        <dl className="quote-doc-dates">
          <div>
            <dt>{t("date")}</dt>
            <dd>{longDate(doc.date, l)}</dd>
          </div>
          <div>
            <dt>{t("validUntil")}</dt>
            <dd>{longDate(doc.validUntil, l)}</dd>
          </div>
        </dl>
      </header>
      <div className="quote-doc-parties">
        <section>
          <h3>{t("from")}</h3>
          <p className="quote-doc-strong">{doc.seller.legalName}</p>
          <p className="quote-doc-pre">{doc.seller.legalAddress}</p>
          {doc.seller.legalId ? (
            <p>
              {t("legalId")} {doc.seller.legalId}
            </p>
          ) : null}
          {doc.seller.vatNumber ? (
            <p>
              {t("vatNumber")} {doc.seller.vatNumber}
            </p>
          ) : null}
        </section>
        <section>
          <h3>{t("to")}</h3>
          <p className="quote-doc-strong">{doc.customer}</p>
          {doc.recipientName ? (
            <p>{t("attention", { name: doc.recipientName })}</p>
          ) : null}
        </section>
      </div>
      {doc.introduction ? (
        <p className="quote-doc-pre quote-doc-intro">{doc.introduction}</p>
      ) : null}
      <div className="quote-doc-table-wrap">
        <table className="quote-doc-table">
          <thead>
            <tr>
              <th scope="col">{t("description")}</th>
              <th scope="col" className="num">
                {t("qty")}
              </th>
              <th scope="col" className="num">
                {t("unitPrice")}
              </th>
              <th scope="col" className="num">
                {t("discount")}
              </th>
              <th scope="col" className="num">
                {t("vat")}
              </th>
              <th scope="col" className="num">
                {t("amount")}
              </th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((line, i) => (
              <tr key={i}>
                <td>{line.description}</td>
                <td className="num">
                  {number(line.quantity, l)}
                  {line.unit ? ` ${line.unit}` : ""}
                </td>
                <td className="num">{m(line.unitPrice)}</td>
                <td className="num">
                  {line.discountPct
                    ? t("percent", { value: number(line.discountPct, l) })
                    : "—"}
                </td>
                <td className="num">
                  {t("percent", { value: number(line.vatRate, l) })}
                </td>
                <td className="num">{m(lineAmounts(line).net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="quote-doc-totals">
        <div>
          <dt>{t("subtotal")}</dt>
          <dd>{m(totals.subtotal)}</dd>
        </div>
        {totals.vatByRate.map((v) => (
          <div key={v.rate}>
            <dt>
              {t("vatLine", { rate: number(v.rate, l), base: m(v.base) })}
            </dt>
            <dd>{m(v.vat)}</dd>
          </div>
        ))}
        <div className="quote-doc-grand">
          <dt>{t("total")}</dt>
          <dd>{m(totals.total)}</dd>
        </div>
      </dl>
      {doc.terms ? (
        <section className="quote-doc-terms">
          <h3>{t("terms")}</h3>
          <p className="quote-doc-pre">{doc.terms}</p>
        </section>
      ) : null}
      {doc.seller.sellerName ? (
        <p className="quote-doc-contact">
          {t("contact", {
            name: doc.seller.sellerName,
            email: doc.seller.sellerEmail ?? "",
          })}
        </p>
      ) : null}
      {doc.acceptance ? (
        <p className="quote-doc-accepted">
          {t("acceptance", {
            name: doc.acceptance.name,
            title: doc.acceptance.title ?? "none",
            date: dateTime(doc.acceptance.at, l),
          })}
        </p>
      ) : null}
    </article>
  );
}
