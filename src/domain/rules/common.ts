import { daysBetween } from "../time";
import type { Person } from "../types";

export type Band = "healthy" | "watch" | "risk";

/** One scored factor, returned so the UI can show why (rule 4). */
export interface Reason {
  code: string;
  points: number;
  max: number;
  detail: Record<string, string | number | null>;
}

export interface Assessment {
  score: number;
  band: Band;
  reasons: Reason[];
}

export function band(score: number): Band {
  return score >= 70 ? "healthy" : score >= 40 ? "watch" : "risk";
}

export function assessment(reasons: Reason[]): Assessment {
  const score = reasons.reduce((s, r) => s + r.points, 0);
  return { score, band: band(score), reasons };
}

/** Days since the last interaction, or null when never contacted. */
export function daysSinceTouch(
  p: Pick<Person, "lastInteractionAt">,
  now: Date,
): number | null {
  return p.lastInteractionAt ? daysBetween(p.lastInteractionAt, now) : null;
}

export function isEngaged(
  p: Pick<Person, "lastInteractionAt">,
  now: Date,
  engagedDays: number,
): boolean {
  const d = daysSinceTouch(p, now);
  return d !== null && d <= engagedDays;
}
