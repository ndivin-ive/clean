/**
 * Quotes (D-060): seller workflow, immutability once sent, privacy, and the
 * customer link (view, accept, decline, expiry, revision, link renewal).
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as s from "@/server/db/schema";
import { withTenant } from "@/server/db/tenant";
import {
  createQuote,
  getQuote,
  getQuoteByToken,
  markDealWonFromQuote,
  QuoteError,
  renewQuoteLink,
  respondToQuote,
  reviseQuote,
  saveQuoteDraft,
  sendQuote,
  updateQuoteSettings,
  type QuoteDraftInput,
} from "@/server/services/quotes";
import { appDb, closePools } from "./support/db";
import {
  as,
  createTenantFixture,
  type TenantFixture,
} from "./support/fixtures";
import { PG, pgErrorCode } from "./support/pg-error";

const NOW = new Date("2026-11-20T09:00:00Z");
const SELLER = { name: "Julie Seller", email: "julie@quotes.test" };
let F: TenantFixture;
const me = () => as(F);

const draft = (over: Partial<QuoteDraftInput> = {}): QuoteDraftInput => ({
  title: "Vannes 3 pièces pour l’unité acide",
  language: "fr",
  validUntil: "2026-12-20",
  introduction: "Suite à notre visite du 12 novembre.",
  terms: "Paiement à 30 jours.",
  recipientName: "Dana Buyer",
  recipientEmail: "dana@customer.test",
  lines: [
    {
      description: "Vanne 3 pièces DN50",
      quantity: 10,
      unitPrice: 185.5,
      discountPct: 10,
      vatRate: 20,
    },
    {
      description: "Actionneur pneumatique",
      quantity: 2,
      unitPrice: 640,
      discountPct: 0,
      vatRate: 20,
    },
  ],
  ...over,
});

beforeAll(async () => {
  F = await createTenantFixture("quotes");
});
afterAll(closePools);

describe("seller workflow", () => {
  let id: string;

  it("a new quote is prefilled from the deal and the organisation defaults", async () => {
    id = await createQuote(appDb, me(), F.ids.deal, NOW);
    const q = await getQuote(appDb, me(), id);
    expect(q).toMatchObject({
      status: "draft",
      title: "Platform deal",
      validUntil: "2026-12-20",
      number: null,
      subtotal: 50000,
      vatTotal: 10000,
      total: 60000,
      recipientName: "Dana Buyer",
    });
    expect(q!.lines).toHaveLength(1);
  });

  it("saving a draft replaces the lines and recomputes the totals", async () => {
    await saveQuoteDraft(appDb, me(), id, draft());
    const q = await getQuote(appDb, me(), id);
    expect(q!.lines.map((l) => l.description)).toEqual([
      "Vanne 3 pièces DN50",
      "Actionneur pneumatique",
    ]);
    expect([q!.subtotal, q!.vatTotal, q!.total]).toEqual([
      2949.5, 589.9, 3539.4,
    ]);
  });

  it("a quote cannot be sent before the seller's legal identity is set", async () => {
    const err = await sendQuote(appDb, me(), id, SELLER, NOW).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(QuoteError);
    expect((err as QuoteError).problems).toEqual(["seller_identity"]);
  });

  let token: string;
  it("sending assigns the next number, freezes the seller identity and creates a link", async () => {
    await updateQuoteSettings(appDb, me(), ["admin"], {
      legalName: "Quotes Industrie SAS",
      legalAddress: "1 rue de l’Usine, 27140 Gisors",
      legalId: "SIREN 000 000 001",
      vatNumber: "FR00000000001",
      quoteTerms: "Paiement à 30 jours.",
      quoteValidityDays: 30,
      defaultVatRate: 20,
    });
    const r = await sendQuote(appDb, me(), id, SELLER, NOW);
    token = r.token;
    expect(r.reference).toBe("DEV-2026-0004"); // fixture counter was at 3
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const q = await getQuote(appDb, me(), id);
    expect(q).toMatchObject({
      status: "sent",
      number: "DEV-2026-0004",
      sellerSnapshot: {
        legalName: "Quotes Industrie SAS",
        sellerEmail: SELLER.email,
      },
    });
    expect(q!.tokenHash).not.toContain(token); // only the hash is stored
  });

  it("a sent quote can no longer change, even by direct SQL as its owner", async () => {
    await expect(
      saveQuoteDraft(appDb, me(), id, draft()),
    ).rejects.toMatchObject({ code: "not_editable" });
    expect(
      await pgErrorCode(
        withTenant(appDb, me(), (tx) =>
          tx
            .update(s.quoteLine)
            .set({ unitPrice: 1 })
            .where(eq(s.quoteLine.quoteId, id)),
        ),
      ),
    ).toBe(PG.checkViolation);
    expect(
      await pgErrorCode(
        withTenant(appDb, me(), (tx) =>
          tx.update(s.quote).set({ total: 1 }).where(eq(s.quote.id, id)),
        ),
      ),
    ).toBe(PG.checkViolation);
  });

  it("the quote is private to its seller", async () => {
    expect(await getQuote(appDb, as(F, "peerId"), id)).toBeNull();
    expect(await getQuote(appDb, as(F, "adminId"), id)).toBeNull();
  });

  it("the customer link shows the document only, and records the first view", async () => {
    const pub = await getQuoteByToken(appDb, token);
    expect(pub).toMatchObject({
      status: "sent",
      number: "DEV-2026-0004",
      customer: "quotes Customer",
      total: 3539.4,
      seller: { legalName: "Quotes Industrie SAS" },
    });
    expect(pub!.lines).toHaveLength(2);
    expect(JSON.stringify(pub)).not.toMatch(
      /owner|deal_id|dealId|organization|token/i,
    );
    expect((await getQuote(appDb, me(), id))!.viewedAt).not.toBeNull();
    expect(await getQuoteByToken(appDb, "x".repeat(43))).toBeNull();
    expect(await getQuoteByToken(appDb, "not a token")).toBeNull();
  });

  it("the customer must give a name; accepting closes the quote and notifies the seller", async () => {
    expect(
      await respondToQuote(appDb, token, {
        decision: "accepted",
        name: "  ",
        title: null,
        reason: null,
      }),
    ).toBe("name_required");
    expect(
      await respondToQuote(appDb, token, {
        decision: "accepted",
        name: "Dana Buyer",
        title: "CFO",
        reason: null,
      }),
    ).toBe("ok");
    expect(
      await respondToQuote(appDb, token, {
        decision: "declined",
        name: "Dana Buyer",
        title: null,
        reason: "x",
      }),
    ).toBe("closed");
    const q = await getQuote(appDb, me(), id);
    expect(q).toMatchObject({
      status: "accepted",
      responderName: "Dana Buyer",
      responderTitle: "CFO",
    });
    const n = await withTenant(appDb, me(), (tx) =>
      tx
        .select()
        .from(s.notification)
        .where(eq(s.notification.kind, "quote.accepted")),
    );
    expect(n).toHaveLength(1);
    expect(n[0]!.userId).toBe(F.sellerId);
    expect(await getQuoteByToken(appDb, token)).toMatchObject({
      status: "accepted",
      responderName: "Dana Buyer",
    });
  });

  it("the deal moves to won only when the seller decides", async () => {
    const wonStage = await withTenant(
      appDb,
      me(),
      async (tx) =>
        (
          await tx
            .insert(s.pipelineStage)
            .values({
              nameEn: "Won",
              nameFr: "Gagnée",
              sortOrder: 9,
              probability: 100,
              typicalDays: 0,
              isWon: true,
            })
            .returning()
        )[0]!.id,
    );
    const stageOf = async () =>
      (
        await withTenant(appDb, me(), (tx) =>
          tx.select().from(s.deal).where(eq(s.deal.id, F.ids.deal)),
        )
      )[0]!;
    expect((await stageOf()).stageId).not.toBe(wonStage); // the customer's acceptance alone changes nothing
    await markDealWonFromQuote(appDb, me(), id);
    const d = await stageOf();
    expect([d.stageId, d.amount]).toEqual([wonStage, 2949.5]);
  });
});

describe("decline, revision and link renewal", () => {
  it("a declined quote can be revised; sending the new version supersedes the old one", async () => {
    const id = await createQuote(appDb, me(), F.ids.deal, NOW);
    await saveQuoteDraft(appDb, me(), id, draft());
    const { token, reference } = await sendQuote(appDb, me(), id, SELLER, NOW);
    expect(reference).toBe("DEV-2026-0005");
    expect(
      await respondToQuote(appDb, token, {
        decision: "declined",
        name: "Dana Buyer",
        title: null,
        reason: "Délai trop long",
      }),
    ).toBe("ok");

    const v2 = await reviseQuote(appDb, me(), id, NOW);
    await expect(reviseQuote(appDb, me(), id, NOW)).rejects.toMatchObject({
      code: "revision_exists",
    });
    expect(await getQuote(appDb, me(), v2)).toMatchObject({
      status: "draft",
      number: "DEV-2026-0005",
      revision: 2,
    });
    const second = await sendQuote(appDb, me(), v2, SELLER, NOW);
    expect(second.reference).toBe("DEV-2026-0005-v2");
    expect(await getQuote(appDb, me(), id)).toMatchObject({
      status: "superseded",
      supersededBy: v2,
      declineReason: "Délai trop long",
    });
    expect(await getQuoteByToken(appDb, token)).toEqual({
      status: "superseded",
      language: "fr",
    });
    expect(
      await respondToQuote(appDb, token, {
        decision: "accepted",
        name: "Dana",
        title: null,
        reason: null,
      }),
    ).toBe("closed");
  });

  it("renewing the link invalidates the previous one", async () => {
    const id = await createQuote(appDb, me(), F.ids.deal, NOW);
    const { token } = await sendQuote(appDb, me(), id, SELLER, NOW);
    const fresh = await renewQuoteLink(appDb, me(), id);
    expect(await getQuoteByToken(appDb, token)).toBeNull();
    expect(await getQuoteByToken(appDb, fresh)).toMatchObject({
      status: "sent",
    });
  });

  it("an expired quote can no longer be accepted", async () => {
    const past = new Date("2020-01-01T09:00:00Z");
    const id = await createQuote(appDb, me(), F.ids.deal, past);
    const { token } = await sendQuote(appDb, me(), id, SELLER, past);
    expect(
      await respondToQuote(appDb, token, {
        decision: "accepted",
        name: "Dana",
        title: null,
        reason: null,
      }),
    ).toBe("expired");
  });

  it("numbers come from one per-organisation counter", async () => {
    const counter = await withTenant(appDb, me(), (tx) =>
      tx.select().from(s.quoteSequence),
    );
    expect(counter.find((c) => c.year === 2026)!.lastNumber).toBe(6);
  });
});
