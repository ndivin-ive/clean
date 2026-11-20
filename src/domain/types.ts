/**
 * Plain data the rules engine reads. Services load these from the database
 * (inside withTenant, so only rows the seller may see) and pass them in.
 * Dates are `Date` (instants) or ISO `YYYY-MM-DD` strings (calendar days).
 */
export type DecisionRole =
  | "economic_buyer"
  | "decision_maker"
  | "champion"
  | "influencer"
  | "technical_evaluator"
  | "user"
  | "procurement"
  | "blocker"
  | "unknown";
export type Stance = "supporter" | "neutral" | "sceptic" | "unknown";
export type ForecastCategory = "commit" | "best_case" | "pipeline" | "omitted";
export type QualificationStatus = "unknown" | "partial" | "confirmed";
export type IsoDate = string;

export interface Stage {
  id: string;
  sortOrder: number;
  probability: number;
  typicalDays: number;
  isWon: boolean;
  isLost: boolean;
}
export interface Criterion {
  key: string;
  requiredLate: boolean;
}
export interface Account {
  id: string;
  name: string;
  tier: "key" | "growth" | "maintain";
  relationship: "prospect" | "customer";
  renewalDate: IsoDate | null;
}
export interface Person {
  id: string;
  accountId: string;
  name: string;
  role: DecisionRole;
  stance: Stance;
  strength: number;
  lastInteractionAt: Date | null;
}
export interface Deal {
  id: string;
  accountId: string;
  name: string;
  amount: number;
  stageId: string;
  stageEnteredAt: Date;
  closeDate: IsoDate | null;
  nextStep: string | null;
  nextStepDate: IsoDate | null;
  forecastCategory: ForecastCategory | null;
  compellingEvent: string | null;
  closeDatePushes: number;
  stakeholders: { personId: string; role: DecisionRole }[];
  qualification: Record<string, QualificationStatus>;
}
export interface Signal {
  id: string;
  accountId: string;
  type: string;
  title: string;
  detectedAt: Date;
  relevance: number | null;
}
export interface Meeting {
  id: string;
  accountId: string;
  dealId: string | null;
  title: string;
  startsAt: Date;
  briefViewed: boolean;
}
export interface AccountPlan {
  accountId: string;
  lastReviewedAt: Date | null;
  openRisks: number;
}
export interface ActionState {
  ruleKey: string;
  subjectKey: string;
  fingerprint: string;
  status: "open" | "done" | "snoozed" | "dismissed";
  snoozedUntil: Date | null;
}
