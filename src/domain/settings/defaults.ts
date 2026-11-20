import type { DecisionRole } from "../types";

/**
 * Default rule weights and thresholds (brief §5, docs/RULES.md). Seeded into
 * `rule_setting` per organisation under the same keys; admins can tune them.
 */
export const DEFAULT_RULE_SETTINGS = {
  "today.weight.nextStep": 30,
  "today.weight.stalled": 25,
  "today.weight.single": 25,
  "today.weight.criterion": 20,
  "today.weight.forecast": 20,
  "today.weight.reconnect": 15,
  "today.weight.signal": 15,
  "today.weight.renewal": 20,
  "today.weight.prepare": 30,
  "today.weight.proposals": 10,
  "today.topN": 7,
  "today.amountFactorMax": 15,
  "today.singleThreadAmount": 50_000,
  "today.engagedDays": 60,
  "today.closeWindowDays": 30,
  "today.signalDays": 7,
  "today.renewalWindowDays": 90,
  "today.planStaleDays": 60,
  "today.prepareHours": 24,
  "today.proposalCap": 40,
  /** Criteria marked required-late are checked from this stage sort order (3 = Solution / demo). */
  "today.lateStageOrder": 3,
  "teach.factor": 0.8,
  "teach.floor": 0.4,
} as const;

export type RuleSettingKey = keyof typeof DEFAULT_RULE_SETTINGS;
export type RuleSettings = Record<RuleSettingKey, number>;

/** Merge stored values over the defaults; unknown keys and non-finite values are ignored. */
export function resolveRuleSettings(
  stored: Iterable<{ key: string; value: number }>,
): RuleSettings {
  const out: RuleSettings = { ...DEFAULT_RULE_SETTINGS };
  for (const { key, value } of stored) {
    if (key in out && Number.isFinite(value) && value >= 0)
      out[key as RuleSettingKey] = value;
  }
  return out;
}

/** Contact cadence in days for key roles (brief §5.1). Roles without a cadence are not chased. */
export const DEFAULT_CADENCES: Partial<Record<DecisionRole, number>> = {
  champion: 14,
  economic_buyer: 30,
  decision_maker: 30,
};

export const REQUIRED_ROLES: DecisionRole[] = [
  "economic_buyer",
  "decision_maker",
  "champion",
  "technical_evaluator",
  "procurement",
];

export const DEFAULT_STAGES = [
  {
    key: "lead",
    nameEn: "Lead / prospect",
    nameFr: "Lead / prospect",
    exitEn: "Contact engaged and fit confirmed",
    exitFr: "Contact engagé et adéquation confirmée",
    probability: 10,
    typicalDays: 14,
    isWon: false,
    isLost: false,
  },
  {
    key: "discovery",
    nameEn: "Discovery",
    nameFr: "Découverte",
    exitEn: "Qualified opportunity",
    exitFr: "Opportunité qualifiée",
    probability: 25,
    typicalDays: 21,
    isWon: false,
    isLost: false,
  },
  {
    key: "solution",
    nameEn: "Solution / demo",
    nameFr: "Solution / démo",
    exitEn: "Positive technical or business validation",
    exitFr: "Validation technique ou métier positive",
    probability: 50,
    typicalDays: 21,
    isWon: false,
    isLost: false,
  },
  {
    key: "proposal",
    nameEn: "Proposal / evaluation",
    nameFr: "Proposition / évaluation",
    exitEn: "Proposal accepted or under review",
    exitFr: "Proposition acceptée ou en revue",
    probability: 70,
    typicalDays: 30,
    isWon: false,
    isLost: false,
  },
  {
    key: "negotiation",
    nameEn: "Negotiation",
    nameFr: "Négociation",
    exitEn: "Terms agreed",
    exitFr: "Conditions convenues",
    probability: 85,
    typicalDays: 21,
    isWon: false,
    isLost: false,
  },
  {
    key: "won",
    nameEn: "Closed won",
    nameFr: "Gagnée",
    exitEn: "Contract signed, revenue recognised",
    exitFr: "Contrat signé, chiffre d’affaires reconnu",
    probability: 100,
    typicalDays: 0,
    isWon: true,
    isLost: false,
  },
  {
    key: "lost",
    nameEn: "Closed lost",
    nameFr: "Perdue",
    exitEn: "Loss reason captured",
    exitFr: "Motif de perte renseigné",
    probability: 0,
    typicalDays: 0,
    isWon: false,
    isLost: true,
  },
] as const;

export const DEFAULT_CRITERIA = [
  {
    key: "metrics",
    labelEn: "Metrics",
    labelFr: "Indicateurs",
    helpEn: "The measurable gain the customer expects.",
    helpFr: "Le gain mesurable attendu par le client.",
    requiredLate: false,
  },
  {
    key: "economic_buyer",
    labelEn: "Economic buyer",
    labelFr: "Décideur budgétaire",
    helpEn: "Who controls the budget and can say yes.",
    helpFr: "Qui contrôle le budget et peut dire oui.",
    requiredLate: true,
  },
  {
    key: "decision_criteria",
    labelEn: "Decision criteria",
    labelFr: "Critères de décision",
    helpEn: "How they will compare options.",
    helpFr: "Comment ils compareront les options.",
    requiredLate: false,
  },
  {
    key: "decision_process",
    labelEn: "Decision process",
    labelFr: "Processus de décision",
    helpEn: "The steps and dates to reach a decision.",
    helpFr: "Les étapes et dates jusqu’à la décision.",
    requiredLate: true,
  },
  {
    key: "paper_process",
    labelEn: "Paper process",
    labelFr: "Processus contractuel",
    helpEn: "Legal, procurement and signature steps.",
    helpFr: "Étapes juridiques, achats et signature.",
    requiredLate: false,
  },
  {
    key: "pain",
    labelEn: "Identified pain",
    labelFr: "Problème identifié",
    helpEn: "The business problem that makes them act.",
    helpFr: "Le problème métier qui les pousse à agir.",
    requiredLate: false,
  },
  {
    key: "champion",
    labelEn: "Champion",
    labelFr: "Champion",
    helpEn: "Someone inside who sells for you.",
    helpFr: "Quelqu’un en interne qui défend votre offre.",
    requiredLate: false,
  },
  {
    key: "competition",
    labelEn: "Competition",
    labelFr: "Concurrence",
    helpEn: "Other options they are considering, including doing nothing.",
    helpFr: "Les autres options envisagées, y compris ne rien faire.",
    requiredLate: false,
  },
] as const;
