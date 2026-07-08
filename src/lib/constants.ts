export const DIRECTIONS = ["IN", "OUT"] as const;

export const PRODUCT_FORMATS = ["Bulk", "Sample", "Pre-roll", "Master Case", "Units", "Jar", "Pouch"];

export const PRODUCT_TYPES = [
  "Flower",
  "Flower 1g",
  "Flower 3.5g",
  "Flower 7g",
  "Flower 14g",
  "Flower 28g",
  "Pre-roll 0.35g",
  "Pre-roll 0.5g",
  "Pre-roll 1.5g",
  "Pre-roll 2.5g",
  "Pre-roll 3.5g",
  "Trim",
];

// Formats packagés → calcul auto Qté ↔ Unités via ce mapping (g / unité).
// Le poids par unité est déduit du Product Type quand possible ("Pre-roll 0.5g" → 0.5).
export const PACKAGED_FORMATS = new Set(["Pre-roll", "Master Case", "Units", "Jar", "Pouch"]);

export function inferGramsPerUnit(productType: string): number | null {
  const m = productType.match(/(\d+(?:\.\d+)?)\s*g/i);
  return m ? parseFloat(m[1]) : null;
}

export const DESTINATIONS = [
  "Cultivation",
  "Packaging",
  "Sampling",
  "Rework",
  "Destruction",
  "Shipment",
  "External",
  "Lab",
  "Retention",
];

export const STAMP_TYPES = ["Fédéral", "Provincial", "N/A"];

export const REASONS_IN = [
  "In from Cultivation",
  "In From External",
  "Back from Sampling",
  "Back from Packaging",
  "Back from Rework",
];

export const REASONS_OUT = [
  "Out of Facility",
  "Out For Packaging",
  "Out for Sampling",
  "Out for Rework",
  "Out For Destruction",
  "Standby for Shippment",
];
