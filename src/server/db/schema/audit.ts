import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Append-only audit log, written ONLY by the `audit_row()` trigger (SECURITY
 * DEFINER). The app role can SELECT its own tenant's rows but has no
 * INSERT / UPDATE / DELETE privilege. No FK to organization so the trail
 * survives deletes. Secret columns are redacted by the trigger.
 */
export const auditEvent = pgTable(
  "audit_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    actorId: uuid("actor_id"),
    entity: text("entity").notNull(),
    entityId: uuid("entity_id"),
    action: text("action").notNull(), // insert | update | delete
    before: jsonb("before"),
    after: jsonb("after"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_event_entity_idx").on(
      t.organizationId,
      t.entity,
      t.entityId,
      t.at,
    ),
    index("audit_event_at_idx").on(t.organizationId, t.at),
  ],
);
