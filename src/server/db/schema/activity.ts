import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { account, person } from "./accounts";
import { ownedColumns, ownedFk, ownerKey, tenantKey } from "./columns";
import { deal } from "./deals";
import {
  actionOriginEnum,
  actionStatusEnum,
  briefGeneratorEnum,
  interactionSourceEnum,
  interactionTypeEnum,
  proposalStatusEnum,
  supportStatusEnum,
} from "./enums";
import { memberFk, orgFk } from "./tenancy";

/* Seller-owned: interaction, interaction_participant, capture_proposal, meeting_brief, action, support_request. */

/** Meetings, calls, emails, notes, events. A future `occurred_at` is a scheduled interaction. */
export const interaction = pgTable(
  "interaction",
  {
    ...ownedColumns(),
    accountId: uuid("account_id").notNull(),
    dealId: uuid("deal_id"),
    type: interactionTypeEnum("type").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    title: text("title"),
    summary: text("summary").notNull().default(""),
    source: interactionSourceEnum("source").notNull().default("manual"),
  },
  (t) => [
    tenantKey(t, "interaction"),
    ownerKey(t, "interaction"),
    orgFk("interaction_organization_fk", t),
    ownedFk("interaction_account_fk", t, t.accountId, account).onDelete(
      "cascade",
    ),
    ownedFk("interaction_deal_fk", t, t.dealId, deal).onDelete("set null"),
    index("interaction_account_idx").on(
      t.organizationId,
      t.accountId,
      t.occurredAt,
    ),
    index("interaction_owner_time_idx").on(
      t.organizationId,
      t.ownerId,
      t.occurredAt,
    ),
  ],
);

/** Participants (D-034): a customer-side person OR a colleague (member), exactly one of the two. */
export const interactionParticipant = pgTable(
  "interaction_participant",
  {
    ...ownedColumns(),
    interactionId: uuid("interaction_id").notNull(),
    personId: uuid("person_id"),
    userId: uuid("user_id"),
  },
  (t) => [
    tenantKey(t, "interaction_participant"),
    ownerKey(t, "interaction_participant"),
    orgFk("interaction_participant_organization_fk", t),
    ownedFk(
      "interaction_participant_interaction_fk",
      t,
      t.interactionId,
      interaction,
    ).onDelete("cascade"),
    ownedFk(
      "interaction_participant_person_fk",
      t,
      t.personId,
      person,
    ).onDelete("cascade"),
    memberFk("interaction_participant_user_fk", t, t.userId),
    check(
      "interaction_participant_one_party",
      sql`(${t.personId} IS NULL) <> (${t.userId} IS NULL)`,
    ),
  ],
);

/**
 * A change proposed from a capture (note, paste, later email/calendar/transcript).
 * Nothing is written to the target entity until the seller approves (rule 3).
 * Only the relevant excerpt is kept as the source, never the full email (rule 6).
 */
export const captureProposal = pgTable(
  "capture_proposal",
  {
    ...ownedColumns(),
    interactionId: uuid("interaction_id"),
    batchId: uuid("batch_id").notNull(),
    kind: text("kind").notNull(),
    entity: text("entity").notNull(),
    entityId: uuid("entity_id"),
    change: jsonb("change").notNull(),
    sourceKind: interactionSourceEnum("source_kind").notNull().default("paste"),
    sourceLine: integer("source_line"),
    sourceExcerpt: text("source_excerpt"),
    status: proposalStatusEnum("status").notNull().default("pending"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => [
    tenantKey(t, "capture_proposal"),
    ownerKey(t, "capture_proposal"),
    orgFk("capture_proposal_organization_fk", t),
    ownedFk(
      "capture_proposal_interaction_fk",
      t,
      t.interactionId,
      interaction,
    ).onDelete("set null"),
    index("capture_proposal_pending_idx").on(
      t.organizationId,
      t.ownerId,
      t.status,
    ),
  ],
);

export const meetingBrief = pgTable(
  "meeting_brief",
  {
    ...ownedColumns(),
    interactionId: uuid("interaction_id").notNull(),
    content: jsonb("content").notNull(),
    generatedBy: briefGeneratorEnum("generated_by").notNull().default("rules"),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
  },
  (t) => [
    tenantKey(t, "meeting_brief"),
    ownerKey(t, "meeting_brief"),
    orgFk("meeting_brief_organization_fk", t),
    ownedFk(
      "meeting_brief_interaction_fk",
      t,
      t.interactionId,
      interaction,
    ).onDelete("cascade"),
    unique("meeting_brief_interaction_key").on(
      t.organizationId,
      t.interactionId,
    ),
  ],
);

/**
 * Today actions. Rule actions are recomputed on every load; this table keeps
 * their state (done / snoozed / dismissed) keyed by rule + subject, with the
 * condition fingerprint so an action returns when its situation changes.
 */
export const action = pgTable(
  "action",
  {
    ...ownedColumns(),
    accountId: uuid("account_id"),
    dealId: uuid("deal_id"),
    personId: uuid("person_id"),
    ruleKey: text("rule_key").notNull(),
    subjectKey: text("subject_key").notNull(),
    fingerprint: text("fingerprint").notNull().default(""),
    title: text("title"),
    reasonCode: text("reason_code"),
    reasonText: text("reason_text"),
    score: integer("score"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    status: actionStatusEnum("status").notNull().default("open"),
    snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
    origin: actionOriginEnum("origin").notNull().default("rule"),
  },
  (t) => [
    tenantKey(t, "action"),
    ownerKey(t, "action"),
    orgFk("action_organization_fk", t),
    ownedFk("action_account_fk", t, t.accountId, account).onDelete("cascade"),
    ownedFk("action_deal_fk", t, t.dealId, deal).onDelete("cascade"),
    ownedFk("action_person_fk", t, t.personId, person).onDelete("cascade"),
    unique("action_owner_rule_subject_key").on(
      t.organizationId,
      t.ownerId,
      t.ruleKey,
      t.subjectKey,
    ),
  ],
);

/** Parked module from the earlier build: "Get help on this deal", behind flag `support_requests` (D-031). */
export const supportRequest = pgTable(
  "support_request",
  {
    ...ownedColumns(),
    dealId: uuid("deal_id").notNull(),
    team: text("team").notNull(),
    note: text("note").notNull().default(""),
    status: supportStatusEnum("status").notNull().default("open"),
  },
  (t) => [
    tenantKey(t, "support_request"),
    ownerKey(t, "support_request"),
    orgFk("support_request_organization_fk", t),
    ownedFk("support_request_deal_fk", t, t.dealId, deal).onDelete("cascade"),
  ],
);
