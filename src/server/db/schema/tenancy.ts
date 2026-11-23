import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { authUser } from "./auth";
import { tenantColumns, tenantKey } from "./columns";
import { localeEnum, roleEnum } from "./enums";

export const organization = pgTable(
  "organization",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Always equal to id, so every table shares one RLS policy and audit trigger.
    organizationId: uuid("organization_id")
      .notNull()
      .generatedAlwaysAs(sql`id`),
    name: text("name").notNull(),
    defaultLanguage: localeEnum("default_language").notNull().default("en"),
    plan: text("plan").notNull().default("free"),
    dataRegion: text("data_region").notNull().default("eu"),
    // Rule 2: sellers' records are private unless the admin turns this on (D-033).
    teamVisibility: boolean("team_visibility").notNull().default(false),
    // Starting configuration (stages, criteria, cadences, catalogue) — src/domain/profiles.ts (D-056).
    salesProfile: text("sales_profile").notNull().default("generic"),
    // Branding (D-058): accent and dark brand colours, #rrggbb; null = CLEAN default.
    brandColor: text("brand_color"),
    brandInk: text("brand_ink"),
    // Seller identity printed on quotes (D-060). Edited by an admin; copied into
    // each quote when it is sent, so a sent quote never changes afterwards.
    legalName: text("legal_name"),
    legalAddress: text("legal_address"),
    legalId: text("legal_id"),
    vatNumber: text("vat_number"),
    quoteTerms: text("quote_terms"),
    quoteValidityDays: smallint("quote_validity_days").notNull().default(30),
    defaultVatRate: numeric("default_vat_rate", {
      precision: 5,
      scale: 2,
      mode: "number",
    })
      .notNull()
      .default(20),
    // Forecast periods are calendar quarters offset by this month (D-038).
    fiscalYearStartMonth: smallint("fiscal_year_start_month")
      .notNull()
      .default(1),
    setupCompletedAt: timestamp("setup_completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").default(sql`app_current_user()`),
  },
  (t) => [
    check("organization_name_not_blank", sql`btrim(${t.name}) <> ''`),
    check(
      "organization_brand_color_hex",
      sql`${t.brandColor} IS NULL OR ${t.brandColor} ~ '^#[0-9A-Fa-f]{6}$'`,
    ),
    check(
      "organization_brand_ink_hex",
      sql`${t.brandInk} IS NULL OR ${t.brandInk} ~ '^#[0-9A-Fa-f]{6}$'`,
    ),
    check(
      "organization_quote_validity_range",
      sql`${t.quoteValidityDays} BETWEEN 1 AND 365`,
    ),
    check(
      "organization_default_vat_range",
      sql`${t.defaultVatRate} BETWEEN 0 AND 100`,
    ),
    check(
      "organization_fiscal_month_range",
      sql`${t.fiscalYearStartMonth} BETWEEN 1 AND 12`,
    ),
  ],
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
      .default(sql`'{seller}'`),
    // Teams: a manager and their direct/indirect reports (used by team visibility).
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
    check("membership_not_own_manager", sql`${t.managerUserId} <> ${t.userId}`),
    index("membership_user_idx").on(t.userId),
    index("membership_manager_idx").on(t.organizationId, t.managerUserId),
  ],
);

/** FK from a user column to membership (organization_id, user_id): same-organisation members only. */
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
      .default(sql`'{seller}'`),
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

/** In-app notifications. Only the recipient can read them (personal policy in drizzle/0002). */
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
