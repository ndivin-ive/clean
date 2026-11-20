/** Feature flags known to the app, with their defaults (D-031). Stored per organisation in `feature_flag`. */
export const FLAGS = {
  /** "Get help on this deal" — specialist support requests from the earlier build. Parked in Phase 1. */
  support_requests: false,
} as const;

export type FlagKey = keyof typeof FLAGS;

export function resolveFlag(
  key: FlagKey,
  stored: ReadonlyMap<string, boolean>,
): boolean {
  return stored.get(key) ?? FLAGS[key];
}
