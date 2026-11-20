/** Organisation roles (D-032) and what each may do. Enforced in services (API checks, rule 2) on top of RLS. */
export type Role = "seller" | "manager" | "admin" | "specialist";

export type Permission =
  | "team.view"
  | "team.invite"
  | "team.edit_roles"
  | "org.team_visibility"
  | "org.settings";

const MATRIX: Record<Permission, Role[]> = {
  "team.view": ["admin", "manager"],
  "team.invite": ["admin"],
  "team.edit_roles": ["admin"],
  "org.team_visibility": ["admin"],
  "org.settings": ["admin"],
};

export function can(roles: readonly Role[], permission: Permission): boolean {
  return roles.some((r) => MATRIX[permission].includes(r));
}

export class ForbiddenError extends Error {
  constructor(permission: Permission) {
    super(`Not allowed: ${permission}`);
    this.name = "ForbiddenError";
  }
}

export function assertCan(
  roles: readonly Role[],
  permission: Permission,
): void {
  if (!can(roles, permission)) throw new ForbiddenError(permission);
}
