import { sql } from "drizzle-orm";
import {
  char,
  check,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { account, person } from "./accounts";
import {
  ownedColumns,
  ownedFk,
  ownerKey,
  tenantFk,
  tenantKey,
} from "./columns";
import { pipelineStage, qualificationCriterion } from "./config";
import {
  dealEventKindEnum,
  decisionRoleEnum,
  forecastCategoryEnum,
  qualificationStatusEnum,
  stepOwnerEnum,
} from "./enums";
import { orgFk } from "./tenancy";

/* Seller-owned: deal, deal_stakeholder, deal_qualification, deal_event, close_plan_step. */

export const deal = pgTable(
  "deal",
  {
    ...ownedColumns(),
    accountId: uuid("account_id").notNull(),
    name: text("name").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2, mode: "number" }),
    currency: char("currency", { length: 3 }).notNull().default("EUR"),
    stageId: uuid("stage_id").notNull(),
    closeDate: date("close_date"),
    compellingEvent: text("compelling_event"),
    nextStep: text("next_step"),
    nextStepDate: date("next_step_date"),
    forecastCategory: forecastCategoryEnum("forecast_category"),
    wonLostReason: text("won_lost_reason"),
    stageEnteredAt: timestamp("stage_entered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    tenantKey(t, "deal"),
    ownerKey(t, "deal"),
    orgFk("deal_organization_fk", t),
    ownedFk("deal_account_fk", t, t.accountId, account).onDelete("cascade"),
    tenantFk("deal_stage_fk", t, t.stageId, pipelineStage),
    check(
      "deal_amount_non_negative",
      sql`${t.amount} IS NULL OR ${t.amount} >= 0`,
    ),
    check("deal_currency_format", sql`${t.currency} ~ '^[A-Z]{3}$'`),
    index("deal_owner_stage_idx").on(t.organizationId, t.ownerId, t.stageId),
    index("deal_account_idx").on(t.organizationId, t.accountId),
  ],
);

export const dealStakeholder = pgTable(
  "deal_stakeholder",
  {
    ...ownedColumns(),
    dealId: uuid("deal_id").notNull(),
    personId: uuid("person_id").notNull(),
    roleInDeal: decisionRoleEnum("role_in_deal").notNull().default("unknown"),
  },
  (t) => [
    tenantKey(t, "deal_stakeholder"),
    ownerKey(t, "deal_stakeholder"),
    orgFk("deal_stakeholder_organization_fk", t),
    ownedFk("deal_stakeholder_deal_fk", t, t.dealId, deal).onDelete("cascade"),
    ownedFk("deal_stakeholder_person_fk", t, t.personId, person).onDelete(
      "cascade",
    ),
    unique("deal_stakeholder_deal_person_key").on(t.dealId, t.personId),
  ],
);

/** One row per deal × criterion (D-035), so each change is an event and evidence is per criterion. */
export const dealQualification = pgTable(
  "deal_qualification",
  {
    ...ownedColumns(),
    dealId: uuid("deal_id").notNull(),
    criterionKey: text("criterion_key").notNull(),
    status: qualificationStatusEnum("status").notNull().default("unknown"),
    evidence: text("evidence"),
    sourceInteractionId: uuid("source_interaction_id"),
  },
  (t) => [
    tenantKey(t, "deal_qualification"),
    ownerKey(t, "deal_qualification"),
    orgFk("deal_qualification_organization_fk", t),
    ownedFk("deal_qualification_deal_fk", t, t.dealId, deal).onDelete(
      "cascade",
    ),
    foreignKey({
      name: "deal_qualification_criterion_fk",
      columns: [t.organizationId, t.criterionKey],
      foreignColumns: [
        qualificationCriterion.organizationId,
        qualificationCriterion.key,
      ],
    }),
    unique("deal_qualification_deal_criterion_key").on(
      t.dealId,
      t.criterionKey,
    ),
  ],
);

/** Stage, close-date, forecast, amount and qualification changes — trends and stall times come from facts. */
export const dealEvent = pgTable(
  "deal_event",
  {
    ...ownedColumns(),
    dealId: uuid("deal_id").notNull(),
    kind: dealEventKindEnum("kind").notNull(),
    field: text("field"),
    fromValue: text("from_value"),
    toValue: text("to_value"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    tenantKey(t, "deal_event"),
    ownerKey(t, "deal_event"),
    orgFk("deal_event_organization_fk", t),
    ownedFk("deal_event_deal_fk", t, t.dealId, deal).onDelete("cascade"),
    index("deal_event_deal_idx").on(t.organizationId, t.dealId, t.occurredAt),
  ],
);

/** Close plan steps (D-036; not in the brief's §4 list but required by §6.3). */
export const closePlanStep = pgTable(
  "close_plan_step",
  {
    ...ownedColumns(),
    dealId: uuid("deal_id").notNull(),
    title: text("title").notNull(),
    stepOwner: stepOwnerEnum("step_owner").notNull().default("seller"),
    dueDate: date("due_date"),
    doneAt: timestamp("done_at", { withTimezone: true }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    tenantKey(t, "close_plan_step"),
    ownerKey(t, "close_plan_step"),
    orgFk("close_plan_step_organization_fk", t),
    ownedFk("close_plan_step_deal_fk", t, t.dealId, deal).onDelete("cascade"),
  ],
);
