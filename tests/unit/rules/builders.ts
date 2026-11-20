import {
  DEFAULT_CRITERIA,
  DEFAULT_RULE_SETTINGS,
} from "@/domain/settings/defaults";
import type { Book } from "@/domain/rules/today";
import { toIsoDate } from "@/domain/time";
import type { Account, Criterion, Deal, Person, Stage } from "@/domain/types";

export const NOW = new Date("2026-11-20T12:00:00Z");
export const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
export const iso = (n: number) => toIsoDate(day(n));

export const STAGES: Stage[] = [
  {
    id: "lead",
    sortOrder: 1,
    probability: 10,
    typicalDays: 14,
    isWon: false,
    isLost: false,
  },
  {
    id: "discovery",
    sortOrder: 2,
    probability: 25,
    typicalDays: 21,
    isWon: false,
    isLost: false,
  },
  {
    id: "solution",
    sortOrder: 3,
    probability: 50,
    typicalDays: 21,
    isWon: false,
    isLost: false,
  },
  {
    id: "proposal",
    sortOrder: 4,
    probability: 70,
    typicalDays: 30,
    isWon: false,
    isLost: false,
  },
  {
    id: "negotiation",
    sortOrder: 5,
    probability: 85,
    typicalDays: 21,
    isWon: false,
    isLost: false,
  },
  {
    id: "won",
    sortOrder: 6,
    probability: 100,
    typicalDays: 0,
    isWon: true,
    isLost: false,
  },
  {
    id: "lost",
    sortOrder: 7,
    probability: 0,
    typicalDays: 0,
    isWon: false,
    isLost: true,
  },
];
export const stage = (id: string) => STAGES.find((s) => s.id === id)!;
export const CRITERIA: Criterion[] = DEFAULT_CRITERIA.map((c) => ({
  key: c.key,
  requiredLate: c.requiredLate,
}));
export const allQual = (status: "unknown" | "partial" | "confirmed") =>
  Object.fromEntries(CRITERIA.map((c) => [c.key, status]));

export const account = (o: Partial<Account> = {}): Account => ({
  id: "a1",
  name: "Acme",
  tier: "growth",
  relationship: "prospect",
  renewalDate: null,
  ...o,
});
export const person = (o: Partial<Person> = {}): Person => ({
  id: "p1",
  accountId: "a1",
  name: "Pat",
  role: "influencer",
  stance: "neutral",
  strength: 3,
  lastInteractionAt: day(-5),
  ...o,
});
/** A healthy, quiet deal: triggers no Today rule on its own. */
export const deal = (o: Partial<Deal> = {}): Deal => ({
  id: "d1",
  accountId: "a1",
  name: "Big deal",
  amount: 40_000,
  stageId: "discovery",
  stageEnteredAt: day(-5),
  closeDate: iso(60),
  nextStep: "Workshop",
  nextStepDate: iso(3),
  forecastCategory: "pipeline",
  compellingEvent: "Year-end budget",
  closeDatePushes: 0,
  stakeholders: [],
  qualification: allQual("partial"),
  ...o,
});

export const book = (o: Partial<Book> = {}): Book => ({
  now: NOW,
  settings: { ...DEFAULT_RULE_SETTINGS },
  stages: STAGES,
  criteria: CRITERIA,
  accounts: [account()],
  people: [],
  deals: [],
  signals: [],
  meetings: [],
  plans: [],
  pendingProposals: 0,
  states: [],
  adjustments: {},
  ...o,
});
