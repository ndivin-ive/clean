/**
 * Sales profiles: the configuration an organisation starts from (stages,
 * qualification criteria, contact cadences, rule tweaks, product catalogue for
 * the account plan, account segments). Chosen at onboarding, stored on the
 * organisation, editable afterwards in Settings.
 *
 * `industrial_equipment` was designed from the public description of an
 * industrial valve manufacturer's sales motion (see docs/USE_CASE_MECA_INOX.md):
 * series products sold through stockist distributors, OEMs and end users, from
 * maintenance (MRO) orders to large new-build projects, with heavy technical
 * and regulatory qualification.
 */
import {
  DEFAULT_CADENCES,
  DEFAULT_CRITERIA,
  DEFAULT_STAGES,
  type RuleSettings,
} from "./settings/defaults";
import type { DecisionRole } from "./types";

export interface StageDef {
  key: string;
  nameEn: string;
  nameFr: string;
  exitEn: string;
  exitFr: string;
  probability: number;
  typicalDays: number;
  isWon: boolean;
  isLost: boolean;
}
export interface CriterionDef {
  key: string;
  labelEn: string;
  labelFr: string;
  helpEn: string;
  helpFr: string;
  requiredLate: boolean;
}
export interface CatalogueItem {
  key: string;
  nameEn: string;
  nameFr: string;
}
export interface SalesProfile {
  key: SalesProfileKey;
  nameEn: string;
  nameFr: string;
  stages: readonly StageDef[];
  criteria: readonly CriterionDef[];
  cadences: Partial<Record<DecisionRole, number>>;
  ruleOverrides: Partial<RuleSettings>;
  products: readonly CatalogueItem[];
  segments: readonly CatalogueItem[];
}

export const SALES_PROFILE_KEYS = ["generic", "industrial_equipment"] as const;
export type SalesProfileKey = (typeof SALES_PROFILE_KEYS)[number];

const GENERIC: SalesProfile = {
  key: "generic",
  nameEn: "B2B (general)",
  nameFr: "B2B (général)",
  stages: DEFAULT_STAGES,
  criteria: DEFAULT_CRITERIA,
  cadences: DEFAULT_CADENCES,
  ruleOverrides: {},
  products: [
    { key: "platform", nameEn: "Platform", nameFr: "Plateforme" },
    { key: "integration", nameEn: "Integration", nameFr: "Intégration" },
    { key: "managed", nameEn: "Managed service", nameFr: "Service managé" },
  ],
  segments: [
    { key: "enterprise", nameEn: "Enterprise", nameFr: "Grands comptes" },
    { key: "mid_market", nameEn: "Mid-market", nameFr: "ETI" },
    { key: "smb", nameEn: "SMB", nameFr: "PME" },
  ],
};

const INDUSTRIAL_EQUIPMENT: SalesProfile = {
  key: "industrial_equipment",
  nameEn: "Industrial equipment manufacturer",
  nameFr: "Fabricant d’équipements industriels",
  stages: [
    {
      key: "detection",
      nameEn: "Detection",
      nameFr: "Détection",
      exitEn: "Need or project identified (new build, shutdown, tender)",
      exitFr:
        "Besoin ou projet identifié (travaux neufs, arrêt technique, appel d’offres)",
      probability: 10,
      typicalDays: 21,
      isWon: false,
      isLost: false,
    },
    {
      key: "technical",
      nameEn: "Technical qualification",
      nameFr: "Qualification technique",
      exitEn:
        "Specification received: fluid, size, pressure, temperature, standards",
      exitFr: "Spécification reçue : fluide, DN, pression, température, normes",
      probability: 25,
      typicalDays: 21,
      isWon: false,
      isLost: false,
    },
    {
      key: "quoting",
      nameEn: "Engineering and quoting",
      nameFr: "Étude et chiffrage",
      exitEn: "Technical solution validated by engineering; price built",
      exitFr:
        "Solution technique validée par le bureau d’études ; prix construit",
      probability: 40,
      typicalDays: 14,
      isWon: false,
      isLost: false,
    },
    {
      key: "offer",
      nameEn: "Offer submitted",
      nameFr: "Offre remise",
      exitEn: "Technical and commercial offer under review by the customer",
      exitFr: "Offre technique et commerciale en revue chez le client",
      probability: 60,
      typicalDays: 30,
      isWon: false,
      isLost: false,
    },
    {
      key: "negotiation",
      nameEn: "Negotiation and vendor listing",
      nameFr: "Négociation et référencement",
      exitEn: "Terms agreed and supplier approved (vendor list, audit)",
      exitFr:
        "Conditions convenues et fournisseur référencé (liste fournisseurs, audit)",
      probability: 80,
      typicalDays: 45,
      isWon: false,
      isLost: false,
    },
    {
      key: "won",
      nameEn: "Order won",
      nameFr: "Commande gagnée",
      exitEn: "Purchase order received",
      exitFr: "Commande reçue",
      probability: 100,
      typicalDays: 0,
      isWon: true,
      isLost: false,
    },
    {
      key: "lost",
      nameEn: "Lost",
      nameFr: "Perdue",
      exitEn: "Loss reason captured",
      exitFr: "Motif de perte renseigné",
      probability: 0,
      typicalDays: 0,
      isWon: false,
      isLost: true,
    },
  ],
  criteria: [
    {
      key: "specification",
      labelEn: "Specification",
      labelFr: "Spécification technique",
      helpEn:
        "Fluid, size (DN), pressure, temperature, quantities and connection type are known.",
      helpFr:
        "Fluide, DN, pression, température, quantités et raccordement sont connus.",
      requiredLate: false,
    },
    {
      key: "standards",
      labelEn: "Required standards and certifications",
      labelFr: "Normes et certifications exigées",
      helpEn:
        "Which approvals the valve must carry (pressure equipment, ATEX, fire-safe, food contact, cryogenic, PFAS-free…).",
      helpFr:
        "Les homologations exigées pour la vanne (équipements sous pression, ATEX, sécurité feu, contact alimentaire, cryogénie, sans PFAS…).",
      requiredLate: true,
    },
    {
      key: "economic_buyer",
      labelEn: "Budget owner",
      labelFr: "Porteur du budget",
      helpEn:
        "Who owns the CAPEX or maintenance budget and approves the order.",
      helpFr:
        "Qui porte le budget d’investissement ou de maintenance et valide la commande.",
      requiredLate: false,
    },
    {
      key: "decision_process",
      labelEn: "Decision process and order date",
      labelFr: "Processus de décision et date de commande",
      helpEn:
        "Investment committee, tender calendar, order and delivery dates.",
      helpFr:
        "Comité d’investissement, calendrier d’appel d’offres, dates de commande et de livraison.",
      requiredLate: false,
    },
    {
      key: "vendor_listing",
      labelEn: "Supplier approval",
      labelFr: "Référencement fournisseur",
      helpEn:
        "Are we on the approved vendor list, or what audit and documents are needed to get there.",
      helpFr:
        "Sommes-nous sur la liste des fournisseurs agréés, ou quels audit et documents faut-il pour y entrer.",
      requiredLate: true,
    },
    {
      key: "prescriber",
      labelEn: "Specifier",
      labelFr: "Prescripteur",
      helpEn:
        "The engineering firm, OEM or end-user engineering team that writes the specification.",
      helpFr:
        "L’ingénierie, l’équipementier ou le bureau d’études client qui rédige la spécification.",
      requiredLate: false,
    },
    {
      key: "pain",
      labelEn: "Operational problem",
      labelFr: "Problème opérationnel",
      helpEn:
        "Leaks, downtime, maintenance cost, regulation (e.g. PFAS) or lead time that makes them act.",
      helpFr:
        "Fuites, arrêts, coût de maintenance, réglementation (ex. PFAS) ou délai qui les pousse à agir.",
      requiredLate: false,
    },
    {
      key: "competition",
      labelEn: "Competition",
      labelFr: "Concurrence",
      helpEn: "Other valve makers in the bid, the incumbent, or doing nothing.",
      helpFr:
        "Les autres robinetiers consultés, le fournisseur en place, ou ne rien faire.",
      requiredLate: false,
    },
  ],
  // Longer industrial cycles: champions every 3 weeks, budget owners and decision makers every 6.
  cadences: { champion: 21, economic_buyer: 45, decision_maker: 45 },
  ruleOverrides: {
    "today.singleThreadAmount": 40_000,
    "today.closeWindowDays": 30,
  },
  products: [
    {
      key: "valves_3p",
      nameEn: "3-piece ball valves",
      nameFr: "Vannes 3 pièces",
    },
    {
      key: "valves_2p",
      nameEn: "2-piece flanged valves",
      nameFr: "Vannes 2 pièces à brides",
    },
    {
      key: "actuation",
      nameEn: "Actuation and accessories",
      nameFr: "Motorisation et accessoires",
    },
    {
      key: "checks",
      nameEn: "Check valves and sight glasses",
      nameFr: "Clapets et viseurs",
    },
    { key: "special", nameEn: "Special designs", nameFr: "Designs spéciaux" },
    {
      key: "large_custom",
      nameEn: "Large custom valves",
      nameFr: "Vannes sur mesure grandes dimensions",
    },
  ],
  segments: [
    { key: "chemicals", nameEn: "Chemicals", nameFr: "Chimie" },
    { key: "food", nameEn: "Food and beverage", nameFr: "Agroalimentaire" },
    {
      key: "pharma",
      nameEn: "Pharma and biotech",
      nameFr: "Pharma et biotech",
    },
    {
      key: "industrial_gases",
      nameEn: "Industrial gases",
      nameFr: "Gaz industriels",
    },
    { key: "lng", nameEn: "LNG and cryogenics", nameFr: "GNL et cryogénie" },
    { key: "hydrogen", nameEn: "Hydrogen", nameFr: "Hydrogène" },
    { key: "distribution", nameEn: "Distribution", nameFr: "Distribution" },
    {
      key: "general_industry",
      nameEn: "General industry",
      nameFr: "Applications industrielles",
    },
  ],
};

export const SALES_PROFILES: Record<SalesProfileKey, SalesProfile> = {
  generic: GENERIC,
  industrial_equipment: INDUSTRIAL_EQUIPMENT,
};

export function salesProfile(key: string | null | undefined): SalesProfile {
  return (SALES_PROFILE_KEYS as readonly string[]).includes(key ?? "")
    ? SALES_PROFILES[key as SalesProfileKey]
    : GENERIC;
}
