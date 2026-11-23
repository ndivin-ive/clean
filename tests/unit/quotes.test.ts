import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  canEdit,
  canRevise,
  displayStatus,
  formatQuoteNumber,
  lineAmounts,
  lineProblems,
  quoteReference,
  quoteTotals,
  sendProblems,
  type QuoteLineInput,
} from "@/domain/quotes";

const L = (over: Partial<QuoteLineInput> = {}): QuoteLineInput => ({
  description: "Vanne 3 pièces DN50",
  quantity: 10,
  unitPrice: 185.5,
  discountPct: 0,
  vatRate: 20,
  ...over,
});

describe("quote amounts", () => {
  it("computes a line: gross, discount, net, VAT, rounded to the cent", () => {
    expect(lineAmounts(L({ discountPct: 12.5 }))).toEqual({
      gross: 1855,
      discount: 231.87,
      net: 1623.13,
      vat: 324.63,
    });
  });

  it("totals add up exactly as printed and group VAT by rate", () => {
    const t = quoteTotals([
      L(),
      L({
        description: "Actionneur",
        quantity: 3,
        unitPrice: 0.335,
        vatRate: 20,
      }),
      L({
        description: "Formation",
        quantity: 1,
        unitPrice: 900,
        vatRate: 5.5,
      }),
    ]);
    expect(t.subtotal).toBe(1855 + 1.01 + 900);
    expect(t.vatTotal).toBe(371 + 0.2 + 49.5);
    expect(t.total).toBe(t.subtotal + t.vatTotal);
    expect(t.vatByRate).toEqual([
      { rate: 20, base: 1856.01, vat: 371.2 },
      { rate: 5.5, base: 900, vat: 49.5 },
    ]);
  });

  it("an empty quote totals zero", () => {
    expect(quoteTotals([])).toMatchObject({
      subtotal: 0,
      vatTotal: 0,
      total: 0,
      vatByRate: [],
    });
  });
});

describe("quote validation", () => {
  it("flags each invalid field of a line", () => {
    expect(lineProblems(L())).toEqual([]);
    expect(
      lineProblems(
        L({
          description: " ",
          quantity: 0,
          unitPrice: -1,
          discountPct: 101,
          vatRate: Number.NaN,
        }),
      ),
    ).toEqual([
      "description",
      "quantity",
      "unitPrice",
      "discountPct",
      "vatRate",
    ]);
  });

  it("a quote can be sent only when complete", () => {
    const ok = {
      lines: [L()],
      validUntil: "2026-12-31",
      today: "2026-11-23",
      seller: { legalName: "Meca-Inox (démo)", legalAddress: "Gisors" },
    };
    expect(sendProblems(ok)).toEqual([]);
    expect(sendProblems({ ...ok, lines: [] })).toEqual(["no_lines"]);
    expect(sendProblems({ ...ok, lines: [L({ quantity: 0 })] })).toEqual([
      "invalid_line",
    ]);
    expect(sendProblems({ ...ok, lines: [L({ unitPrice: 0 })] })).toEqual([
      "zero_total",
    ]);
    expect(sendProblems({ ...ok, validUntil: "2026-11-22" })).toEqual([
      "expired",
    ]);
    expect(
      sendProblems({ ...ok, seller: { legalName: "X", legalAddress: "" } }),
    ).toEqual(["seller_identity"]);
  });
});

describe("quote lifecycle", () => {
  it("a sent quote past its validity date shows as expired", () => {
    expect(displayStatus("sent", "2026-11-22", "2026-11-23")).toBe("expired");
    expect(displayStatus("sent", "2026-11-23", "2026-11-23")).toBe("sent");
    expect(displayStatus("accepted", "2026-01-01", "2026-11-23")).toBe(
      "accepted",
    );
  });

  it("only drafts are editable; sent or declined quotes can be revised", () => {
    expect([canEdit("draft"), canEdit("sent"), canEdit("accepted")]).toEqual([
      true,
      false,
      false,
    ]);
    expect(
      ["draft", "sent", "accepted", "declined", "superseded"].map((s) =>
        canRevise(s as never),
      ),
    ).toEqual([false, true, false, true, false]);
  });

  it("numbers and references", () => {
    expect(formatQuoteNumber(2026, 42)).toBe("DEV-2026-0042");
    expect(quoteReference("DEV-2026-0042", 1)).toBe("DEV-2026-0042");
    expect(quoteReference("DEV-2026-0042", 3)).toBe("DEV-2026-0042-v3");
    expect(quoteReference(null, 1)).toBeNull();
    expect(addDaysIso(new Date("2026-11-23T22:30:00Z"), 30)).toBe("2026-12-23");
  });
});
