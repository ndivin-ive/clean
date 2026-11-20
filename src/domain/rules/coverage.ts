import { REQUIRED_ROLES } from "../settings/defaults";
import type { DecisionRole, Person } from "../types";
import { isEngaged } from "./common";

export type CoverageStatus = "filled" | "weak" | "missing";
export interface RoleCoverage {
  role: DecisionRole;
  status: CoverageStatus;
  personIds: string[];
}

/**
 * Coverage map (brief §5.4). Filled = someone in the role with strength ≥ 3 who
 * is engaged; weak = someone in the role but strength ≤ 2 or stale; missing = nobody.
 */
export function coverage(
  people: Pick<Person, "id" | "role" | "strength" | "lastInteractionAt">[],
  now: Date,
  opts: { requiredRoles?: DecisionRole[]; engagedDays?: number } = {},
): RoleCoverage[] {
  const roles = opts.requiredRoles ?? REQUIRED_ROLES;
  const engagedDays = opts.engagedDays ?? 60;
  return roles.map((role) => {
    const inRole = people.filter((p) => p.role === role);
    const strong = inRole.some(
      (p) => p.strength >= 3 && isEngaged(p, now, engagedDays),
    );
    return {
      role,
      status: strong ? "filled" : inRole.length ? "weak" : "missing",
      personIds: inRole.map((p) => p.id),
    };
  });
}
