import { describe, expect, it } from "vitest";
import { can, type Permission, type Role } from "@/domain/permissions";

const cases: [Permission, Role, boolean][] = [
  ["team.view", "admin", true],
  ["team.view", "manager", true],
  ["team.view", "seller", false],
  ["team.invite", "admin", true],
  ["team.invite", "manager", false],
  ["team.edit_roles", "admin", true],
  ["team.edit_roles", "seller", false],
  ["org.team_visibility", "admin", true],
  ["org.team_visibility", "manager", false],
  ["org.settings", "admin", true],
  ["org.settings", "specialist", false],
];
describe("permissions", () => {
  it.each(cases)("%s for %s → %s", (p, r, ok) => expect(can([r], p)).toBe(ok));
  it("any held role grants", () =>
    expect(can(["seller", "admin"], "team.invite")).toBe(true));
});
