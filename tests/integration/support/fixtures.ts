import { randomUUID } from "node:crypto";
import * as s from "@/server/db/schema";
import { withTenant } from "@/server/db/tenant";
import { appDb } from "./db";

/** Every tenant-scoped table. Must match the database catalogue (tested). */
export const TENANT_ONLY_TABLES = [
  "organization",
  "membership",
  "invitation",
  "notification",
  "pipeline_stage",
  "qualification_criterion",
  "role_cadence",
  "rule_setting",
  "feature_flag",
  "ai_provider_setting",
] as const;

/** Seller-owned tables (carry owner_id; owner-privacy policies apply). */
export const OWNED_TABLES = [
  "user_rule_adjustment",
  "account",
  "person",
  "relationship",
  "signal",
  "account_plan",
  "deal",
  "deal_stakeholder",
  "deal_qualification",
  "deal_event",
  "close_plan_step",
  "interaction",
  "interaction_participant",
  "capture_proposal",
  "meeting_brief",
  "action",
  "support_request",
] as const;

export const TENANT_TABLES = [...TENANT_ONLY_TABLES, ...OWNED_TABLES] as const;
export type TenantTable = (typeof TENANT_TABLES)[number];

export interface TenantFixture {
  organizationId: string;
  /** Owns every seller-owned row. */
  sellerId: string;
  /** Same manager as the seller (teammate). */
  peerId: string;
  /** Manager of seller and peer. */
  managerId: string;
  /** Admin, outside the team. */
  adminId: string;
  ids: Record<TenantTable, string>;
}

async function createUser(label: string, role: string) {
  const [u] = await appDb
    .insert(s.authUser)
    .values({
      name: `${label} ${role}`,
      email: `${role}-${randomUUID().slice(0, 8)}@${label}.test`,
    })
    .returning();
  return u!.id;
}

/** One organisation with exactly one row in every tenant table, seller-owned rows owned by `sellerId`. */
export async function createTenantFixture(
  label: string,
): Promise<TenantFixture> {
  const [sellerId, peerId, managerId, adminId] = [
    await createUser(label, "seller"),
    await createUser(label, "peer"),
    await createUser(label, "manager"),
    await createUser(label, "admin"),
  ];
  const organizationId = randomUUID();

  const ids = await withTenant(
    appDb,
    { organizationId, userId: sellerId },
    async (tx) => {
      const one = <T extends { id: string }>(rows: T[]) => rows[0]!.id;
      await tx
        .insert(s.organization)
        .values({ id: organizationId, name: `${label} Ltd` });
      await tx
        .insert(s.membership)
        .values({ userId: managerId, roles: ["manager", "seller"] });
      const membershipId = one(
        await tx
          .insert(s.membership)
          .values({
            userId: sellerId,
            roles: ["seller"],
            managerUserId: managerId,
          })
          .returning(),
      );
      await tx.insert(s.membership).values({
        userId: peerId,
        roles: ["seller"],
        managerUserId: managerId,
      });
      await tx
        .insert(s.membership)
        .values({ userId: adminId, roles: ["admin"] });

      const invitationId = one(
        await tx
          .insert(s.invitation)
          .values({
            email: `new@${label}.test`,
            tokenHash: `hash-${randomUUID()}`,
            expiresAt: new Date(Date.now() + 86_400_000),
          })
          .returning(),
      );
      const notificationId = one(
        await tx
          .insert(s.notification)
          .values({ userId: sellerId, kind: "proposals.ready" })
          .returning(),
      );
      const stageId = one(
        await tx
          .insert(s.pipelineStage)
          .values({
            nameEn: "Discovery",
            nameFr: "Découverte",
            sortOrder: 2,
            probability: 25,
            typicalDays: 21,
          })
          .returning(),
      );
      const criterionId = one(
        await tx
          .insert(s.qualificationCriterion)
          .values({
            key: "economic_buyer",
            labelEn: "Economic buyer",
            labelFr: "Décideur budgétaire",
            requiredLate: true,
          })
          .returning(),
      );
      const cadenceId = one(
        await tx
          .insert(s.roleCadence)
          .values({ role: "champion", days: 14 })
          .returning(),
      );
      const ruleSettingId = one(
        await tx
          .insert(s.ruleSetting)
          .values({ key: "today.weight.nextStep", value: 30 })
          .returning(),
      );
      const flagId = one(
        await tx
          .insert(s.featureFlag)
          .values({ key: "support_requests", enabled: false })
          .returning(),
      );
      // RETURNING only id: the app role cannot read encrypted_key.
      const aiId = one(
        await tx
          .insert(s.aiProviderSetting)
          .values({ provider: "off", encryptedKey: "enc:v1:secret" })
          .returning({ id: s.aiProviderSetting.id }),
      );

      const adjustmentId = one(
        await tx
          .insert(s.userRuleAdjustment)
          .values({ ruleKey: "signal", multiplier: 0.8 })
          .returning(),
      );
      const accountId = one(
        await tx
          .insert(s.account)
          .values({
            name: `${label} Customer`,
            tier: "key",
            relationship: "customer",
            annualValue: 120000,
          })
          .returning(),
      );
      const personId = one(
        await tx
          .insert(s.person)
          .values({ accountId, name: "Dana Buyer", title: "CFO" })
          .returning(),
      );
      const relationshipId = one(
        await tx
          .insert(s.relationship)
          .values({
            personId,
            decisionRole: "economic_buyer",
            stance: "supporter",
            strength: 4,
          })
          .returning(),
      );
      const signalId = one(
        await tx
          .insert(s.signal)
          .values({
            accountId,
            personId,
            type: "news",
            title: "Expansion announced",
            relevance: 3,
          })
          .returning(),
      );
      const planId = one(
        await tx
          .insert(s.accountPlan)
          .values({ accountId, objectives: "Grow" })
          .returning(),
      );
      const dealId = one(
        await tx
          .insert(s.deal)
          .values({ accountId, name: "Platform deal", amount: 50000, stageId })
          .returning(),
      );
      const stakeholderId = one(
        await tx
          .insert(s.dealStakeholder)
          .values({ dealId, personId, roleInDeal: "economic_buyer" })
          .returning(),
      );
      const qualificationId = one(
        await tx
          .insert(s.dealQualification)
          .values({
            dealId,
            criterionKey: "economic_buyer",
            status: "partial",
            evidence: "Owns the budget",
          })
          .returning(),
      );
      const eventId = one(
        await tx
          .insert(s.dealEvent)
          .values({ dealId, kind: "stage", fromValue: null, toValue: stageId })
          .returning(),
      );
      const stepId = one(
        await tx
          .insert(s.closePlanStep)
          .values({ dealId, title: "Security review", stepOwner: "buyer" })
          .returning(),
      );
      const interactionId = one(
        await tx
          .insert(s.interaction)
          .values({
            accountId,
            dealId,
            type: "meeting",
            occurredAt: new Date(),
            summary: "Kick-off",
          })
          .returning(),
      );
      const participantId = one(
        await tx
          .insert(s.interactionParticipant)
          .values({ interactionId, personId })
          .returning(),
      );
      const proposalId = one(
        await tx
          .insert(s.captureProposal)
          .values({
            batchId: randomUUID(),
            kind: "next_step",
            entity: "deal",
            entityId: dealId,
            change: { nextStep: "Send pack" },
            sourceExcerpt: "Next step: send pack",
          })
          .returning(),
      );
      const briefId = one(
        await tx
          .insert(s.meetingBrief)
          .values({ interactionId, content: { sections: [] } })
          .returning(),
      );
      const actionId = one(
        await tx
          .insert(s.action)
          .values({
            dealId,
            ruleKey: "nextStep",
            subjectKey: dealId,
            fingerprint: "x",
            status: "snoozed",
          })
          .returning(),
      );
      const supportId = one(
        await tx
          .insert(s.supportRequest)
          .values({ dealId, team: "Presales" })
          .returning(),
      );

      return {
        organization: organizationId,
        membership: membershipId,
        invitation: invitationId,
        notification: notificationId,
        pipeline_stage: stageId,
        qualification_criterion: criterionId,
        role_cadence: cadenceId,
        rule_setting: ruleSettingId,
        feature_flag: flagId,
        ai_provider_setting: aiId,
        user_rule_adjustment: adjustmentId,
        account: accountId,
        person: personId,
        relationship: relationshipId,
        signal: signalId,
        account_plan: planId,
        deal: dealId,
        deal_stakeholder: stakeholderId,
        deal_qualification: qualificationId,
        deal_event: eventId,
        close_plan_step: stepId,
        interaction: interactionId,
        interaction_participant: participantId,
        capture_proposal: proposalId,
        meeting_brief: briefId,
        action: actionId,
        support_request: supportId,
      } satisfies Record<TenantTable, string>;
    },
  );

  return { organizationId, sellerId, peerId, managerId, adminId, ids };
}

export const as = (
  f: TenantFixture,
  who: "sellerId" | "peerId" | "managerId" | "adminId" = "sellerId",
) => ({
  organizationId: f.organizationId,
  userId: f[who],
});
