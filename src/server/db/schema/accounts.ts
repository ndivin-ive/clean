import { sql } from "drizzle-orm";
import {
  char,
  check,
  date,
  index,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { ownedColumns, ownedFk, ownerKey, tenantKey } from "./columns";
import {
  accountRelationshipEnum,
  accountTierEnum,
  decisionRoleEnum,
  signalSourceEnum,
  signalTypeEnum,
  stanceEnum,
} from "./enums";
import { memberFk, orgFk } from "./tenancy";

/* Seller-owned: account, person, relationship, signal, account_plan. */

export const account = pgTable(
  "account",
  {
    ...ownedColumns(),
    name: text("name").notNull(),
    domain: text("domain"),
    country: char("country", { length: 2 }),
    industry: text("industry"),
    segment: text("segment"),
    tier: accountTierEnum("tier").notNull().default("growth"),
    relationship: accountRelationshipEnum("relationship")
      .notNull()
      .default("prospect"),
    annualValue: numeric("annual_value", {
      precision: 14,
      scale: 2,
      mode: "number",
    }),
    currency: char("currency", { length: 3 }).notNull().default("EUR"),
    renewalDate: date("renewal_date"),
    nextReviewDate: date("next_review_date"),
  },
  (t) => [
    tenantKey(t, "account"),
    ownerKey(t, "account"),
    orgFk("account_organization_fk", t),
    memberFk("account_owner_fk", t, t.ownerId),
    check("account_name_not_blank", sql`btrim(${t.name}) <> ''`),
    check("account_currency_format", sql`${t.currency} ~ '^[A-Z]{3}$'`),
    index("account_owner_idx").on(t.organizationId, t.ownerId, t.name),
  ],
);

export const person = pgTable(
  "person",
  {
    ...ownedColumns(),
    accountId: uuid("account_id").notNull(),
    name: text("name").notNull(),
    title: text("title"),
    department: text("department"),
    email: text("email"),
    phone: text("phone"),
    linkedinUrl: text("linkedin_url"),
    notes: text("notes"),
  },
  (t) => [
    tenantKey(t, "person"),
    ownerKey(t, "person"),
    orgFk("person_organization_fk", t),
    ownedFk("person_account_fk", t, t.accountId, account).onDelete("cascade"),
    index("person_account_idx").on(t.organizationId, t.accountId),
  ],
);

/** The seller's view of a person (role, stance, strength, last touch). One per person per owner. */
export const relationship = pgTable(
  "relationship",
  {
    ...ownedColumns(),
    personId: uuid("person_id").notNull(),
    decisionRole: decisionRoleEnum("decision_role")
      .notNull()
      .default("unknown"),
    stance: stanceEnum("stance").notNull().default("unknown"),
    strength: smallint("strength").notNull().default(1),
    lastInteractionAt: timestamp("last_interaction_at", { withTimezone: true }),
    nextTouchDue: date("next_touch_due"),
  },
  (t) => [
    tenantKey(t, "relationship"),
    ownerKey(t, "relationship"),
    orgFk("relationship_organization_fk", t),
    ownedFk("relationship_person_fk", t, t.personId, person).onDelete(
      "cascade",
    ),
    unique("relationship_owner_person_key").on(
      t.organizationId,
      t.ownerId,
      t.personId,
    ),
    check("relationship_strength_range", sql`${t.strength} BETWEEN 1 AND 5`),
  ],
);

export const signal = pgTable(
  "signal",
  {
    ...ownedColumns(),
    accountId: uuid("account_id").notNull(),
    personId: uuid("person_id"),
    type: signalTypeEnum("type").notNull(),
    title: text("title").notNull(),
    url: text("url"),
    detectedAt: timestamp("detected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    source: signalSourceEnum("source").notNull().default("manual"),
    relevance: smallint("relevance"),
  },
  (t) => [
    tenantKey(t, "signal"),
    ownerKey(t, "signal"),
    orgFk("signal_organization_fk", t),
    ownedFk("signal_account_fk", t, t.accountId, account).onDelete("cascade"),
    ownedFk("signal_person_fk", t, t.personId, person).onDelete("set null"),
    check(
      "signal_relevance_range",
      sql`${t.relevance} IS NULL OR ${t.relevance} BETWEEN 1 AND 5`,
    ),
    index("signal_account_idx").on(t.organizationId, t.accountId, t.detectedAt),
  ],
);

/** Living account plan: data-driven sections are computed; these are the seller's judgement fields. */
export const accountPlan = pgTable(
  "account_plan",
  {
    ...ownedColumns(),
    accountId: uuid("account_id").notNull(),
    objectives: text("objectives").notNull().default(""),
    ourGoals: text("our_goals").notNull().default(""),
    // { "<business unit>": { "<product key>": "owned" | "in_progress" | "open" | "not_relevant" } }
    whitespace: jsonb("whitespace")
      .notNull()
      .default(sql`'{}'::jsonb`),
    // [{ "text": "...", "createdAt": "..." }]
    risks: jsonb("risks")
      .notNull()
      .default(sql`'[]'::jsonb`),
    // [{ "date": "YYYY-MM-DD", "text": "..." }]
    valueDelivered: jsonb("value_delivered")
      .notNull()
      .default(sql`'[]'::jsonb`),
    nextMoves: text("next_moves").notNull().default(""),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
  },
  (t) => [
    tenantKey(t, "account_plan"),
    ownerKey(t, "account_plan"),
    orgFk("account_plan_organization_fk", t),
    ownedFk("account_plan_account_fk", t, t.accountId, account).onDelete(
      "cascade",
    ),
    unique("account_plan_account_key").on(t.organizationId, t.accountId),
  ],
);
