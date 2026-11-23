"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { lineAmounts, lineProblems, quoteTotals } from "@/domain/quotes";
import { money, number } from "./format";

export interface EditorLine {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discountPct: string;
  vatRate: string;
  productKey: string;
}
export interface EditorInitial {
  title: string;
  language: "en" | "fr";
  validUntil: string;
  introduction: string;
  terms: string;
  recipientName: string;
  recipientEmail: string;
  lines: EditorLine[];
}

const num = (v: string) =>
  v.trim() === "" ? Number.NaN : Number(v.replace(",", "."));

/**
 * Draft quote editor. Totals are computed live with the same pure functions
 * the server uses (src/domain/quotes.ts). The whole draft is posted as JSON;
 * the server validates it again before saving.
 */
export function QuoteEditor({
  id,
  locale,
  currency,
  initial,
  products,
  defaultVat,
  save,
  send,
  remove,
}: {
  id: string;
  locale: "en" | "fr";
  currency: string;
  initial: EditorInitial;
  products: { key: string; name: string }[];
  defaultVat: number;
  save: (fd: FormData) => Promise<void>;
  send: (fd: FormData) => Promise<void>;
  remove: (fd: FormData) => Promise<void>;
}) {
  const t = useTranslations("Quotes");
  const common = useTranslations("Common");
  const [d, setD] = useState<EditorInitial>(initial);
  const set = <K extends keyof EditorInitial>(k: K, v: EditorInitial[K]) =>
    setD((x) => ({ ...x, [k]: v }));
  const setLine = (i: number, k: keyof EditorLine, v: string) =>
    setD((x) => ({
      ...x,
      lines: x.lines.map((l, j) => {
        if (j !== i) return l;
        if (k === "productKey") {
          const p = products.find((pp) => pp.key === v);
          return {
            ...l,
            productKey: v,
            description: l.description || p?.name || "",
          };
        }
        return { ...l, [k]: v };
      }),
    }));
  const parsed = useMemo(
    () =>
      d.lines.map((l) => ({
        description: l.description,
        quantity: num(l.quantity),
        unitPrice: num(l.unitPrice),
        discountPct: num(l.discountPct || "0"),
        vatRate: num(l.vatRate),
        unit: l.unit,
        productKey: l.productKey || null,
      })),
    [d.lines],
  );
  const valid = parsed.filter((l) => lineProblems(l).length === 0);
  const totals = quoteTotals(valid);
  const m = (n: number) => money(n, currency, locale);
  const payload = JSON.stringify({ ...d, lines: parsed });

  return (
    <form className="quote-editor">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="payload" value={payload} />

      <section className="ios-group">
        <h2 className="ios-group-header">{t("header")}</h2>
        <div className="ios-list">
          <label className="ios-row quote-field">
            <span>{t("titleField")}</span>
            <input
              className="ios-input"
              required
              value={d.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </label>
          <label className="ios-row quote-field">
            <span>{t("validUntil")}</span>
            <input
              className="ios-input"
              type="date"
              required
              value={d.validUntil}
              onChange={(e) => set("validUntil", e.target.value)}
            />
          </label>
          <label className="ios-row quote-field">
            <span>{t("language")}</span>
            <select
              className="ios-select"
              value={d.language}
              onChange={(e) =>
                set("language", e.target.value === "en" ? "en" : "fr")
              }
            >
              <option value="fr">
                {common("localeName", { locale: "fr" })}
              </option>
              <option value="en">
                {common("localeName", { locale: "en" })}
              </option>
            </select>
          </label>
        </div>
      </section>

      <section className="ios-group">
        <h2 className="ios-group-header">{t("recipient")}</h2>
        <div className="ios-list">
          <label className="ios-row quote-field">
            <span>{t("recipientName")}</span>
            <input
              className="ios-input"
              value={d.recipientName}
              onChange={(e) => set("recipientName", e.target.value)}
            />
          </label>
          <label className="ios-row quote-field">
            <span>{t("recipientEmail")}</span>
            <input
              className="ios-input"
              type="email"
              value={d.recipientEmail}
              onChange={(e) => set("recipientEmail", e.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="ios-group">
        <h2 className="ios-group-header">{t("introduction")}</h2>
        <div className="ios-list">
          <textarea
            className="ios-input quote-textarea"
            aria-label={t("introduction")}
            value={d.introduction}
            onChange={(e) => set("introduction", e.target.value)}
          />
        </div>
        <p className="ios-group-footer">{t("introductionHint")}</p>
      </section>

      <section className="ios-group">
        <h2 className="ios-group-header">{t("lines")}</h2>
        <div className="quote-lines">
          {d.lines.map((l, i) => {
            const p = parsed[i]!;
            const bad = new Set(lineProblems(p));
            const amounts = bad.size ? null : lineAmounts(p);
            return (
              <fieldset
                key={i}
                className="quote-line-card"
                aria-label={`${t("lines")} ${i + 1}`}
              >
                {products.length ? (
                  <select
                    className="ios-select"
                    aria-label={t("product")}
                    value={l.productKey}
                    onChange={(e) => setLine(i, "productKey", e.target.value)}
                  >
                    <option value="">{t("productNone")}</option>
                    {products.map((pp) => (
                      <option key={pp.key} value={pp.key}>
                        {pp.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                <label className="quote-line-desc">
                  <span className="sr-only">{t("description")}</span>
                  <input
                    className="quote-cell"
                    placeholder={t("description")}
                    aria-invalid={bad.has("description")}
                    value={l.description}
                    onChange={(e) => setLine(i, "description", e.target.value)}
                  />
                </label>
                <div className="quote-line-grid">
                  {(
                    [
                      ["quantity", t("quantity")],
                      ["unit", t("unit")],
                      ["unitPrice", t("unitPrice")],
                      ["discountPct", t("discount")],
                      ["vatRate", t("vat")],
                    ] as const
                  ).map(([k, label]) => (
                    <label key={k}>
                      <span>{label}</span>
                      <input
                        className="quote-cell"
                        inputMode={k === "unit" ? "text" : "decimal"}
                        aria-invalid={k !== "unit" && bad.has(k)}
                        value={l[k]}
                        onChange={(e) => setLine(i, k, e.target.value)}
                      />
                    </label>
                  ))}
                  <div className="quote-line-total">
                    <span>{t("lineTotal")}</span>
                    <strong className="num">
                      {amounts ? m(amounts.net) : "—"}
                    </strong>
                  </div>
                </div>
                <button
                  type="button"
                  className="ios-btn ios-btn-sm ios-btn-danger"
                  aria-label={t("removeLine", { n: i + 1 })}
                  onClick={() =>
                    setD((x) => ({
                      ...x,
                      lines: x.lines.filter((_, j) => j !== i),
                    }))
                  }
                >
                  {t("removeLine", { n: i + 1 })}
                </button>
              </fieldset>
            );
          })}
          <button
            type="button"
            className="ios-btn ios-btn-secondary"
            onClick={() =>
              setD((x) => ({
                ...x,
                lines: [
                  ...x.lines,
                  {
                    description: "",
                    quantity: "1",
                    unit: "",
                    unitPrice: "",
                    discountPct: "0",
                    vatRate: String(defaultVat),
                    productKey: "",
                  },
                ],
              }))
            }
          >
            {t("addLine")}
          </button>
        </div>
      </section>

      <section className="ios-group" aria-live="polite">
        <div className="ios-list">
          <div className="ios-row">
            <span className="ios-row-main">{t("subtotal")}</span>
            <span className="num">{m(totals.subtotal)}</span>
          </div>
          {totals.discountTotal ? (
            <div className="ios-row">
              <span className="ios-row-main ios-row-sub">
                {t("discountTotal")}
              </span>
              <span className="num ios-row-sub">{m(totals.discountTotal)}</span>
            </div>
          ) : null}
          {totals.vatByRate.map((v) => (
            <div className="ios-row" key={v.rate}>
              <span className="ios-row-main">
                {t("vatLine", { rate: number(v.rate, locale) })}
              </span>
              <span className="num">{m(v.vat)}</span>
            </div>
          ))}
          <div className="ios-row quote-grand">
            <span className="ios-row-main">{t("total")}</span>
            <span className="num">{m(totals.total)}</span>
          </div>
        </div>
      </section>

      <section className="ios-group">
        <h2 className="ios-group-header">{t("terms")}</h2>
        <div className="ios-list">
          <textarea
            className="ios-input quote-textarea"
            aria-label={t("terms")}
            value={d.terms}
            onChange={(e) => set("terms", e.target.value)}
          />
        </div>
      </section>

      <div className="quote-actions">
        <button
          type="submit"
          formAction={save}
          className="ios-btn ios-btn-plain"
        >
          {t("save")}
        </button>
        {d.recipientEmail.trim() ? (
          <label className="ios-row quote-check">
            <input type="checkbox" name="email" value="1" defaultChecked />
            <span>{t("sendByEmail", { email: d.recipientEmail.trim() })}</span>
          </label>
        ) : null}
        <button type="submit" formAction={send} className="ios-btn">
          {t("send")}
        </button>
        <p className="ios-group-footer">{t("sendHelp")}</p>
        <button
          type="submit"
          formAction={remove}
          formNoValidate
          className="ios-btn ios-btn-danger"
        >
          {t("delete")}
        </button>
      </div>
    </form>
  );
}
