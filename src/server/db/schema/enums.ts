import { pgEnum } from "drizzle-orm/pg-core";

/** Organisation roles (decision D-032). `specialist` only matters while the support module flag is on. */
export const roleEnum = pgEnum("role", [
  "seller",
  "manager",
  "admin",
  "specialist",
]);
export const localeEnum = pgEnum("locale", ["en", "fr"]);
export const themeEnum = pgEnum("theme", ["light", "dark", "system"]);
export const aiProviderEnum = pgEnum("ai_provider", [
  "off",
  "clean_default",
  "anthropic",
  "openai",
  "mistral",
  "azure_openai",
]);

export const accountTierEnum = pgEnum("account_tier", [
  "key",
  "growth",
  "maintain",
]);
export const accountRelationshipEnum = pgEnum("account_relationship", [
  "prospect",
  "customer",
]);
export const decisionRoleEnum = pgEnum("decision_role", [
  "economic_buyer",
  "decision_maker",
  "champion",
  "influencer",
  "technical_evaluator",
  "user",
  "procurement",
  "blocker",
  "unknown",
]);
export const stanceEnum = pgEnum("stance", [
  "supporter",
  "neutral",
  "sceptic",
  "unknown",
]);

export const forecastCategoryEnum = pgEnum("forecast_category", [
  "commit",
  "best_case",
  "pipeline",
  "omitted",
]);
export const qualificationStatusEnum = pgEnum("qualification_status", [
  "unknown",
  "partial",
  "confirmed",
]);
export const dealEventKindEnum = pgEnum("deal_event_kind", [
  "stage",
  "close_date",
  "forecast",
  "amount",
  "qualification",
]);
export const stepOwnerEnum = pgEnum("step_owner", ["buyer", "seller"]);

export const interactionTypeEnum = pgEnum("interaction_type", [
  "meeting",
  "call",
  "email",
  "note",
  "event",
]);
export const interactionSourceEnum = pgEnum("interaction_source", [
  "manual",
  "paste",
  "voice",
  "calendar",
  "email",
  "transcript",
]);
export const proposalStatusEnum = pgEnum("proposal_status", [
  "pending",
  "approved",
  "edited",
  "rejected",
]);
export const briefGeneratorEnum = pgEnum("brief_generator", ["rules", "ai"]);

export const signalTypeEnum = pgEnum("signal_type", [
  "job_change",
  "news",
  "funding",
  "hiring",
  "tender",
  "product_launch",
  "usage_drop",
  "renewal_window",
  "custom",
]);
export const signalSourceEnum = pgEnum("signal_source", [
  "manual",
  "rss",
  "webhook",
  "import",
]);

export const actionStatusEnum = pgEnum("action_status", [
  "open",
  "done",
  "snoozed",
  "dismissed",
]);
export const actionOriginEnum = pgEnum("action_origin", [
  "rule",
  "ai",
  "manual",
]);

/** Parked module (feature flag `support_requests`). */
export const supportStatusEnum = pgEnum("support_status", [
  "open",
  "accepted",
  "done",
  "withdrawn",
]);

/** Quote lifecycle (D-060): draft → sent → accepted | declined; a revision supersedes the previous version. */
export const quoteStatusEnum = pgEnum("quote_status", [
  "draft",
  "sent",
  "accepted",
  "declined",
  "superseded",
]);
