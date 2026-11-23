import { sql } from "drizzle-orm";
import {
  char,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { account } from "./accounts";
import {
  ownedColumns,
  ownedFk,
  ownerKey,
  tenantColumns,
  tenantKey,
} from "./columns";
import { deal } from "./deals";
import { localeEnum, quoteStatusEnum } from "./enums";
import { orgFk } from "./tenancy";

/*
 * Quotes (D-060). Seller-owned like the deal they belong to. A quote is
 * editable while it is a draft; sending it freezes it (number, totals and the
 * seller identity are copied in) and creates a customer link. The customer
 * accepts or declines through that link (quote_by_token / respond_to_quote,
 * migration 0007); only the hash of the link token is stored.
 */
export const quote = pgTable(
  "quote",
  {
    ...ownedColumns(),
    dealId: uuid("deal_id").notNull(),
    accountId: uuid("account_id").notNull(),
    /** Assigned when the quote is first sent (DEV-2026-0001); revisions keep it. */
    number: text("number"),
    revision: smallint("revision").notNull().default(1),
    status: quoteStatusEnum("status").notNull().default("draft"),
    title: text("title").notNull(),
    language: localeEnum("language").notNull().default("fr"),
    currency: char("currency", { length: 3 }).notNull().default("EUR"),
    validUntil: date("valid_until").notNull(),
    introduction: text("introduction"),
    terms: text("terms"),
    recipientName: text("recipient_name"),
    recipientEmail: text("recipient_email"),
    subtotal: numeric("subtotal", { precision: 14, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    vatTotal: numeric("vat_total", { precision: 14, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    total: numeric("total", { precision: 14, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    /** Seller identity (legal name, address, ids, contact) frozen at sending. */
    sellerSnapshot: jsonb("seller_snapshot"),
    tokenHash: text("token_hash").unique(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    responderName: text("responder_name"),
    responderTitle: text("responder_title"),
    declineReason: text("decline_reason"),
    supersededBy: uuid("superseded_by"),
  },
  (t) => [
    tenantKey(t, "quote"),
    ownerKey(t, "quote"),
    orgFk("quote_organization_fk", t),
    ownedFk("quote_deal_fk", t, t.dealId, deal).onDelete("cascade"),
    ownedFk("quote_account_fk", t, t.accountId, account).onDelete("cascade"),
    unique("quote_number_revision_key").on(
      t.organizationId,
      t.number,
      t.revision,
    ),
    check("quote_title_not_blank", sql`btrim(${t.title}) <> ''`),
    check("quote_currency_format", sql`${t.currency} ~ '^[A-Z]{3}$'`),
    check("quote_revision_positive", sql`${t.revision} >= 1`),
    check(
      "quote_totals_non_negative",
      sql`${t.subtotal} >= 0 AND ${t.vatTotal} >= 0 AND ${t.total} >= 0`,
    ),
    check(
      "quote_sent_has_number",
      sql`${t.status} = 'draft' OR (${t.number} IS NOT NULL AND ${t.sentAt} IS NOT NULL)`,
    ),
    index("quote_deal_idx").on(t.organizationId, t.dealId),
  ],
);

export const quoteLine = pgTable(
  "quote_line",
  {
    ...ownedColumns(),
    quoteId: uuid("quote_id").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    productKey: text("product_key"),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 2, mode: "number" })
      .notNull()
      .default(1),
    unit: text("unit"),
    unitPrice: numeric("unit_price", {
      precision: 14,
      scale: 2,
      mode: "number",
    }).notNull(),
    discountPct: numeric("discount_pct", {
      precision: 5,
      scale: 2,
      mode: "number",
    })
      .notNull()
      .default(0),
    vatRate: numeric("vat_rate", { precision: 5, scale: 2, mode: "number" })
      .notNull()
      .default(20),
  },
  (t) => [
    tenantKey(t, "quote_line"),
    ownerKey(t, "quote_line"),
    orgFk("quote_line_organization_fk", t),
    ownedFk("quote_line_quote_fk", t, t.quoteId, quote).onDelete("cascade"),
    check(
      "quote_line_description_not_blank",
      sql`btrim(${t.description}) <> ''`,
    ),
    check("quote_line_quantity_positive", sql`${t.quantity} > 0`),
    check("quote_line_price_non_negative", sql`${t.unitPrice} >= 0`),
    check("quote_line_discount_range", sql`${t.discountPct} BETWEEN 0 AND 100`),
    check("quote_line_vat_range", sql`${t.vatRate} BETWEEN 0 AND 100`),
    index("quote_line_quote_idx").on(t.organizationId, t.quoteId),
  ],
);

/** Per-organisation, per-year quote counter (tenant-only, D-060). */
export const quoteSequence = pgTable(
  "quote_sequence",
  {
    ...tenantColumns(),
    year: smallint("year").notNull(),
    lastNumber: integer("last_number").notNull().default(0),
  },
  (t) => [
    tenantKey(t, "quote_sequence"),
    orgFk("quote_sequence_organization_fk", t),
    unique("quote_sequence_org_year_key").on(t.organizationId, t.year),
  ],
);
