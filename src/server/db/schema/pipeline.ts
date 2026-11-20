import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  char,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { tenantColumns, tenantFk, tenantKey } from "./columns";
import { decisionRoleEnum, relationshipEnum } from "./enums";
import { memberFk, orgFk } from "./tenancy";

export const account = pgTable(
  "account",
  {
    ...tenantColumns(),
    name: text("name").notNull(),
    country: char("country", { length: 2 }), // ISO 3166-1 alpha-2
    industry: text("industry"),
    relationship: relationshipEnum("relationship")
      .notNull()
      .default("new_logo"),
    // Needed for "create / edit own accounts" (role matrix §4).
    ownerId: uuid("owner_id").notNull(),
  },
  (t) => [
    tenantKey(t, "account"),
    orgFk("account_organization_fk", t),
    memberFk("account_owner_fk", t, t.ownerId),
    check("account_name_not_blank", sql`btrim(${t.name}) <> ''`),
    index("account_org_name_idx").on(t.organizationId, t.name),
  ],
);

export const contact = pgTable(
  "contact",
  {
    ...tenantColumns(),
    accountId: uuid("account_id").notNull(),
    name: text("name").notNull(),
    title: text("title"),
    email: text("email"),
    decisionRole: decisionRoleEnum("decision_role")
      .notNull()
      .default("unknown"),
  },
  (t) => [
    tenantKey(t, "contact"),
    orgFk("contact_organization_fk", t),
    tenantFk("contact_account_fk", t, t.accountId, account).onDelete("cascade"),
    index("contact_account_idx").on(t.organizationId, t.accountId),
  ],
);

export const pipelineStage = pgTable(
  "pipeline_stage",
  {
    ...tenantColumns(),
    nameEn: text("name_en").notNull(),
    nameFr: text("name_fr").notNull(),
    sortOrder: integer("sort_order").notNull(),
    probability: integer("probability").notNull(),
    isWon: boolean("is_won").notNull().default(false),
    isLost: boolean("is_lost").notNull().default(false),
  },
  (t) => [
    tenantKey(t, "pipeline_stage"),
    orgFk("pipeline_stage_organization_fk", t),
    check(
      "pipeline_stage_probability_range",
      sql`${t.probability} BETWEEN 0 AND 100`,
    ),
    check(
      "pipeline_stage_not_won_and_lost",
      sql`NOT (${t.isWon} AND ${t.isLost})`,
    ),
  ],
);

export const opportunity = pgTable(
  "opportunity",
  {
    ...tenantColumns(),
    accountId: uuid("account_id").notNull(),
    ownerId: uuid("owner_id").notNull(),
    name: text("name").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2, mode: "number" }),
    currency: char("currency", { length: 3 }).notNull().default("EUR"), // ISO 4217
    stageId: uuid("stage_id").notNull(),
    closeDate: date("close_date"),
    whyNow: text("why_now"),
    nextStep: text("next_step"),
    wonLostReason: text("won_lost_reason"),
  },
  (t) => [
    tenantKey(t, "opportunity"),
    orgFk("opportunity_organization_fk", t),
    tenantFk("opportunity_account_fk", t, t.accountId, account).onDelete(
      "cascade",
    ),
    tenantFk("opportunity_stage_fk", t, t.stageId, pipelineStage),
    memberFk("opportunity_owner_fk", t, t.ownerId),
    check(
      "opportunity_amount_non_negative",
      sql`${t.amount} IS NULL OR ${t.amount} >= 0`,
    ),
    check("opportunity_currency_format", sql`${t.currency} ~ '^[A-Z]{3}$'`),
    index("opportunity_owner_idx").on(t.organizationId, t.ownerId),
    index("opportunity_stage_idx").on(t.organizationId, t.stageId),
  ],
);

/** One row per stage change; drives cycle-time analytics. */
export const opportunityStageEvent = pgTable(
  "opportunity_stage_event",
  {
    ...tenantColumns(),
    opportunityId: uuid("opportunity_id").notNull(),
    fromStageId: uuid("from_stage_id"),
    toStageId: uuid("to_stage_id").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    tenantKey(t, "opportunity_stage_event"),
    orgFk("opportunity_stage_event_organization_fk", t),
    tenantFk("ose_opportunity_fk", t, t.opportunityId, opportunity).onDelete(
      "cascade",
    ),
    tenantFk("ose_from_stage_fk", t, t.fromStageId, pipelineStage),
    tenantFk("ose_to_stage_fk", t, t.toStageId, pipelineStage),
    index("ose_opportunity_idx").on(t.organizationId, t.opportunityId, t.at),
  ],
);
