import { sql } from "drizzle-orm";
import {
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
import { tenantColumns, tenantFk, tenantKey } from "./columns";
import {
  effortActivityEnum,
  engagementStatusEnum,
  outcomeResultEnum,
} from "./enums";
import { engagementType, requestTemplate, supportFunction } from "./functions";
import { opportunity } from "./pipeline";
import { memberFk, orgFk } from "./tenancy";

export const engagementRequest = pgTable(
  "engagement_request",
  {
    ...tenantColumns(),
    opportunityId: uuid("opportunity_id"),
    requesterId: uuid("requester_id").notNull(),
    supportFunctionId: uuid("support_function_id").notNull(),
    engagementTypeId: uuid("engagement_type_id"),
    templateId: uuid("template_id").notNull(),
    templateVersion: integer("template_version").notNull(),
    answers: jsonb("answers")
      .notNull()
      .default(sql`'{}'::jsonb`),
    status: engagementStatusEnum("status").notNull().default("draft"),
    readinessScore: smallint("readiness_score"),
    readinessBreakdown: jsonb("readiness_breakdown"),
    effortPoints: integer("effort_points"),
    effortBand: text("effort_band"),
    flags: jsonb("flags")
      .notNull()
      .default(sql`'[]'::jsonb`),
    targetDate: date("target_date"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
  },
  (t) => [
    tenantKey(t, "engagement_request"),
    orgFk("engagement_request_organization_fk", t),
    tenantFk("er_opportunity_fk", t, t.opportunityId, opportunity).onDelete(
      "set null",
    ),
    tenantFk("er_function_fk", t, t.supportFunctionId, supportFunction),
    tenantFk("er_engagement_type_fk", t, t.engagementTypeId, engagementType),
    tenantFk("er_template_fk", t, t.templateId, requestTemplate),
    memberFk("er_requester_fk", t, t.requesterId),
    check(
      "er_readiness_range",
      sql`${t.readinessScore} IS NULL OR ${t.readinessScore} BETWEEN 0 AND 100`,
    ),
    index("er_function_status_idx").on(
      t.organizationId,
      t.supportFunctionId,
      t.status,
    ),
    index("er_requester_idx").on(t.organizationId, t.requesterId),
    index("er_opportunity_idx").on(t.organizationId, t.opportunityId),
  ],
);

export const engagementStatusEvent = pgTable(
  "engagement_status_event",
  {
    ...tenantColumns(),
    requestId: uuid("request_id").notNull(),
    fromStatus: engagementStatusEnum("from_status"),
    toStatus: engagementStatusEnum("to_status").notNull(),
    byUserId: uuid("by_user_id").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    note: text("note"),
  },
  (t) => [
    tenantKey(t, "engagement_status_event"),
    orgFk("engagement_status_event_organization_fk", t),
    tenantFk("ese_request_fk", t, t.requestId, engagementRequest).onDelete(
      "cascade",
    ),
    memberFk("ese_by_user_fk", t, t.byUserId),
    index("ese_request_idx").on(t.organizationId, t.requestId, t.at),
  ],
);

export const engagementAssignment = pgTable(
  "engagement_assignment",
  {
    ...tenantColumns(),
    requestId: uuid("request_id").notNull(),
    userId: uuid("user_id").notNull(),
  },
  (t) => [
    tenantKey(t, "engagement_assignment"),
    orgFk("engagement_assignment_organization_fk", t),
    tenantFk("ea_request_fk", t, t.requestId, engagementRequest).onDelete(
      "cascade",
    ),
    memberFk("ea_user_fk", t, t.userId),
    unique("ea_request_user_key").on(t.requestId, t.userId),
    index("ea_user_idx").on(t.organizationId, t.userId),
  ],
);

export const booking = pgTable(
  "booking",
  {
    ...tenantColumns(),
    requestId: uuid("request_id").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    locationOrLink: text("location_or_link"),
    externalCalendarIds: jsonb("external_calendar_ids")
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (t) => [
    tenantKey(t, "booking"),
    orgFk("booking_organization_fk", t),
    tenantFk("booking_request_fk", t, t.requestId, engagementRequest).onDelete(
      "cascade",
    ),
    check("booking_time_order", sql`${t.endsAt} > ${t.startsAt}`),
  ],
);

export const effortEntry = pgTable(
  "effort_entry",
  {
    ...tenantColumns(),
    requestId: uuid("request_id").notNull(),
    userId: uuid("user_id").notNull(),
    hours: numeric("hours", {
      precision: 5,
      scale: 2,
      mode: "number",
    }).notNull(),
    activity: effortActivityEnum("activity").notNull(),
    date: date("date").notNull(),
  },
  (t) => [
    tenantKey(t, "effort_entry"),
    orgFk("effort_entry_organization_fk", t),
    tenantFk("effort_request_fk", t, t.requestId, engagementRequest).onDelete(
      "cascade",
    ),
    memberFk("effort_user_fk", t, t.userId),
    check("effort_hours_range", sql`${t.hours} > 0 AND ${t.hours} <= 24`),
    index("effort_request_idx").on(t.organizationId, t.requestId),
  ],
);

export const engagementOutcome = pgTable(
  "engagement_outcome",
  {
    ...tenantColumns(),
    requestId: uuid("request_id").notNull(),
    result: outcomeResultEnum("result").notNull(),
    notes: text("notes"),
    dealImpact: smallint("deal_impact").notNull(),
  },
  (t) => [
    tenantKey(t, "engagement_outcome"),
    orgFk("engagement_outcome_organization_fk", t),
    tenantFk("outcome_request_fk", t, t.requestId, engagementRequest).onDelete(
      "cascade",
    ),
    unique("outcome_request_key").on(t.requestId),
    check("outcome_deal_impact_range", sql`${t.dealImpact} BETWEEN 1 AND 5`),
  ],
);
