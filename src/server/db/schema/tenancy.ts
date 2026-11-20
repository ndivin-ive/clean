import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { authUser } from "./auth";
import { tenantColumns, tenantKey } from "./columns";
import { aiSettingEnum, localeEnum, roleEnum } from "./enums";

export const organization = pgTable(
  "organization",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Always equal to id, so every table (this one included) can share the
    // same RLS policy and audit trigger on organization_id.
    organizationId: uuid("organization_id")
      .notNull()
      .generatedAlwaysAs(sql`id`),
    name: text("name").notNull(),
    defaultLanguage: localeEnum("default_language").notNull().default("en"),
    plan: text("plan").notNull().default("free"),
    dataRegion: text("data_region").notNull().default("eu"),
    aiSetting: aiSettingEnum("ai_setting").notNull().default("off"),
    setupCompletedAt: timestamp("setup_completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").default(sql`app_current_user()`),
  },
  (t) => [check("organization_name_not_blank", sql`btrim(${t.name}) <> ''`)],
);

export const membership = pgTable(
  "membership",
  {
    ...tenantColumns(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    roles: roleEnum("roles")
      .array()
      .notNull()
      .default(sql`'{}'`),
    skills: text("skills")
      .array()
      .notNull()
      .default(sql`'{}'`),
    languages: text("languages")
      .array()
      .notNull()
      .default(sql`'{}'`),
    regions: text("regions")
      .array()
      .notNull()
      .default(sql`'{}'`),
    weeklyBookableHours: numeric("weekly_bookable_hours", {
      precision: 4,
      scale: 1,
      mode: "number",
    })
      .notNull()
      .default(0),
    // Q2: sales teams. A manager sees deals of direct and indirect reports.
    managerUserId: uuid("manager_user_id"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [
    tenantKey(t, "membership"),
    unique("membership_org_user_key").on(t.organizationId, t.userId),
    foreignKey({
      name: "membership_organization_fk",
      columns: [t.organizationId],
      foreignColumns: [organization.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "membership_manager_fk",
      columns: [t.organizationId, t.managerUserId],
      foreignColumns: [t.organizationId, t.userId],
    }),
    check(
      "membership_hours_range",
      sql`${t.weeklyBookableHours} >= 0 AND ${t.weeklyBookableHours} <= 80`,
    ),
    check("membership_not_own_manager", sql`${t.managerUserId} <> ${t.userId}`),
    index("membership_user_idx").on(t.userId),
  ],
);

/**
 * FK from a tenant table's user column to membership (organization_id, user_id):
 * the referenced user must be a member of the SAME organization.
 */
export const memberFk = (
  name: string,
  child: { organizationId: AnyPgColumn },
  column: AnyPgColumn,
) =>
  foreignKey({
    name,
    columns: [child.organizationId, column],
    foreignColumns: [membership.organizationId, membership.userId],
  });

/** Every tenant table's organization_id must reference an organization. */
export const orgFk = (name: string, child: { organizationId: AnyPgColumn }) =>
  foreignKey({
    name,
    columns: [child.organizationId],
    foreignColumns: [organization.id],
  }).onDelete("cascade");

export const invitation = pgTable(
  "invitation",
  {
    ...tenantColumns(),
    email: text("email").notNull(),
    roles: roleEnum("roles")
      .array()
      .notNull()
      .default(sql`'{}'`),
    // SHA-256 of the token sent by email. The token itself is never stored.
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedBy: uuid("accepted_by").references(() => authUser.id),
  },
  (t) => [
    tenantKey(t, "invitation"),
    orgFk("invitation_organization_fk", t),
    index("invitation_org_email_idx").on(t.organizationId, t.email),
  ],
);

export const notification = pgTable(
  "notification",
  {
    ...tenantColumns(),
    userId: uuid("user_id").notNull(),
    kind: text("kind").notNull(),
    payload: jsonb("payload")
      .notNull()
      .default(sql`'{}'::jsonb`),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => [
    tenantKey(t, "notification"),
    orgFk("notification_organization_fk", t),
    memberFk("notification_user_fk", t, t.userId).onDelete("cascade"),
    index("notification_user_unread_idx").on(
      t.organizationId,
      t.userId,
      t.readAt,
    ),
  ],
);
