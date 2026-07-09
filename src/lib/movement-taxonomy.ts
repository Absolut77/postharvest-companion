/**
 * Taxonomie officielle du Log 2026 — reflète 1:1 la nomenclature réelle observée dans le CSV.
 * Toute nouvelle valeur ajoutée ici doit correspondre à un cas d'usage documenté.
 */

// ---------------- OUT ----------------

export type OutCategory = "facility" | "packaging" | "sampling" | "rework" | "destruction";

export const OUT_CATEGORIES: ReadonlyArray<{
  id: OutCategory;
  label: string;
  reason: string; // valeur écrite dans Comment #1
  temp: boolean;  // "en attente de retour" (compte dans l'inventaire temporaire)
  hint: string;
}> = [
  { id: "facility",    label: "Out of Facility",   reason: "Out of Facility",     temp: false, hint: "sortie définitive" },
  { id: "packaging",   label: "Vers Packaging",    reason: "Out For Packaging",   temp: true,  hint: "retour attendu" },
  { id: "sampling",    label: "Vers Sampling",     reason: "Out for Sampling",    temp: true,  hint: "sampling interne" },
  { id: "rework",      label: "Vers Rework",       reason: "Out for Rework",      temp: true,  hint: "retour attendu" },
  { id: "destruction", label: "Destruction",       reason: "Out For Destruction", temp: false, hint: "définitif" },
];

export type FacilityPurpose = "b2b_sale" | "messager" | "b2b_sample" | "lab" | "educational" | "other";

export const FACILITY_PURPOSES: ReadonlyArray<{
  id: FacilityPurpose;
  label: string;
  comment2: string;
  defaultFormat: string;
  needsProvince: boolean;
  needsRecipient: boolean;
  hint?: string;
}> = [
  { id: "b2b_sale",    label: "B2B Sale",             comment2: "B2B Sale",            defaultFormat: "Bulk",        needsProvince: true,  needsRecipient: true,  hint: "vente en gros" },
  { id: "messager",    label: "Messager (livraison)", comment2: "Messager",            defaultFormat: "Master Case", needsProvince: true,  needsRecipient: false, hint: "expédition packagée" },
  { id: "b2b_sample",  label: "B2B Sample",           comment2: "B2B Sample",          defaultFormat: "Sample",      needsProvince: false, needsRecipient: true,  hint: "échantillon client" },
  { id: "lab",         label: "Laboratory Analysis",  comment2: "Laboratory Analysis", defaultFormat: "Sample",      needsProvince: false, needsRecipient: true,  hint: "envoi labo" },
  { id: "educational", label: "Educational Sample",   comment2: "Educational Sample",  defaultFormat: "Sample",      needsProvince: false, needsRecipient: true,  hint: "échantillon éducation" },
  { id: "other",       label: "Autre",                comment2: "",                    defaultFormat: "Bulk",        needsProvince: false, needsRecipient: false },
];

// ---------------- IN ----------------

export type InCategory = "cultivation" | "back_pack" | "back_samp" | "back_rew" | "standby" | "external";

export const IN_CATEGORIES: ReadonlyArray<{
  id: InCategory;
  label: string;
  reason: string;
  defaultFormat: string;
  needsQualif: boolean;
  needsPackagedBatch: boolean;
  needsRecipient: boolean;
  hint?: string;
}> = [
  { id: "cultivation", label: "Réception Cultivation",  reason: "In from Cultivation",   defaultFormat: "Bulk",        needsQualif: true,  needsPackagedBatch: false, needsRecipient: false, hint: "nouvelle réception, avec qualification" },
  { id: "back_pack",   label: "Retour Packaging",       reason: "Back from Packaging",   defaultFormat: "Bulk",        needsQualif: false, needsPackagedBatch: true,  needsRecipient: false, hint: "reste de bulk après packaging" },
  { id: "back_samp",   label: "Retour Sampling",        reason: "Back from Sampling",    defaultFormat: "Sample",      needsQualif: false, needsPackagedBatch: false, needsRecipient: false, hint: "reste d'échantillon interne" },
  { id: "back_rew",    label: "Retour Rework",          reason: "Back from Rework",      defaultFormat: "Bulk",        needsQualif: false, needsPackagedBatch: false, needsRecipient: false, hint: "reste après rework" },
  { id: "standby",     label: "Standby for Shipment",   reason: "Standby for Shippment", defaultFormat: "Master Case", needsQualif: false, needsPackagedBatch: true,  needsRecipient: false, hint: "master cases produits, prêts à expédier" },
  { id: "external",    label: "Retour externe (RTV)",   reason: "In From External",      defaultFormat: "Bulk",        needsQualif: false, needsPackagedBatch: false, needsRecipient: true,  hint: "retour depuis client externe" },
];

// ---------------- Réutilisables ----------------

/** Qualifications utilisées en Comment #2 pour "In from Cultivation". */
export const CULTIVATION_QUALIFS = [
  "Large Flower",
  "Medium Flower",
  "Small Flower",
  "Handtrim Flower",
  "Trim",
  "Internal Sample",
  "QA Retain",
  "Laboratory Analysis",
] as const;
export type CultivationQualif = typeof CULTIVATION_QUALIFS[number];

/** Format par défaut selon la qualification IN Cultivation. */
export function formatForCultivationQualif(q: string): string {
  if (["Internal Sample", "QA Retain", "Laboratory Analysis"].includes(q)) return "Sample";
  return "Bulk";
}

/** Provinces / distributeurs (colonne Unit Indicator). */
export const PROVINCES = ["OCS", "SQDC", "Quebec", "Alberta", "British Col.", "CNB", "NB", "Ontario"] as const;

// ---------------- Détection à partir d'un mouvement existant ----------------

export function detectOutCategory(reason: string): OutCategory {
  const r = (reason || "").toLowerCase();
  if (r.includes("packaging")) return "packaging";
  if (r.includes("sampling")) return "sampling";
  if (r.includes("rework")) return "rework";
  if (r.includes("destruction")) return "destruction";
  return "facility";
}
export function detectFacilityPurpose(comment2: string): FacilityPurpose {
  const c = (comment2 || "").toLowerCase();
  if (c.includes("messager")) return "messager";
  if (c.includes("b2b sample") || c.includes("sampling b2b")) return "b2b_sample";
  if (c.includes("b2b")) return "b2b_sale";
  if (c.includes("lab")) return "lab";
  if (c.includes("educat")) return "educational";
  return "other";
}
export function detectInCategory(reason: string): InCategory {
  const r = (reason || "").toLowerCase();
  if (r.includes("cultivation")) return "cultivation";
  if (r.includes("back from packaging")) return "back_pack";
  if (r.includes("back from sampling")) return "back_samp";
  if (r.includes("back from rework")) return "back_rew";
  if (r.includes("standby")) return "standby";
  if (r.includes("external")) return "external";
  return "cultivation";
}

/** Mode de saisie déduit du couple catégorie / motif. */
export type InputMode =
  | "bagPicker"          // OUT : puiser dans les sacs bulk existants
  | "bagBuilder"         // IN  : construire les sacs retournés (qualification + grammes)
  | "cultivationEntry"   // IN  : nouvelle réception avec qualification
  | "packagedShipment"   // OUT/IN : expédition packagée (Master Case)
  | "manualSample"       // OUT : échantillon (Sample)
  | "manualEntry";       // fallback : grammes + units libres

export function outInputMode(cat: OutCategory, purpose: FacilityPurpose): InputMode {
  if (cat === "facility") {
    if (purpose === "messager") return "packagedShipment";
    if (purpose === "b2b_sale" || purpose === "other") return "bagPicker";
    return "manualSample"; // b2b_sample, lab, educational
  }
  if (cat === "sampling") return "manualSample";
  return "bagPicker"; // packaging, rework, destruction
}

export function inInputMode(cat: InCategory): InputMode {
  if (cat === "cultivation") return "cultivationEntry";
  if (cat === "back_pack" || cat === "back_samp" || cat === "back_rew") return "bagBuilder";
  if (cat === "standby") return "packagedShipment";
  return "manualEntry"; // external
}
