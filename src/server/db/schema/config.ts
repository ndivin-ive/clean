import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  numeric,
  pgTable,
  text,
  unique,
} from "drizzle-orm/pg-core";
import { ownedColumns, ownerKey, tenantColumns, tenantKey } from "./columns";
import { aiProviderEnum, decisionRoleEnum } from "./enums";
import { memberFk, orgFk } from "./tenancy";

/* Organisation-level settings (admin-tunable, seeded with defaults). Tenant-scoped, not owner-scoped. */

export const pipelineStage = pgTable(
  "pipeline_stage",
  {
    ...tenantColumns(),
    nameEn: text("name_en").notNull(),
    nameFr: text("name_fr").notNull(),
    exitCriterionEn: text("exit_criterion_en").notNull().default(""),
    exitCriterionFr: text("exit_criterion_fr").notNull().default(""),
    sortOrder: integer("sort_order").notNull(),
    probability: integer("probability").notNull(),
    // "Stage's typical time" used by the stalled-deal rule (brief §5.1).
    typicalDays: integer("typical_days").notNull().default(21),
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
      "pipeline_stage_typical_days_range",
      sql`${t.typicalDays} BETWEEN 0 AND 365`,
    ),
    check(
      "pipeline_stage_not_won_and_lost",
      sql`NOT (${t.isWon} AND ${t.isLost})`,
    ),
  ],
);

/** Qualification criteria set (default: metrics, economic buyer, … competition). */
export const qualificationCriterion = pgTable(
  "qualification_criterion",
  {
    ...tenantColumns(),
    key: text("key").notNull(),
    labelEn: text("label_en").notNull(),
    labelFr: text("label_fr").notNull(),
    helpEn: text("help_en").notNull().default(""),
    helpFr: text("help_fr").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    // Unknown at a late stage triggers the "Confirm {criterion}" action.
    requiredLate: boolean("required_late").notNull().default(false),
  },
  (t) => [
    tenantKey(t, "qualification_criterion"),
    orgFk("qualification_criterion_organization_fk", t),
    unique("qualification_criterion_org_key_key").on(t.organizationId, t.key),
  ],
);

/** Contact cadence per relationship role (champion 14 days, economic buyer 30, …). */
export const roleCadence = pgTable(
  "role_cadence",
  {
    ...tenantColumns(),
    role: decisionRoleEnum("role").notNull(),
    days: integer("days").notNull(),
  },
  (t) => [
    tenantKey(t, "role_cadence"),
    orgFk("role_cadence_organization_fk", t),
    unique("role_cadence_org_role_key").on(t.organizationId, t.role),
    check("role_cadence_days_range", sql`${t.days} BETWEEN 1 AND 365`),
  ],
);

/** Rule weights and thresholds as key/value (e.g. `today.weight.nextStep` = 30). Defaults in src/domain/settings. */
export const ruleSetting = pgTable(
  "rule_setting",
  {
    ...tenantColumns(),
    key: text("key").notNull(),
    value: numeric("value", {
      precision: 12,
      scale: 4,
      mode: "number",
    }).notNull(),
  },
  (t) => [
    tenantKey(t, "rule_setting"),
    orgFk("rule_setting_organization_fk", t),
    unique("rule_setting_org_key_key").on(t.organizationId, t.key),
  ],
);

/** Per-organisation feature flags (e.g. `support_requests`). */
export const featureFlag = pgTable(
  "feature_flag",
  {
    ...tenantColumns(),
    key: text("key").notNull(),
    enabled: boolean("enabled").notNull().default(false),
  },
  (t) => [
    tenantKey(t, "feature_flag"),
    orgFk("feature_flag_organization_fk", t),
    unique("feature_flag_org_key_key").on(t.organizationId, t.key),
  ],
);

/** AI provider for the organisation. Phase 1: `off` only (D-037). The key is encrypted and never returned. */
export const aiProviderSetting = pgTable(
  "ai_provider_setting",
  {
    ...tenantColumns(),
    provider: aiProviderEnum("provider").notNull().default("off"),
    endpoint: text("endpoint"),
    encryptedKey: text("encrypted_key"),
    enabledFeatures: text("enabled_features")
      .array()
      .notNull()
      .default(sql`'{}'`),
  },
  (t) => [
    tenantKey(t, "ai_provider_setting"),
    orgFk("ai_provider_setting_organization_fk", t),
    unique("ai_provider_setting_org_key").on(t.organizationId),
  ],
);

/** "Not relevant (teach)": per-seller multiplier on a Today rule, 0.4–1.0 (D-039). Owner-scoped. */
export const userRuleAdjustment = pgTable(
  "user_rule_adjustment",
  {
    ...ownedColumns(),
    ruleKey: text("rule_key").notNull(),
    multiplier: numeric("multiplier", {
      precision: 4,
      scale: 2,
      mode: "number",
    })
      .notNull()
      .default(1),
  },
  (t) => [
    tenantKey(t, "user_rule_adjustment"),
    ownerKey(t, "user_rule_adjustment"),
    orgFk("user_rule_adjustment_organization_fk", t),
    memberFk("user_rule_adjustment_owner_fk", t, t.ownerId).onDelete("cascade"),
    unique("user_rule_adjustment_owner_rule_key").on(
      t.organizationId,
      t.ownerId,
      t.ruleKey,
    ),
    check("user_rule_adjustment_range", sql`${t.multiplier} BETWEEN 0.4 AND 1`),
  ],
);
