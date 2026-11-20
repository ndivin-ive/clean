import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assessDeal } from "@/domain/rules/deal-health";
import { rankActions, candidates } from "@/domain/rules/today";
import { withTenant } from "@/server/db/tenant";
import {
  DEMO_ACCOUNTS,
  DEMO_DEALS,
  DEMO_PEOPLE,
} from "@/server/seed/demo-data";
import type { DemoIds } from "@/server/seed/demo";
import { demo } from "./support/demo";
import { loadBook } from "@/server/services/book";
import { appDb, closePools } from "./support/db";

const NOW = new Date("2026-11-20T09:00:00Z");
let ids: DemoIds;
let book: Awaited<ReturnType<typeof loadBook>>["book"];

beforeAll(async () => {
  ids = await demo(NOW);
  ({ book } = await loadBook(
    appDb,
    { organizationId: ids.organizationId, userId: ids.users.seller },
    NOW,
  ));
});
afterAll(closePools);

const count = (who: keyof DemoIds["users"], table: string) =>
  withTenant(
    appDb,
    { organizationId: ids.organizationId, userId: ids.users[who] },
    async (tx) =>
      (
        await tx.execute<{ n: number }>(
          sql`SELECT count(*)::int AS n FROM ${sql.identifier(table)}`,
        )
      ).rows[0]!.n,
  );

describe("demo book", () => {
  it("has the advertised size: 2 key + 8 other accounts, 12 deals, 40 people", async () => {
    expect(book.accounts).toHaveLength(10);
    expect(book.accounts.filter((a) => a.tier === "key")).toHaveLength(2);
    expect(book.deals).toHaveLength(12);
    expect(book.people).toHaveLength(40);
    expect(DEMO_PEOPLE).toHaveLength(40);
    expect(new Set(DEMO_PEOPLE.map((p) => p.key)).size).toBe(40);
  });

  it("spans six months of interactions and has upcoming meetings", async () => {
    const span = await withTenant(
      appDb,
      { organizationId: ids.organizationId, userId: ids.users.seller },
      async (tx) =>
        (
          await tx.execute<{ oldest: number; future: number; total: number }>(
            sql`SELECT round(extract(epoch FROM (${NOW.toISOString()}::timestamptz - min(occurred_at))) / 86400)::int AS oldest, count(*) FILTER (WHERE occurred_at > ${NOW.toISOString()}::timestamptz)::int AS future, count(*)::int AS total FROM interaction`,
          )
        ).rows[0]!,
    );
    expect(span.oldest).toBeGreaterThanOrEqual(150);
    expect(span.oldest).toBeLessThanOrEqual(200);
    expect(span.future).toBe(3);
    expect(span.total).toBeGreaterThanOrEqual(40);
  });

  it("every person's last contact is their most recent recorded interaction", async () => {
    const unbacked = await withTenant(
      appDb,
      { organizationId: ids.organizationId, userId: ids.users.seller },
      async (tx) =>
        (
          await tx.execute<{
            n: number;
          }>(sql`SELECT count(*)::int AS n FROM relationship r WHERE r.last_interaction_at IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM interaction_participant ip JOIN interaction i ON i.id = ip.interaction_id
        WHERE ip.person_id = r.person_id AND abs(extract(epoch FROM (i.occurred_at - r.last_interaction_at))) < 60)
        OR r.last_interaction_at < (SELECT max(i.occurred_at) FROM interaction_participant ip JOIN interaction i ON i.id = ip.interaction_id
          WHERE ip.person_id = r.person_id AND i.occurred_at <= ${NOW.toISOString()}::timestamptz) - interval '1 minute'`)
        ).rows[0]!.n,
    );
    expect(unbacked).toBe(0);
  });

  it("tells the story: each storyline lights up its Today rule", () => {
    const all = candidates(book);
    const has = (rule: string, subject: string) =>
      all.some((c) => c.ruleKey === rule && c.subjectKey.startsWith(subject));
    expect(has("single", ids.deals.d3!)).toBe(true); // Brightwater: one engaged contact on €95k
    expect(has("stalled", ids.deals.d7!)).toBe(true); // Halden: 41 days in Discovery
    expect(has("stalled", ids.deals.d2!)).toBe(true); // Eskerfield: 36 days in Discovery
    expect(has("nextStep", ids.deals.d7!)).toBe(true); // Halden: no next step
    expect(has("nextStep", ids.deals.d1!)).toBe(true); // Arvalis: next step overdue
    expect(has("criterion", ids.deals.d3!)).toBe(true); // Brightwater: economic buyer unknown at Proposal
    expect(has("forecast", ids.deals.d3!)).toBe(true); // Brightwater: closes in 21 days, no forecast
    expect(has("reconnect", ids.people.p2!)).toBe(true); // Karim, champion, 26 days > 14
    expect(has("renewal", ids.accounts.a1!)).toBe(true); // Arvalis renews in 70 days, plan 80 days old
    expect(
      all.some(
        (c) =>
          c.ruleKey === "signal" &&
          c.reason.params.title ===
            "Sophie Lambert announced she is leaving Halden Insurance",
      ),
    ).toBe(true);
    expect(all.some((c) => c.ruleKey === "prepare")).toBe(true); // workshop in ~20 h, brief not opened
  });

  it("Today shows 7 actions with reasons", () => {
    const top = rankActions(book);
    expect(top).toHaveLength(7);
    expect(top.every((c) => c.reason.code && c.score > 0)).toBe(true);
  });

  it("deal health covers all three bands", () => {
    const stages = new Map(book.stages.map((st) => [st.id, st]));
    const people = new Map(book.people.map((p) => [p.id, p]));
    const bands = new Set(
      book.deals
        .filter(
          (d) =>
            !stages.get(d.stageId)!.isWon && !stages.get(d.stageId)!.isLost,
        )
        .map(
          (d) =>
            assessDeal(d, {
              now: NOW,
              stage: stages.get(d.stageId)!,
              criteria: book.criteria,
              people,
            }).band,
        ),
    );
    expect([...bands].sort()).toEqual(["healthy", "risk", "watch"]);
  });

  it("the book is private: the teammate and the admin see none of it, the seller sees all", async () => {
    expect(await count("seller", "account")).toBe(DEMO_ACCOUNTS.length);
    expect(await count("seller", "deal")).toBe(DEMO_DEALS.length);
    expect(await count("peer", "account")).toBe(0);
    expect(await count("admin", "deal")).toBe(0);
    expect(await count("manager", "person")).toBe(0);
  });
});
