import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  DEFAULT_CADENCES,
  DEFAULT_CRITERIA,
  DEFAULT_RULE_SETTINGS,
  DEFAULT_STAGES,
} from "@/domain/settings/defaults";
import { FLAGS } from "@/domain/flags";
import type { Database } from "../db/client";
import * as s from "../db/schema";
import { withTenant, withUser } from "../db/tenant";

export interface OrganizationSummary {
  id: string;
  name: string;
  roles: string[];
}

/** Organisations the user belongs to (works before a tenant is selected). */
export async function listMyOrganizations(
  db: Database,
  userId: string,
): Promise<OrganizationSummary[]> {
  return withUser(db, userId, (tx) =>
    tx
      .select({
        id: s.organization.id,
        name: s.organization.name,
        roles: s.membership.roles,
      })
      .from(s.membership)
      .innerJoin(
        s.organization,
        eq(s.organization.id, s.membership.organizationId),
      )
      .where(
        and(eq(s.membership.userId, userId), eq(s.membership.isActive, true)),
      )
      .orderBy(s.organization.name),
  );
}

/**
 * Create an organisation with the creator as admin + seller, and seed default
 * settings: stages, qualification criteria, role cadences, rule weights,
 * feature flags (off) and AI provider (off).
 */
export async function createOrganization(
  db: Database,
  userId: string,
  input: { name: string; defaultLanguage: "en" | "fr" },
  /** Fixed id for the demo seed; random otherwise. */
  id?: string,
): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new Error("Organisation name is required");
  const organizationId = id ?? randomUUID();
  await withTenant(db, { organizationId, userId }, async (tx) => {
    await tx.insert(s.organization).values({
      id: organizationId,
      name,
      defaultLanguage: input.defaultLanguage,
      setupCompletedAt: new Date(),
    });
    await tx
      .insert(s.membership)
      .values({ userId, roles: ["admin", "seller"] });
    await tx.insert(s.pipelineStage).values(
      DEFAULT_STAGES.map((st, i) => ({
        nameEn: st.nameEn,
        nameFr: st.nameFr,
        exitCriterionEn: st.exitEn,
        exitCriterionFr: st.exitFr,
        sortOrder: i + 1,
        probability: st.probability,
        typicalDays: st.typicalDays,
        isWon: st.isWon,
        isLost: st.isLost,
      })),
    );
    await tx.insert(s.qualificationCriterion).values(
      DEFAULT_CRITERIA.map((c, i) => ({
        key: c.key,
        labelEn: c.labelEn,
        labelFr: c.labelFr,
        helpEn: c.helpEn,
        helpFr: c.helpFr,
        sortOrder: i + 1,
        requiredLate: c.requiredLate,
      })),
    );
    await tx.insert(s.roleCadence).values(
      Object.entries(DEFAULT_CADENCES).map(([role, days]) => ({
        role: role as (typeof s.roleCadence.$inferInsert)["role"],
        days: days!,
      })),
    );
    await tx.insert(s.ruleSetting).values(
      Object.entries(DEFAULT_RULE_SETTINGS).map(([key, value]) => ({
        key,
        value,
      })),
    );
    await tx
      .insert(s.featureFlag)
      .values(
        Object.entries(FLAGS).map(([key, enabled]) => ({ key, enabled })),
      );
    await tx
      .insert(s.aiProviderSetting)
      .values({ provider: "off" })
      .returning({ id: s.aiProviderSetting.id });
  });
  return organizationId;
}

/** Make `organizationId` the session's active organisation, if the user is an active member. */
export async function selectOrganization(
  db: Database,
  user: { id: string; sessionId: string },
  organizationId: string,
): Promise<boolean> {
  const orgs = await listMyOrganizations(db, user.id);
  if (!orgs.some((o) => o.id === organizationId)) return false;
  await db
    .update(s.authSession)
    .set({ activeOrganizationId: organizationId })
    .where(
      and(
        eq(s.authSession.id, user.sessionId),
        eq(s.authSession.userId, user.id),
      ),
    );
  return true;
}
