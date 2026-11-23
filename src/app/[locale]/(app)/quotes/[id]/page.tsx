import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Group, LargeTitle, Row } from "@/components/ios/list";
import { CopyLink, PrintButton } from "@/components/quotes/copy-link";
import { dateTime } from "@/components/quotes/format";
import {
  QuoteDocument,
  type QuoteDocumentData,
} from "@/components/quotes/quote-document";
import { QuoteEditor } from "@/components/quotes/quote-editor";
import { salesProfile } from "@/domain/profiles";
import {
  canRevise,
  displayStatus,
  quoteReference,
  type SendProblem,
} from "@/domain/quotes";
import { Link } from "@/i18n/navigation";
import { getDb } from "@/server/db/client";
import { asLocale } from "@/server/navigation";
import { getQuote, getQuoteSettings } from "@/server/services/quotes";
import { requireMember } from "@/server/session";
import {
  deleteQuoteAction,
  markWonAction,
  renewLinkAction,
  reviseQuoteAction,
  saveQuoteAction,
  sendQuoteAction,
} from "../actions";

const statusPill: Record<string, string> = {
  draft: "ios-pill",
  sent: "ios-pill ios-pill-blue",
  accepted: "ios-pill ios-pill-green",
  declined: "ios-pill ios-pill-red",
  superseded: "ios-pill",
  expired: "ios-pill ios-pill-orange",
};

export default async function QuotePage({
  params,
  searchParams,
}: PageProps<"/[locale]/quotes/[id]">) {
  const { locale: raw, id } = await params;
  const locale = asLocale(raw);
  setRequestLocale(locale);
  const member = await requireMember(locale);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = getDb();
  const q = await getQuote(db, member.ctx, id);
  if (!q) notFound();
  const settings = await getQuoteSettings(db, member.ctx);
  const t = await getTranslations("Quotes");
  const sp = await searchParams;
  const one = (k: string) =>
    typeof sp[k] === "string" ? (sp[k] as string) : undefined;
  const today = new Date().toISOString().slice(0, 10);
  const status = displayStatus(q.status, q.validUntil, today);
  const ref = quoteReference(q.number, q.revision);
  const link = (await cookies()).get(`quote_link_${id}`)?.value;
  const problems = (one("problems") ?? "")
    .split(",")
    .filter(Boolean) as SendProblem[];
  const seller = (q.sellerSnapshot as QuoteDocumentData["seller"] | null) ?? {
    legalName: settings.legalName,
    legalAddress: settings.legalAddress,
    legalId: settings.legalId,
    vatNumber: settings.vatNumber,
    sellerName: member.name || member.email,
    sellerEmail: member.email,
  };
  const doc: QuoteDocumentData = {
    reference: ref,
    title: q.title,
    language: q.language,
    currency: q.currency,
    date: q.sentAt ?? new Date(),
    validUntil: q.validUntil,
    introduction: q.introduction,
    terms: q.terms,
    recipientName: q.recipientName,
    customer: q.accountName,
    seller,
    lines: q.lines,
    acceptance:
      q.status === "accepted" && q.responderName && q.respondedAt
        ? { name: q.responderName, title: q.responderTitle, at: q.respondedAt }
        : null,
  };
  const hidden = (
    <>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="locale" value={locale} />
    </>
  );
  const products = salesProfile(settings.salesProfile).products.map((p) => ({
    key: p.key,
    name: locale === "fr" ? p.nameFr : p.nameEn,
  }));

  return (
    <>
      <p className="no-print">
        <Link href="/deals" className="ios-back">
          {t("back")}
        </Link>
      </p>
      <LargeTitle
        title={ref ? `${t("title")} ${ref}` : t("draftTitle")}
        subtitle={`${q.accountName} · ${q.dealName}`}
      />
      <p className="no-print">
        <span className={statusPill[status]}>{t("status", { status })}</span>
      </p>
      {one("saved") ? (
        <p className="ios-notice no-print" role="status">
          {t("saved")}
        </p>
      ) : null}
      {one("won") ? (
        <p className="ios-notice no-print" role="status">
          {t("markedWon")}
        </p>
      ) : null}
      {one("emailed") ? (
        <p className="ios-notice no-print" role="status">
          {t("emailed", { email: one("emailed")! })}
        </p>
      ) : null}
      {one("error") ? (
        <p className="ios-notice ios-notice-error no-print" role="alert">
          {t("error", { code: one("error")! })}
        </p>
      ) : null}
      {problems.length ? (
        <ul className="ios-notice ios-notice-error no-print" role="alert">
          {problems.map((p) => (
            <li key={p}>{t("problem", { problem: p })}</li>
          ))}
        </ul>
      ) : null}

      {q.status === "draft" ? (
        <QuoteEditor
          id={id}
          locale={locale}
          currency={q.currency}
          products={products}
          defaultVat={settings.defaultVatRate}
          save={saveQuoteAction}
          send={sendQuoteAction}
          remove={deleteQuoteAction}
          initial={{
            title: q.title,
            language: q.language,
            validUntil: q.validUntil,
            introduction: q.introduction ?? "",
            terms: q.terms ?? "",
            recipientName: q.recipientName ?? "",
            recipientEmail: q.recipientEmail ?? "",
            lines: q.lines.map((l) => ({
              description: l.description,
              quantity: String(l.quantity),
              unit: l.unit ?? "",
              unitPrice: String(l.unitPrice),
              discountPct: String(l.discountPct),
              vatRate: String(l.vatRate),
              productKey: l.productKey ?? "",
            })),
          }}
        />
      ) : (
        <>
          {link ? (
            <Group header={t("linkTitle")} footer={t("linkOnce")}>
              <CopyLink url={link} />
            </Group>
          ) : null}
          <Group header={t("activity")}>
            <Row
              title={
                q.viewedAt
                  ? t("viewed", { date: dateTime(q.viewedAt, locale) })
                  : t("notViewed")
              }
            />
            {q.respondedAt && q.responderName ? (
              <Row
                title={t(
                  q.status === "declined" ? "declinedBy" : "acceptedBy",
                  {
                    name: q.responderName,
                    date: dateTime(q.respondedAt, locale),
                  },
                )}
                sub={
                  q.declineReason
                    ? t("reason", { reason: q.declineReason })
                    : undefined
                }
              />
            ) : null}
            {q.newerRevision ? (
              <Row
                href={`/quotes/${q.newerRevision.id}`}
                title={t("openNewer", { revision: q.newerRevision.revision })}
              />
            ) : null}
          </Group>
          <div className="quote-actions no-print">
            {q.status === "accepted" && !q.dealWon ? (
              <form action={markWonAction}>
                {hidden}
                <button className="ios-btn" type="submit">
                  {t("markWon")}
                </button>
                <p className="ios-group-footer">{t("markWonHelp")}</p>
              </form>
            ) : null}
            {q.status === "accepted" && q.dealWon ? (
              <p className="ios-notice">{t("dealWon")}</p>
            ) : null}
            {q.status === "sent" ? (
              <form action={renewLinkAction}>
                {hidden}
                <button className="ios-btn ios-btn-plain" type="submit">
                  {t("renewLink")}
                </button>
                <p className="ios-group-footer">{t("renewHelp")}</p>
              </form>
            ) : null}
            {canRevise(q.status) && !q.newerRevision ? (
              <form action={reviseQuoteAction}>
                {hidden}
                <button className="ios-btn ios-btn-secondary" type="submit">
                  {t("revise")}
                </button>
                <p className="ios-group-footer">{t("reviseHelp")}</p>
              </form>
            ) : null}
            <PrintButton label={t("print")} />
          </div>
          <QuoteDocument doc={doc} />
        </>
      )}
    </>
  );
}
