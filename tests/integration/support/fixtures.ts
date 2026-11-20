import { randomUUID } from "node:crypto";
import * as s from "@/server/db/schema";
import { withTenant } from "@/server/db/tenant";
import { appDb } from "./db";

/** Every tenant-scoped table. Must match the database catalogue (tested). */
export const TENANT_TABLES = [
  "organization",
  "membership",
  "invitation",
  "notification",
  "support_function",
  "support_function_member",
  "engagement_type",
  "request_template",
  "scoring_rule_set",
  "account",
  "contact",
  "pipeline_stage",
  "opportunity",
  "opportunity_stage_event",
  "engagement_request",
  "engagement_status_event",
  "engagement_assignment",
  "booking",
  "effort_entry",
  "engagement_outcome",
] as const;

export type TenantTable = (typeof TENANT_TABLES)[number];

export interface TenantFixture {
  organizationId: string;
  aeUserId: string;
  specialistUserId: string;
  /** One row id per tenant table. */
  ids: Record<TenantTable, string>;
}

/** Create a complete organization with exactly one row in every tenant table. */
export async function createTenantFixture(
  label: string,
): Promise<TenantFixture> {
  const suffix = randomUUID().slice(0, 8);
  const [ae] = await appDb
    .insert(s.authUser)
    .values({ name: `${label} AE`, email: `ae-${suffix}@${label}.test` })
    .returning();
  const [specialist] = await appDb
    .insert(s.authUser)
    .values({
      name: `${label} Specialist`,
      email: `sp-${suffix}@${label}.test`,
      language: "fr",
    })
    .returning();
  const organizationId = randomUUID();
  const ctx = { organizationId, userId: ae!.id };

  const ids = await withTenant(appDb, ctx, async (tx) => {
    const one = <T extends { id: string }>(rows: T[]) => rows[0]!.id;

    await tx
      .insert(s.organization)
      .values({ id: organizationId, name: `${label} Ltd` });
    const membershipId = one(
      await tx
        .insert(s.membership)
        .values({ userId: ae!.id, roles: ["account_executive", "admin"] })
        .returning(),
    );
    await tx.insert(s.membership).values({
      userId: specialist!.id,
      roles: ["specialist"],
      skills: ["demo"],
      weeklyBookableHours: 12,
    });
    const invitationId = one(
      await tx
        .insert(s.invitation)
        .values({
          email: `new-${suffix}@${label}.test`,
          roles: ["specialist"],
          tokenHash: `hash-${suffix}`,
          expiresAt: new Date(Date.now() + 86_400_000),
        })
        .returning(),
    );
    const notificationId = one(
      await tx
        .insert(s.notification)
        .values({ userId: specialist!.id, kind: "request.assigned" })
        .returning(),
    );
    const functionId = one(
      await tx
        .insert(s.supportFunction)
        .values({ name: "Presales" })
        .returning(),
    );
    const sfmId = one(
      await tx
        .insert(s.supportFunctionMember)
        .values({
          supportFunctionId: functionId,
          userId: specialist!.id,
          isLead: true,
        })
        .returning(),
    );
    const engagementTypeId = one(
      await tx
        .insert(s.engagementType)
        .values({
          supportFunctionId: functionId,
          key: "demo",
          nameEn: "Demo",
          nameFr: "Démonstration",
        })
        .returning(),
    );
    const templateId = one(
      await tx
        .insert(s.requestTemplate)
        .values({
          supportFunctionId: functionId,
          version: 1,
          schema: { sections: [] },
        })
        .returning(),
    );
    const ruleSetId = one(
      await tx
        .insert(s.scoringRuleSet)
        .values({
          supportFunctionId: functionId,
          weights: {},
          effortBands: [],
          leadTimes: {},
          flagRules: [],
        })
        .returning(),
    );
    const accountId = one(
      await tx
        .insert(s.account)
        .values({ name: `${label} Customer`, ownerId: ae!.id })
        .returning(),
    );
    const contactId = one(
      await tx
        .insert(s.contact)
        .values({
          accountId,
          name: "Dana Buyer",
          decisionRole: "decision_maker",
        })
        .returning(),
    );
    const stageId = one(
      await tx
        .insert(s.pipelineStage)
        .values({
          nameEn: "Qualify",
          nameFr: "Qualifier",
          sortOrder: 1,
          probability: 10,
        })
        .returning(),
    );
    const opportunityId = one(
      await tx
        .insert(s.opportunity)
        .values({
          accountId,
          ownerId: ae!.id,
          name: "Platform deal",
          amount: 50000,
          stageId,
        })
        .returning(),
    );
    const stageEventId = one(
      await tx
        .insert(s.opportunityStageEvent)
        .values({ opportunityId, toStageId: stageId })
        .returning(),
    );
    const requestId = one(
      await tx
        .insert(s.engagementRequest)
        .values({
          opportunityId,
          requesterId: ae!.id,
          supportFunctionId: functionId,
          engagementTypeId,
          templateId,
          templateVersion: 1,
          status: "new",
        })
        .returning(),
    );
    const statusEventId = one(
      await tx
        .insert(s.engagementStatusEvent)
        .values({
          requestId,
          fromStatus: "draft",
          toStatus: "new",
          byUserId: ae!.id,
        })
        .returning(),
    );
    const assignmentId = one(
      await tx
        .insert(s.engagementAssignment)
        .values({ requestId, userId: specialist!.id })
        .returning(),
    );
    const bookingId = one(
      await tx
        .insert(s.booking)
        .values({
          requestId,
          startsAt: new Date("2026-12-01T09:00:00Z"),
          endsAt: new Date("2026-12-01T10:00:00Z"),
        })
        .returning(),
    );
    const effortId = one(
      await tx
        .insert(s.effortEntry)
        .values({
          requestId,
          userId: specialist!.id,
          hours: 2,
          activity: "prep",
          date: "2026-11-30",
        })
        .returning(),
    );
    const outcomeId = one(
      await tx
        .insert(s.engagementOutcome)
        .values({ requestId, result: "next_step", dealImpact: 4 })
        .returning(),
    );

    return {
      organization: organizationId,
      membership: membershipId,
      invitation: invitationId,
      notification: notificationId,
      support_function: functionId,
      support_function_member: sfmId,
      engagement_type: engagementTypeId,
      request_template: templateId,
      scoring_rule_set: ruleSetId,
      account: accountId,
      contact: contactId,
      pipeline_stage: stageId,
      opportunity: opportunityId,
      opportunity_stage_event: stageEventId,
      engagement_request: requestId,
      engagement_status_event: statusEventId,
      engagement_assignment: assignmentId,
      booking: bookingId,
      effort_entry: effortId,
      engagement_outcome: outcomeId,
    } satisfies Record<TenantTable, string>;
  });

  return {
    organizationId,
    aeUserId: ae!.id,
    specialistUserId: specialist!.id,
    ids,
  };
}
