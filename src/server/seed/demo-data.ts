/**
 * The demo book (all companies and people are invented). Days are relative to
 * the seeding time: negative = in the past. The story is meant to light up
 * every Today rule: a single-threaded deal, stalled deals, a quiet champion, a
 * renewal with a stale plan, a CEO leaving, a meeting tomorrow without a brief.
 */
import type { Brand } from "@/domain/branding";
import type { SalesProfileKey } from "@/domain/profiles";
import type {
  DecisionRole,
  ForecastCategory,
  QualificationStatus,
  Stance,
} from "@/domain/types";

export const DEMO_ORG = {
  id: "0d3e0000-0000-4000-8000-00000000c1ea",
  name: "Lumen Data (demo)",
};
export const DEMO_DOMAIN = "lumendata.example";

export const DEMO_USERS = {
  admin: {
    name: "Hugo Bernard",
    email: `hugo.bernard@${DEMO_DOMAIN}`,
    roles: ["admin"] as const,
  },
  manager: {
    name: "Sarah Okafor",
    email: `sarah.okafor@${DEMO_DOMAIN}`,
    roles: ["manager", "seller"] as const,
  },
  seller: {
    name: "Camille Martin",
    email: `camille.martin@${DEMO_DOMAIN}`,
    roles: ["seller"] as const,
  },
  peer: {
    name: "Thomas Leroy",
    email: `thomas.leroy@${DEMO_DOMAIN}`,
    roles: ["seller"] as const,
  },
};

type Tier = "key" | "growth" | "maintain";
export interface DemoAccount {
  key: string;
  name: string;
  tier: Tier;
  relationship: "prospect" | "customer";
  country: string;
  industry: string;
  segment: string;
  domain: string;
  annualValue: number | null;
  renewalInDays: number | null;
}
const A = (
  key: string,
  name: string,
  tier: Tier,
  relationship: "prospect" | "customer",
  country: string,
  industry: string,
  segment: string,
  annualValue: number | null = null,
  renewalInDays: number | null = null,
): DemoAccount => ({
  key,
  name,
  tier,
  relationship,
  country,
  industry,
  segment,
  domain: `${name.split(" ")[0]!.toLowerCase()}.example`,
  annualValue,
  renewalInDays,
});

export const DEMO_ACCOUNTS: DemoAccount[] = [
  A(
    "a1",
    "Arvalis Logistics",
    "key",
    "customer",
    "FR",
    "Logistics",
    "Enterprise",
    420_000,
    70,
  ),
  A("a2", "Eskerfield Bank", "key", "prospect", "DE", "Banking", "Enterprise"),
  A(
    "a3",
    "Brightwater Health",
    "growth",
    "customer",
    "GB",
    "Healthcare",
    "Mid-market",
    120_000,
    200,
  ),
  A("a4", "Calder Energy", "growth", "prospect", "NO", "Energy", "Enterprise"),
  A(
    "a5",
    "Delmont Retail",
    "maintain",
    "customer",
    "FR",
    "Retail",
    "Mid-market",
    60_000,
    40,
  ),
  A(
    "a6",
    "Fennick Telecom",
    "growth",
    "customer",
    "NL",
    "Telecom",
    "Enterprise",
    210_000,
    150,
  ),
  A(
    "a7",
    "Granvale Foods",
    "maintain",
    "customer",
    "FR",
    "Food & beverage",
    "Mid-market",
    45_000,
    260,
  ),
  A(
    "a8",
    "Halden Insurance",
    "growth",
    "prospect",
    "BE",
    "Insurance",
    "Mid-market",
  ),
  A(
    "a9",
    "Ivory Lane Media",
    "maintain",
    "customer",
    "IE",
    "Media",
    "SMB",
    48_000,
    310,
  ),
  A(
    "a10",
    "Juniper Rail",
    "growth",
    "prospect",
    "ES",
    "Transport",
    "Enterprise",
  ),
];

export interface DemoPerson {
  key: string;
  account: string;
  name: string;
  title: string;
  department: string;
  role: DecisionRole;
  stance: Stance;
  strength: number;
  lastDaysAgo: number | null;
}
const P = (
  key: string,
  account: string,
  name: string,
  title: string,
  department: string,
  role: DecisionRole,
  stance: Stance,
  strength: number,
  lastDaysAgo: number | null,
): DemoPerson => ({
  key,
  account,
  name,
  title,
  department,
  role,
  stance,
  strength,
  lastDaysAgo,
});

export const DEMO_PEOPLE: DemoPerson[] = [
  P(
    "p1",
    "a1",
    "Nathalie Fournier",
    "Chief Operating Officer",
    "Operations",
    "economic_buyer",
    "supporter",
    4,
    35,
  ),
  P(
    "p2",
    "a1",
    "Karim Benali",
    "Head of IT",
    "IT",
    "champion",
    "supporter",
    5,
    26,
  ),
  P(
    "p3",
    "a1",
    "Lucie Moreau",
    "Procurement Manager",
    "Procurement",
    "procurement",
    "neutral",
    2,
    90,
  ),
  P(
    "p4",
    "a1",
    "Paul Girard",
    "Warehouse Operations Director",
    "Operations",
    "user",
    "supporter",
    3,
    4,
  ),
  P(
    "p26",
    "a1",
    "Élodie Laurent",
    "Chief Financial Officer",
    "Finance",
    "decision_maker",
    "neutral",
    2,
    75,
  ),
  P(
    "p27",
    "a1",
    "Antoine Roux",
    "Transport Director",
    "Transport",
    "influencer",
    "neutral",
    2,
    50,
  ),
  P(
    "p5",
    "a2",
    "Anja Weber",
    "Head of Data",
    "Data",
    "champion",
    "supporter",
    4,
    9,
  ),
  P(
    "p6",
    "a2",
    "Lukas Brandt",
    "Procurement Lead",
    "Procurement",
    "procurement",
    "neutral",
    2,
    40,
  ),
  P(
    "p7",
    "a2",
    "Henrik Vogel",
    "Chief Risk Officer",
    "Risk",
    "economic_buyer",
    "unknown",
    1,
    null,
  ),
  P(
    "p8",
    "a2",
    "Mia Schulz",
    "Enterprise Architect",
    "IT",
    "technical_evaluator",
    "sceptic",
    2,
    20,
  ),
  P(
    "p28",
    "a2",
    "Jonas Keller",
    "Head of Model Risk",
    "Risk",
    "influencer",
    "unknown",
    1,
    null,
  ),
  P(
    "p29",
    "a2",
    "Sabine Krüger",
    "Risk Analyst",
    "Risk",
    "user",
    "neutral",
    2,
    20,
  ),
  P(
    "p9",
    "a3",
    "Olivia Grant",
    "Director of Digital",
    "Digital",
    "champion",
    "supporter",
    3,
    18,
  ),
  P(
    "p10",
    "a3",
    "James Holt",
    "Chief Financial Officer",
    "Finance",
    "economic_buyer",
    "unknown",
    1,
    null,
  ),
  P(
    "p25",
    "a3",
    "Rahul Mehta",
    "Clinical Systems Lead",
    "IT",
    "technical_evaluator",
    "unknown",
    1,
    null,
  ),
  P(
    "p30",
    "a3",
    "Emma Clarke",
    "Head of Nursing Operations",
    "Clinical",
    "user",
    "supporter",
    3,
    60,
  ),
  P(
    "p11",
    "a4",
    "Erik Solberg",
    "Chief Financial Officer",
    "Finance",
    "economic_buyer",
    "neutral",
    2,
    50,
  ),
  P(
    "p12",
    "a4",
    "Ingrid Dahl",
    "Head of Trading Operations",
    "Trading",
    "champion",
    "supporter",
    3,
    6,
  ),
  P(
    "p31",
    "a4",
    "Lars Nilsen",
    "IT Architect",
    "IT",
    "technical_evaluator",
    "neutral",
    3,
    15,
  ),
  P(
    "p38",
    "a4",
    "Kari Berg",
    "Procurement Manager",
    "Procurement",
    "procurement",
    "unknown",
    1,
    null,
  ),
  P(
    "p13",
    "a5",
    "Claire Rousseau",
    "Store Operations Director",
    "Operations",
    "decision_maker",
    "supporter",
    4,
    15,
  ),
  P(
    "p14",
    "a5",
    "Marc Lefebvre",
    "IT Manager",
    "IT",
    "technical_evaluator",
    "neutral",
    3,
    30,
  ),
  P(
    "p32",
    "a5",
    "Julie Mercier",
    "Purchasing Officer",
    "Procurement",
    "procurement",
    "neutral",
    2,
    15,
  ),
  P(
    "p15",
    "a6",
    "Daan de Vries",
    "VP Network",
    "Network",
    "decision_maker",
    "supporter",
    4,
    8,
  ),
  P(
    "p16",
    "a6",
    "Sanne Bakker",
    "Procurement Officer",
    "Procurement",
    "procurement",
    "neutral",
    2,
    25,
  ),
  P(
    "p17",
    "a6",
    "Pieter Jansen",
    "Network Architect",
    "Network",
    "technical_evaluator",
    "supporter",
    3,
    8,
  ),
  P(
    "p18",
    "a6",
    "Femke Visser",
    "Head of Finance",
    "Finance",
    "economic_buyer",
    "neutral",
    2,
    70,
  ),
  P(
    "p33",
    "a6",
    "Ruben Smit",
    "Legal Counsel",
    "Legal",
    "influencer",
    "neutral",
    2,
    8,
  ),
  P(
    "p19",
    "a7",
    "Hélène Marchand",
    "Supply Chain Director",
    "Supply chain",
    "decision_maker",
    "neutral",
    3,
    60,
  ),
  P(
    "p34",
    "a7",
    "Thierry Blanc",
    "Quality Manager",
    "Quality",
    "user",
    "supporter",
    3,
    60,
  ),
  P(
    "p39",
    "a7",
    "Nadia Haddad",
    "Head of Procurement",
    "Procurement",
    "procurement",
    "neutral",
    2,
    120,
  ),
  P(
    "p20",
    "a8",
    "Sophie Lambert",
    "Chief Executive Officer",
    "Executive",
    "economic_buyer",
    "supporter",
    4,
    45,
  ),
  P(
    "p21",
    "a8",
    "Thomas Wouters",
    "Head of Claims",
    "Claims",
    "champion",
    "supporter",
    3,
    41,
  ),
  P(
    "p35",
    "a8",
    "Inge Peeters",
    "IT Director",
    "IT",
    "technical_evaluator",
    "unknown",
    1,
    null,
  ),
  P(
    "p24",
    "a9",
    "Aoife Byrne",
    "Head of Audience",
    "Audience",
    "decision_maker",
    "supporter",
    3,
    28,
  ),
  P(
    "p36",
    "a9",
    "Ciarán Walsh",
    "Data Engineer",
    "Data",
    "technical_evaluator",
    "supporter",
    3,
    28,
  ),
  P(
    "p40",
    "a9",
    "Seán Murphy",
    "Chief Financial Officer",
    "Finance",
    "economic_buyer",
    "neutral",
    2,
    200,
  ),
  P(
    "p22",
    "a10",
    "Javier Ortega",
    "Head of Passenger Experience",
    "Customer experience",
    "champion",
    "neutral",
    2,
    20,
  ),
  P(
    "p23",
    "a10",
    "Carmen Ruiz",
    "Chief Information Officer",
    "IT",
    "economic_buyer",
    "unknown",
    1,
    null,
  ),
  P(
    "p37",
    "a10",
    "Lucía Navarro",
    "Operations Analyst",
    "Operations",
    "user",
    "neutral",
    2,
    20,
  ),
];

/** Qualification in criteria order: metrics, economic_buyer, decision_criteria, decision_process, paper_process, pain, champion, competition. u/p/c. */
type Q = string;
export const QUAL_ORDER = [
  "metrics",
  "economic_buyer",
  "decision_criteria",
  "decision_process",
  "paper_process",
  "pain",
  "champion",
  "competition",
] as const;
export const qualOf = (
  q: Q,
  keys: readonly string[] = QUAL_ORDER,
): Record<string, QualificationStatus> =>
  Object.fromEntries(
    keys.map((k, i) => [
      k,
      ({ u: "unknown", p: "partial", c: "confirmed" } as const)[
        (q[i] ?? "u") as "u" | "p" | "c"
      ],
    ]),
  );

export interface DemoDeal {
  key: string;
  account: string;
  name: string;
  amount: number;
  /** Stage key from the dataset's sales profile (src/domain/profiles.ts). */
  stage: string;
  lostFrom?: string;
  closeInDays: number;
  daysInStage: number;
  nextStep: string | null;
  nextStepInDays: number | null;
  forecast: ForecastCategory | null;
  compellingEvent: string | null;
  stakeholders: [string, DecisionRole][];
  qual: Q;
  pushes: number;
}
export const DEMO_DEALS: DemoDeal[] = [
  {
    key: "d1",
    account: "a1",
    name: "Warehouse analytics expansion",
    amount: 180_000,
    stage: "proposal",
    closeInDays: 40,
    daysInStage: 12,
    nextStep: "Send the revised proposal to Nathalie",
    nextStepInDays: -2,
    forecast: "best_case",
    compellingEvent: "Peak season starts in March",
    stakeholders: [
      ["p1", "economic_buyer"],
      ["p2", "champion"],
      ["p4", "user"],
    ],
    qual: "cpcpuccp",
    pushes: 0,
  },
  {
    key: "d2",
    account: "a2",
    name: "Risk data lake",
    amount: 410_000,
    stage: "discovery",
    closeInDays: 120,
    daysInStage: 36,
    nextStep: "Discovery workshop with the risk team",
    nextStepInDays: 1,
    forecast: "pipeline",
    compellingEvent: "Supervisor findings due in Q2",
    stakeholders: [
      ["p5", "champion"],
      ["p8", "technical_evaluator"],
    ],
    qual: "uuuuuppu",
    pushes: 0,
  },
  {
    key: "d3",
    account: "a3",
    name: "Patient flow dashboards",
    amount: 95_000,
    stage: "proposal",
    closeInDays: 21,
    daysInStage: 10,
    nextStep: "Proposal walkthrough",
    nextStepInDays: 4,
    forecast: null,
    compellingEvent: "Board wants weekly bed-occupancy reporting",
    stakeholders: [["p9", "champion"]],
    qual: "pupuucpu",
    pushes: 1,
  },
  {
    key: "d4",
    account: "a4",
    name: "Trading data hub",
    amount: 320_000,
    stage: "solution",
    closeInDays: 55,
    daysInStage: 9,
    nextStep: "Executive briefing with the CFO",
    nextStepInDays: 6,
    forecast: "best_case",
    compellingEvent: "Merger needs a single data model",
    stakeholders: [
      ["p11", "economic_buyer"],
      ["p12", "champion"],
      ["p31", "technical_evaluator"],
    ],
    qual: "ppppuccp",
    pushes: 0,
  },
  {
    key: "d5",
    account: "a5",
    name: "Store data renewal",
    amount: 60_000,
    stage: "negotiation",
    closeInDays: 12,
    daysInStage: 5,
    nextStep: "Agree the final discount",
    nextStepInDays: 1,
    forecast: "commit",
    compellingEvent: "Contract ends 31 January",
    stakeholders: [
      ["p13", "decision_maker"],
      ["p14", "technical_evaluator"],
      ["p32", "procurement"],
    ],
    qual: "ccccpccc",
    pushes: 0,
  },
  {
    key: "d6",
    account: "a6",
    name: "Network capacity analytics",
    amount: 260_000,
    stage: "negotiation",
    closeInDays: 9,
    daysInStage: 3,
    nextStep: "Legal review call",
    nextStepInDays: 2,
    forecast: "commit",
    compellingEvent: "Budget must be committed before year end",
    stakeholders: [
      ["p15", "decision_maker"],
      ["p16", "procurement"],
      ["p17", "technical_evaluator"],
      ["p18", "economic_buyer"],
    ],
    qual: "ccccpccc",
    pushes: 0,
  },
  {
    key: "d7",
    account: "a8",
    name: "Claims data modernisation",
    amount: 240_000,
    stage: "discovery",
    closeInDays: 75,
    daysInStage: 41,
    nextStep: null,
    nextStepInDays: null,
    forecast: "pipeline",
    compellingEvent: null,
    stakeholders: [
      ["p20", "economic_buyer"],
      ["p21", "champion"],
    ],
    qual: "ppuuuppu",
    pushes: 2,
  },
  {
    key: "d8",
    account: "a10",
    name: "Passenger insights",
    amount: 130_000,
    stage: "lead",
    closeInDays: 100,
    daysInStage: 10,
    nextStep: "Qualification call",
    nextStepInDays: 3,
    forecast: "pipeline",
    compellingEvent: null,
    stakeholders: [["p22", "champion"]],
    qual: "uuuuupuu",
    pushes: 0,
  },
  {
    key: "d9",
    account: "a7",
    name: "Supply chain visibility",
    amount: 72_000,
    stage: "solution",
    closeInDays: 35,
    daysInStage: 25,
    nextStep: "Pilot results review",
    nextStepInDays: -5,
    forecast: "pipeline",
    compellingEvent: "Two recalls last year",
    stakeholders: [
      ["p19", "decision_maker"],
      ["p34", "user"],
    ],
    qual: "pupuucuu",
    pushes: 1,
  },
  {
    key: "d10",
    account: "a9",
    name: "Audience data refresh",
    amount: 48_000,
    stage: "won",
    closeInDays: -20,
    daysInStage: 20,
    nextStep: null,
    nextStepInDays: null,
    forecast: "commit",
    compellingEvent: null,
    stakeholders: [
      ["p24", "decision_maker"],
      ["p36", "technical_evaluator"],
    ],
    qual: "cccccccc",
    pushes: 0,
  },
  {
    key: "d11",
    account: "a3",
    name: "Lab results integration",
    amount: 54_000,
    stage: "lost",
    lostFrom: "solution",
    closeInDays: -30,
    daysInStage: 30,
    nextStep: null,
    nextStepInDays: null,
    forecast: "omitted",
    compellingEvent: null,
    stakeholders: [["p9", "champion"]],
    qual: "pupuupppp",
    pushes: 1,
  },
  {
    key: "d12",
    account: "a1",
    name: "Fleet telemetry pilot",
    amount: 35_000,
    stage: "lead",
    closeInDays: 90,
    daysInStage: 4,
    nextStep: "Scope call with Paul",
    nextStepInDays: 7,
    forecast: "pipeline",
    compellingEvent: null,
    stakeholders: [
      ["p4", "user"],
      ["p27", "influencer"],
    ],
    qual: "uuuuupuu",
    pushes: 0,
  },
];

export const DEMO_EVIDENCE: {
  deal: string;
  criterion: string;
  text: string;
}[] = [
  {
    deal: "d1",
    criterion: "metrics",
    text: "Cut daily reporting from 4 hours to 20 minutes (Karim, pilot review).",
  },
  {
    deal: "d1",
    criterion: "champion",
    text: "Karim presented our pilot results to the COO.",
  },
  {
    deal: "d3",
    criterion: "pain",
    text: "Board asked for weekly bed-occupancy reporting.",
  },
  {
    deal: "d5",
    criterion: "paper_process",
    text: "Purchase order through Julie once the discount is agreed.",
  },
];

export const DEMO_STEPS: {
  deal: string;
  title: string;
  owner: "seller" | "buyer";
  dueInDays: number;
  done: boolean;
}[] = [
  {
    deal: "d1",
    title: "Pilot results shared with the COO",
    owner: "seller",
    dueInDays: -20,
    done: true,
  },
  {
    deal: "d1",
    title: "Revised proposal sent",
    owner: "seller",
    dueInDays: -2,
    done: false,
  },
  {
    deal: "d1",
    title: "Security review with IT",
    owner: "buyer",
    dueInDays: 10,
    done: false,
  },
  {
    deal: "d1",
    title: "Procurement and legal",
    owner: "buyer",
    dueInDays: 25,
    done: false,
  },
  {
    deal: "d1",
    title: "Signature",
    owner: "buyer",
    dueInDays: 38,
    done: false,
  },
  {
    deal: "d3",
    title: "Proposal sent",
    owner: "seller",
    dueInDays: -6,
    done: true,
  },
  {
    deal: "d3",
    title: "Proposal walkthrough",
    owner: "seller",
    dueInDays: 4,
    done: false,
  },
  {
    deal: "d3",
    title: "Board approval",
    owner: "buyer",
    dueInDays: 18,
    done: false,
  },
  {
    deal: "d6",
    title: "Commercial terms agreed",
    owner: "seller",
    dueInDays: -5,
    done: true,
  },
  {
    deal: "d6",
    title: "Legal review",
    owner: "buyer",
    dueInDays: 2,
    done: false,
  },
  {
    deal: "d6",
    title: "Purchase order",
    owner: "buyer",
    dueInDays: 8,
    done: false,
  },
];

/** Notable past interactions; every person's last contact without one here gets a generated check-in. */
export const DEMO_INTERACTIONS: {
  account: string;
  deal: string | null;
  type: "meeting" | "call" | "email" | "note" | "event";
  daysAgo: number;
  people: string[];
  summary: string;
}[] = [
  {
    account: "a1",
    deal: "d1",
    type: "meeting",
    daysAgo: 12,
    people: ["p4"],
    summary:
      "Walked Paul through the warehouse dashboards; he wants mobile access for shift leads.",
  },
  {
    account: "a1",
    deal: "d1",
    type: "call",
    daysAgo: 26,
    people: ["p2"],
    summary: "Karim confirmed the pilot met the 20-minute reporting target.",
  },
  {
    account: "a1",
    deal: null,
    type: "meeting",
    daysAgo: 35,
    people: ["p1", "p2"],
    summary:
      "Quarterly review with Nathalie: renewal on track, wants a roadmap for transport.",
  },
  {
    account: "a1",
    deal: null,
    type: "event",
    daysAgo: 110,
    people: ["p1"],
    summary: "Met Nathalie at the logistics summit in Lyon.",
  },
  {
    account: "a1",
    deal: null,
    type: "meeting",
    daysAgo: 150,
    people: ["p1", "p2", "p3"],
    summary: "Annual contract review; procurement asked for usage reporting.",
  },
  {
    account: "a2",
    deal: "d2",
    type: "call",
    daysAgo: 9,
    people: ["p5"],
    summary: "Anja shared the supervisor's findings timeline; workshop agreed.",
  },
  {
    account: "a2",
    deal: "d2",
    type: "meeting",
    daysAgo: 20,
    people: ["p5", "p8", "p29"],
    summary:
      "First architecture session. Mia worried about integration with the risk engine.",
  },
  {
    account: "a2",
    deal: "d2",
    type: "email",
    daysAgo: 40,
    people: ["p6"],
    summary: "Lukas sent the supplier onboarding questionnaire.",
  },
  {
    account: "a2",
    deal: null,
    type: "event",
    daysAgo: 95,
    people: ["p5"],
    summary: "Met Anja at the banking data conference in Frankfurt.",
  },
  {
    account: "a3",
    deal: "d3",
    type: "meeting",
    daysAgo: 18,
    people: ["p9"],
    summary: "Olivia reviewed the proposal draft; asked for a phased go-live.",
  },
  {
    account: "a3",
    deal: "d11",
    type: "call",
    daysAgo: 45,
    people: ["p9"],
    summary:
      "Lab integration lost to the incumbent's bundle; keep the dashboards deal alive.",
  },
  {
    account: "a4",
    deal: "d4",
    type: "call",
    daysAgo: 6,
    people: ["p12"],
    summary: "Ingrid confirmed the CFO briefing slot.",
  },
  {
    account: "a4",
    deal: "d4",
    type: "meeting",
    daysAgo: 15,
    people: ["p12", "p31"],
    summary:
      "Solution demo for trading operations; Lars asked about the data model.",
  },
  {
    account: "a5",
    deal: "d5",
    type: "meeting",
    daysAgo: 15,
    people: ["p13", "p32"],
    summary: "Claire accepted the renewal scope; discount still open.",
  },
  {
    account: "a6",
    deal: "d6",
    type: "meeting",
    daysAgo: 8,
    people: ["p15", "p17", "p33"],
    summary: "Terms agreed with Daan; legal review next.",
  },
  {
    account: "a6",
    deal: null,
    type: "call",
    daysAgo: 150,
    people: ["p18"],
    summary: "Budget planning call with Femke.",
  },
  {
    account: "a7",
    deal: "d9",
    type: "meeting",
    daysAgo: 60,
    people: ["p19", "p34"],
    summary: "Pilot kicked off with Hélène's team.",
  },
  {
    account: "a8",
    deal: "d7",
    type: "meeting",
    daysAgo: 41,
    people: ["p21"],
    summary:
      "Thomas outlined the claims backlog; wants a business case before involving the CEO.",
  },
  {
    account: "a8",
    deal: "d7",
    type: "meeting",
    daysAgo: 45,
    people: ["p20", "p21"],
    summary: "Intro meeting with Sophie and Thomas.",
  },
  {
    account: "a9",
    deal: "d10",
    type: "meeting",
    daysAgo: 28,
    people: ["p24", "p36"],
    summary: "Contract signed with Aoife.",
  },
  {
    account: "a10",
    deal: "d8",
    type: "call",
    daysAgo: 20,
    people: ["p22", "p37"],
    summary: "Intro call with Javier; interested in passenger flow analytics.",
  },
  {
    account: "a1",
    deal: null,
    type: "email",
    daysAgo: 70,
    people: ["p27"],
    summary: "Antoine asked for a transport reporting example.",
  },
  {
    account: "a2",
    deal: null,
    type: "meeting",
    daysAgo: 130,
    people: ["p5"],
    summary: "First coffee with Anja about the supervisor's data findings.",
  },
  {
    account: "a3",
    deal: null,
    type: "meeting",
    daysAgo: 120,
    people: ["p9", "p30"],
    summary:
      "Adoption review of the bed-management dashboards with Olivia and Emma.",
  },
  {
    account: "a4",
    deal: "d4",
    type: "call",
    daysAgo: 80,
    people: ["p11"],
    summary:
      "Erik explained the merger timeline and budget freeze until January.",
  },
  {
    account: "a5",
    deal: null,
    type: "email",
    daysAgo: 100,
    people: ["p13"],
    summary:
      "Claire flagged the contract end date and asked for renewal options.",
  },
  {
    account: "a6",
    deal: "d6",
    type: "meeting",
    daysAgo: 55,
    people: ["p15", "p17"],
    summary: "Capacity forecasting proof of concept results presented to Daan.",
  },
  {
    account: "a6",
    deal: null,
    type: "event",
    daysAgo: 175,
    people: ["p15"],
    summary: "Met Daan at the telecom analytics forum in Amsterdam.",
  },
  {
    account: "a7",
    deal: null,
    type: "call",
    daysAgo: 160,
    people: ["p39"],
    summary: "Nadia shared the supplier review calendar.",
  },
  {
    account: "a8",
    deal: null,
    type: "email",
    daysAgo: 90,
    people: ["p21"],
    summary:
      "Thomas downloaded the claims analytics white paper and asked for a call.",
  },
  {
    account: "a9",
    deal: "d10",
    type: "meeting",
    daysAgo: 65,
    people: ["p24"],
    summary: "Audience data refresh scoped with Aoife.",
  },
  {
    account: "a10",
    deal: null,
    type: "event",
    daysAgo: 140,
    people: ["p22"],
    summary: "Javier attended our passenger analytics webinar.",
  },
  {
    account: "a1",
    deal: "d12",
    type: "call",
    daysAgo: 4,
    people: ["p4"],
    summary: "Paul asked about a fleet telemetry pilot for two depots.",
  },
];

/** Scheduled meetings (future interactions). `inHours` from seeding time. */
export const DEMO_MEETINGS: {
  account: string;
  deal: string | null;
  title: string;
  inHours: number;
  people: string[];
}[] = [
  {
    account: "a2",
    deal: "d2",
    title: "Discovery workshop · Eskerfield Bank",
    inHours: 20,
    people: ["p5", "p8"],
  },
  {
    account: "a6",
    deal: "d6",
    title: "Legal review call · Fennick Telecom",
    inHours: 50,
    people: ["p16", "p33"],
  },
  {
    account: "a1",
    deal: null,
    title: "Quarterly business review · Arvalis",
    inHours: 70,
    people: ["p1", "p2"],
  },
];

export const DEMO_SIGNALS: {
  account: string;
  person: string | null;
  type: "job_change" | "tender" | "news" | "hiring";
  title: string;
  daysAgo: number;
  relevance: number;
}[] = [
  {
    account: "a8",
    person: "p20",
    type: "job_change",
    title: "Sophie Lambert announced she is leaving Halden Insurance",
    daysAgo: 2,
    relevance: 5,
  },
  {
    account: "a2",
    person: null,
    type: "tender",
    title: "Eskerfield Bank published a tender for a regulatory data platform",
    daysAgo: 3,
    relevance: 4,
  },
  {
    account: "a4",
    person: null,
    type: "news",
    title: "Calder Energy completed its merger with Nordvik Power",
    daysAgo: 5,
    relevance: 3,
  },
  {
    account: "a6",
    person: null,
    type: "news",
    title: "Fennick Telecom won a regional 5G licence",
    daysAgo: 12,
    relevance: 3,
  },
  {
    account: "a3",
    person: null,
    type: "hiring",
    title: "Brightwater Health is hiring a Chief Data Officer",
    daysAgo: 20,
    relevance: 2,
  },
];

export const DEMO_PLANS: {
  account: string;
  reviewedDaysAgo: number;
  objectives: string;
  ourGoals: string;
  whitespace: Record<string, Record<string, string>>;
  risks: string[];
  value: { daysAgo: number; text: string }[];
  nextMoves: string;
}[] = [
  {
    account: "a1",
    reviewedDaysAgo: 80,
    objectives:
      "Same-day visibility of every warehouse by peak season; cut reporting effort by 80 %.",
    ourGoals: "Renew at €420k and expand into transport (+€180k).",
    whitespace: {
      Warehousing: {
        platform: "owned",
        integration: "owned",
        managed: "in_progress",
      },
      Transport: {
        platform: "open",
        integration: "open",
        managed: "not_relevant",
      },
      Finance: {
        platform: "open",
        integration: "in_progress",
        managed: "open",
      },
    },
    risks: ["Procurement contact not met for 3 months."],
    value: [
      { daysAgo: 150, text: "Warehouse reporting live in 6 sites" },
      { daysAgo: 60, text: "Daily report time cut from 4 h to 20 min" },
    ],
    nextMoves: "QBR with Nathalie; transport discovery with Paul.",
  },
  {
    account: "a2",
    reviewedDaysAgo: 20,
    objectives:
      "Answer the supervisor's findings with one trusted risk data source by Q2.",
    ourGoals: "Land the risk data lake (€410k) as a first project.",
    whitespace: {
      Risk: {
        platform: "in_progress",
        integration: "in_progress",
        managed: "open",
      },
      Finance: { platform: "open", integration: "open", managed: "open" },
      Retail: {
        platform: "not_relevant",
        integration: "open",
        managed: "not_relevant",
      },
    },
    risks: [
      "Economic buyer (CRO) not met yet.",
      "Architect sceptical about risk-engine integration.",
    ],
    value: [],
    nextMoves: "Workshop tomorrow; ask Anja for an introduction to the CRO.",
  },
];

/** Deal events in the last week (for "changes since last week"). */
export const DEMO_RECENT_EVENTS: {
  deal: string;
  kind: "forecast" | "amount";
  from: string;
  to: string;
  daysAgo: number;
}[] = [
  { deal: "d5", kind: "forecast", from: "best_case", to: "commit", daysAgo: 3 },
  { deal: "d6", kind: "amount", from: "240000", to: "260000", daysAgo: 2 },
];

/* ── datasets ──────────────────────────────────────────────────────────── */
export interface DemoUser {
  name: string;
  email: string;
  roles: readonly ("seller" | "manager" | "admin" | "specialist")[];
}
export interface DemoDataset {
  org: {
    id: string;
    name: string;
    defaultLanguage: "en" | "fr";
    salesProfile: SalesProfileKey;
    /** Optional branding (D-058). */
    brand?: Brand;
  };
  /** Email domain of the demo users (used to clean them up). */
  domain: string;
  users: {
    admin: DemoUser;
    manager: DemoUser;
    seller: DemoUser;
    peer: DemoUser;
  };
  accounts: DemoAccount[];
  people: DemoPerson[];
  deals: DemoDeal[];
  evidence: typeof DEMO_EVIDENCE;
  steps: typeof DEMO_STEPS;
  interactions: typeof DEMO_INTERACTIONS;
  meetings: typeof DEMO_MEETINGS;
  signals: {
    account: string;
    person: string | null;
    type:
      | "job_change"
      | "tender"
      | "news"
      | "hiring"
      | "funding"
      | "product_launch"
      | "custom";
    title: string;
    daysAgo: number;
    relevance: number;
  }[];
  plans: typeof DEMO_PLANS;
  recentEvents: typeof DEMO_RECENT_EVENTS;
}

/** The generic demo ("Lumen Data"), B2B profile, English. */
export const LUMEN_DEMO: DemoDataset = {
  org: { ...DEMO_ORG, defaultLanguage: "en", salesProfile: "generic" },
  domain: DEMO_DOMAIN,
  users: DEMO_USERS,
  accounts: DEMO_ACCOUNTS,
  people: DEMO_PEOPLE,
  deals: DEMO_DEALS,
  evidence: DEMO_EVIDENCE,
  steps: DEMO_STEPS,
  interactions: DEMO_INTERACTIONS,
  meetings: DEMO_MEETINGS,
  signals: DEMO_SIGNALS,
  plans: DEMO_PLANS,
  recentEvents: DEMO_RECENT_EVENTS,
};
