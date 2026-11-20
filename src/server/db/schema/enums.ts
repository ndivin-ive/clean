import { pgEnum } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", [
  "account_executive",
  "sales_manager",
  "specialist",
  "support_team_lead",
  "admin",
]);

export const localeEnum = pgEnum("locale", ["en", "fr"]);

export const aiSettingEnum = pgEnum("ai_setting", [
  "off",
  "clean_default",
  "byo",
]);

export const relationshipEnum = pgEnum("account_relationship", [
  "new_logo",
  "expand",
  "retain",
]);

export const decisionRoleEnum = pgEnum("decision_role", [
  "decision_maker",
  "sponsor",
  "influencer",
  "technical_evaluator",
  "procurement",
  "unknown",
]);

export const templateStatusEnum = pgEnum("template_status", [
  "draft",
  "published",
  "archived",
]);

/** Q3: `draft` precedes `new`. Transitions live in src/domain/engagement. */
export const engagementStatusEnum = pgEnum("engagement_status", [
  "draft",
  "new",
  "needs_information",
  "accepted",
  "scheduled",
  "delivered",
  "outcome_recorded",
  "declined",
  "withdrawn",
]);

export const effortActivityEnum = pgEnum("effort_activity", [
  "prep",
  "delivery",
  "follow_up",
]);

export const outcomeResultEnum = pgEnum("outcome_result", [
  "decision",
  "next_step",
  "qualified_out",
  "no_progress",
]);
