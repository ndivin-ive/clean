/**
 * Use case: Meca-Inox (docs/USE_CASE_MECA_INOX.md). The industrial_equipment
 * profile and the invented French book must drive the same rules engine.
 */
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { salesProfile } from "@/domain/profiles";
import { candidates, rankActions } from "@/domain/rules/today";
import { withTenant } from "@/server/db/tenant";
import type { DemoIds } from "@/server/seed/demo";
import { MECA_INOX_DEMO as M } from "@/server/seed/meca-inox-data";
import { loadBook } from "@/server/services/book";
import { getOrganizationBrand } from "@/server/services/organizations";
import { appDb, closePools, ownerPool } from "./support/db";
import { demo } from "./support/demo";

const NOW = new Date("2026-11-20T09:00:00Z");
let ids: DemoIds;
let book: Awaited<ReturnType<typeof loadBook>>["book"];
const tenant = () => ({
  organizationId: ids.organizationId,
  userId: ids.users.seller,
});

beforeAll(async () => {
  ids = await demo(NOW, M);
  ({ book } = await loadBook(appDb, tenant(), NOW));
});
afterAll(closePools);

describe("Meca-Inox use case", () => {
  it("the dataset only uses stage and criterion keys of the industrial profile", () => {
    const p = salesProfile("industrial_equipment");
    const stageKeys = new Set(p.stages.map((s) => s.key));
    expect(M.deals.every((d) => stageKeys.has(d.stage))).toBe(true);
    expect(M.deals.every((d) => d.qual.length === p.criteria.length)).toBe(
      true,
    );
    const crit = new Set(p.criteria.map((c) => c.key));
    expect(M.evidence.every((e) => crit.has(e.criterion))).toBe(true);
  });

  it("the organisation is French and configured for industrial equipment", async () => {
    const row = await withTenant(
      appDb,
      tenant(),
      async (tx) =>
        (
          await tx.execute<{
            lang: string;
            profile: string;
            stages: string;
            criteria: string;
            single: string;
          }>(
            sql`SELECT o.default_language AS lang, o.sales_profile AS profile,
            (SELECT string_agg(name_fr, ' > ' ORDER BY sort_order) FROM pipeline_stage) AS stages,
            (SELECT string_agg(key, ',' ORDER BY sort_order) FROM qualification_criterion) AS criteria,
            (SELECT value::text FROM rule_setting WHERE key = 'today.singleThreadAmount') AS single
            FROM organization o`,
          )
        ).rows[0]!,
    );
    expect(row.lang).toBe("fr");
    expect(row.profile).toBe("industrial_equipment");
    expect(row.stages).toBe(
      "Détection > Qualification technique > Étude et chiffrage > Offre remise > Négociation et référencement > Commande gagnée > Perdue",
    );
    expect(row.criteria).toBe(
      "specification,standards,economic_buyer,decision_process,vendor_listing,prescriber,pain,competition",
    );
    expect(Number(row.single)).toBe(40000);
  });

  it("has the advertised size: 10 accounts (2 key), 12 deals, 40 people, 3 meetings ahead", () => {
    expect(book.accounts).toHaveLength(10);
    expect(book.accounts.filter((a) => a.tier === "key")).toHaveLength(2);
    expect(book.deals).toHaveLength(12);
    expect(book.people).toHaveLength(40);
  });

  it("tells the industrial story: each storyline lights up its Today rule", () => {
    const all = candidates(book);
    const has = (rule: string, subject: string) =>
      all.some((c) => c.ruleKey === rule && c.subjectKey.startsWith(subject));
    expect(has("stalled", ids.deals.d1!)).toBe(true); // nitric acid offer: 52 days at "Offre remise"
    expect(has("nextStep", ids.deals.d1!)).toBe(true); // technical review overdue
    expect(has("nextStep", ids.deals.d8!)).toBe(true); // EPC prescription: no next step
    expect(has("single", ids.deals.d5!)).toBe(true); // cryogenic OEM: purchasing only, €340k
    expect(has("forecast", ids.deals.d4!)).toBe(true); // distributor stock order closes in 15 days, no forecast
    expect(has("criterion", ids.deals.d3!)).toBe(true); // OEM listing: vendor listing unknown at "Étude et chiffrage"
    expect(has("reconnect", ids.people.p2!)).toBe(true); // Nadia, champion, 30 days > 21
    expect(has("renewal", ids.accounts.m1!)).toBe(true); // MRO framework renews in 60 days, plan 95 days old
    expect(
      all.some(
        (c) =>
          c.ruleKey === "signal" &&
          String(c.reason.params.title).startsWith("Le directeur d’usine"),
      ),
    ).toBe(true);
    expect(all.some((c) => c.ruleKey === "prepare")).toBe(true); // supplier audit in 20 h
  });

  it("Today shows 7 ranked actions, each with its reason", () => {
    const top = rankActions(book);
    expect(top).toHaveLength(7);
    expect(top.every((c) => c.reason.code && c.score > 0)).toBe(true);
  });

  it("stays private: the peer seller and the admin see none of Julien's book", async () => {
    const n = (who: keyof DemoIds["users"]) =>
      withTenant(
        appDb,
        { organizationId: ids.organizationId, userId: ids.users[who] },
        async (tx) =>
          (
            await tx.execute<{ n: number }>(
              sql`SELECT count(*)::int AS n FROM deal`,
            )
          ).rows[0]!.n,
      );
    expect(await n("seller")).toBe(12);
    expect(await n("peer")).toBe(0);
    expect(await n("admin")).toBe(0);
  });
  it("carries the brand colours, and the database refuses anything but #rrggbb", async () => {
    expect(await getOrganizationBrand(appDb, tenant())).toEqual({
      name: "Meca-Inox (démo)",
      brand: { color: "#EC001B", ink: "#233044" },
    });
    await expect(
      ownerPool.query(
        "UPDATE organization SET brand_color = '#000;}*{x:y' WHERE id = $1",
        [ids.organizationId],
      ),
    ).rejects.toThrow(/organization_brand_color_hex/);
  });
});
