import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { tenantColumns, tenantFk, tenantKey } from "./columns";
import { templateStatusEnum } from "./enums";
import { memberFk, orgFk } from "./tenancy";

/** A specialist team that can be booked against opportunities. */
export const supportFunction = pgTable(
  "support_function",
  {
    ...tenantColumns(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    // Who may request, approval required, target response hours,
    // max open requests per specialist, specialists may self-assign.
    serviceRules: jsonb("service_rules")
      .notNull()
      .default(sql`'{}'::jsonb`),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [
    tenantKey(t, "support_function"),
    orgFk("support_function_organization_fk", t),
    unique("support_function_org_name_key").on(t.organizationId, t.name),
  ],
);

export const supportFunctionMember = pgTable(
  "support_function_member",
  {
    ...tenantColumns(),
    supportFunctionId: uuid("support_function_id").notNull(),
    userId: uuid("user_id").notNull(),
    isLead: boolean("is_lead").notNull().default(false),
  },
  (t) => [
    tenantKey(t, "support_function_member"),
    orgFk("support_function_member_organization_fk", t),
    tenantFk(
      "sfm_function_fk",
      t,
      t.supportFunctionId,
      supportFunction,
    ).onDelete("cascade"),
    memberFk("sfm_user_fk", t, t.userId).onDelete("cascade"),
    unique("sfm_function_user_key").on(t.supportFunctionId, t.userId),
  ],
);

/** Q4: engagement types offered by a function (demo, workshop, …). */
export const engagementType = pgTable(
  "engagement_type",
  {
    ...tenantColumns(),
    supportFunctionId: uuid("support_function_id").notNull(),
    key: text("key").notNull(),
    nameEn: text("name_en").notNull(),
    nameFr: text("name_fr").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [
    tenantKey(t, "engagement_type"),
    orgFk("engagement_type_organization_fk", t),
    tenantFk(
      "engagement_type_function_fk",
      t,
      t.supportFunctionId,
      supportFunction,
    ).onDelete("cascade"),
    unique("engagement_type_function_key_key").on(t.supportFunctionId, t.key),
  ],
);

/** Versioned request form definition. Published versions are immutable. */
export const requestTemplate = pgTable(
  "request_template",
  {
    ...tenantColumns(),
    supportFunctionId: uuid("support_function_id").notNull(),
    version: integer("version").notNull(),
    status: templateStatusEnum("status").notNull().default("draft"),
    schema: jsonb("schema").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => [
    tenantKey(t, "request_template"),
    orgFk("request_template_organization_fk", t),
    tenantFk(
      "request_template_function_fk",
      t,
      t.supportFunctionId,
      supportFunction,
    ).onDelete("cascade"),
    unique("request_template_function_version_key").on(
      t.supportFunctionId,
      t.version,
    ),
  ],
);

/** Readiness weights, effort bands, lead times and flag rules (see SCORING.md). */
export const scoringRuleSet = pgTable(
  "scoring_rule_set",
  {
    ...tenantColumns(),
    supportFunctionId: uuid("support_function_id").notNull(),
    weights: jsonb("weights").notNull(),
    effortBands: jsonb("effort_bands").notNull(),
    leadTimes: jsonb("lead_times").notNull(),
    flagRules: jsonb("flag_rules").notNull(),
  },
  (t) => [
    tenantKey(t, "scoring_rule_set"),
    orgFk("scoring_rule_set_organization_fk", t),
    tenantFk(
      "scoring_rule_set_function_fk",
      t,
      t.supportFunctionId,
      supportFunction,
    ).onDelete("cascade"),
    unique("scoring_rule_set_function_key").on(t.supportFunctionId),
  ],
);
