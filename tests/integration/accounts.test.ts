import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DemoIds } from "@/server/seed/demo";
import { demo } from "./support/demo";
import { getAccountDetail, listAccounts } from "@/server/services/accounts";
import { appDb, closePools } from "./support/db";

const NOW = new Date("2026-11-20T09:00:00Z");
let ids: DemoIds;
const seller = () => ({
  organizationId: ids.organizationId,
  userId: ids.users.seller,
});

beforeAll(async () => {
  ids = await demo(NOW);
});
afterAll(closePools);

describe("accounts list", () => {
  it("lists the seller's 10 accounts, key accounts first, each with health and a next action where relevant", async () => {
    const { accounts } = await listAccounts(appDb, seller(), NOW);
    expect(accounts).toHaveLength(10);
    expect(accounts.slice(0, 2).every((a) => a.tier === "key")).toBe(true);
    expect(
      accounts.every(
        (a) =>
          a.health.score >= 0 &&
          a.health.score <= 100 &&
          a.health.reasons.length === 6,
      ),
    ).toBe(true);
    const arvalis = accounts.find((a) => a.name === "Arvalis Logistics")!;
    expect(arvalis.openDeals).toBe(2);
    expect(arvalis.openPipeline).toBe(215_000);
    expect(arvalis.nextAction?.accountId).toBe(arvalis.id);
  });
  it("is empty for a teammate (privacy)", async () => {
    const { accounts } = await listAccounts(
      appDb,
      { organizationId: ids.organizationId, userId: ids.users.peer },
      NOW,
    );
    expect(accounts).toEqual([]);
  });
});

describe("account detail", () => {
  it("returns people with relationships, coverage, deals with health, timeline and signals", async () => {
    const d = (await getAccountDetail(appDb, seller(), ids.accounts.a1!, NOW))!;
    expect(d.account.name).toBe("Arvalis Logistics");
    expect(d.people).toHaveLength(6);
    expect(d.people.find((p) => p.name === "Karim Benali")).toMatchObject({
      role: "champion",
      stance: "supporter",
      strength: 5,
    });
    expect(d.health.coverage.map((c) => [c.role, c.status])).toEqual([
      ["economic_buyer", "filled"],
      ["decision_maker", "weak"],
      ["champion", "filled"],
      ["technical_evaluator", "missing"],
      ["procurement", "weak"],
    ]);
    expect(d.deals.map((x) => x.name).sort()).toEqual([
      "Fleet telemetry pilot",
      "Warehouse analytics expansion",
    ]);
    expect(d.deals.every((x) => x.health !== null)).toBe(true);
    expect(
      d.interactions.some(
        (i) =>
          i.title === "Quarterly business review · Arvalis" &&
          i.occurredAt > NOW,
      ),
    ).toBe(true);
    expect(
      d.interactions
        .find((i) => i.summary.startsWith("Quarterly review with Nathalie"))
        ?.people.sort(),
    ).toEqual(["Karim Benali", "Nathalie Fournier"]);
    expect(d.plan?.risks).toBe(1);
  });
  it("is null for someone else's account, an unknown id or a malformed id", async () => {
    expect(
      await getAccountDetail(
        appDb,
        { organizationId: ids.organizationId, userId: ids.users.peer },
        ids.accounts.a1!,
        NOW,
      ),
    ).toBeNull();
    expect(
      await getAccountDetail(
        appDb,
        seller(),
        "00000000-0000-4000-8000-000000000000",
        NOW,
      ),
    ).toBeNull();
    expect(
      await getAccountDetail(appDb, seller(), "not-a-uuid", NOW),
    ).toBeNull();
  });
});
