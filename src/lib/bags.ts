import type { Movement } from "./types";

export const QUALIFICATIONS = [
  "Handtrim Flower",
  "Large Flower",
  "Medium Flower",
  "Small Flower",
  "Trim",
] as const;
export type Qualification = typeof QUALIFICATIONS[number];

/** Détecte la qualification depuis Comment #2 (fallback: Comment #1 / product_type). */
export function detectQualification(m: Movement): Qualification | null {
  const hay = `${m.comment2} ${m.comment1} ${m.product_type}`.toLowerCase();
  if (/hand[\s-]?trim/.test(hay)) return "Handtrim Flower";
  if (/large/.test(hay)) return "Large Flower";
  if (/medium|\bmed\b/.test(hay)) return "Medium Flower";
  if (/small/.test(hay)) return "Small Flower";
  if (/trim/.test(hay)) return "Trim";
  return null;
}

/** Taille standard d'un sac plein (g) selon la qualification : Trim = 1500 g, fleurs = 1000 g. */
export function bagSizeFor(q: Qualification): number {
  return q === "Trim" ? 1500 : 1000;
}

export type BagEntry = { grams: number; units: number };

export type BagBreakdown = {
  bagSize: number;
  fullBags: number;
  remainders: number[];
};

/**
 * Décompose une liste d'entrées "In from Cultivation" en sacs.
 * Règle métier : la colonne Units = nombre total de sacs de l'entrée.
 * Décomposition : (units - 1) sacs pleins de `bagSize` g + 1 sac du reste.
 * Si units ≤ 1, on considère toute la quantité comme un seul sac.
 */
export function decomposeBags(entries: BagEntry[], bagSize: number): BagBreakdown {
  let full = 0;
  const remainders: number[] = [];
  for (const { grams, units } of entries) {
    if (grams <= 0) continue;
    const u = Math.max(1, Math.round(units || 1));
    if (u === 1) {
      remainders.push(+grams.toFixed(2));
      continue;
    }
    const fullThis = u - 1;
    const rem = +(grams - fullThis * bagSize).toFixed(2);
    full += fullThis;
    if (rem > 0.001) remainders.push(rem);
    else full += 1;
  }
  return { bagSize, fullBags: full, remainders };
}

export function formatBags(b: BagBreakdown): string {
  const parts: string[] = [];
  if (b.fullBags > 0) parts.push(`${b.fullBags} sac${b.fullBags > 1 ? "s" : ""} de ${b.bagSize} g`);
  for (const r of b.remainders) parts.push(`1 sac de ${r.toFixed(0)} g`);
  return parts.length ? parts.join(" + ") : "—";
}

/** Un sac individuel candidat à la sortie. */
export type AvailableBag = {
  key: string;              // identifiant stable (movement id + index)
  qualification: Qualification;
  grams: number;
  bagSize: number;
  isFull: boolean;
  sourceDate: string;
  sourceMovementId: string;
};

/**
 * Calcule la liste des sacs individuels reçus pour un batch, groupés par qualification.
 * NB: n'affiche pas la consommation antérieure au niveau du sac (juste des candidats).
 */
export function computeAvailableBags(batchId: string, movements: Movement[]): AvailableBag[] {
  const bags: AvailableBag[] = [];
  for (const m of movements) {
    if (m.batch_id !== batchId) continue;
    if (m.direction !== "IN") continue;
    if (!/in from cultivation/i.test(m.reason)) continue;
    const q = detectQualification(m);
    if (!q) continue;
    const grams = Number(m.quantity_g);
    if (grams <= 0) continue;
    const u = Math.max(1, Math.round(Number(m.units) || 1));
    const bagSize = bagSizeFor(q);
    if (u === 1) {
      bags.push({
        key: `${m.id}:0`,
        qualification: q,
        grams: +grams.toFixed(2),
        bagSize,
        isFull: Math.abs(grams - bagSize) < 0.5,
        sourceDate: m.event_date,
        sourceMovementId: m.id,
      });
      continue;
    }
    const fullN = u - 1;
    for (let i = 0; i < fullN; i++) {
      bags.push({
        key: `${m.id}:${i}`,
        qualification: q,
        grams: bagSize,
        bagSize,
        isFull: true,
        sourceDate: m.event_date,
        sourceMovementId: m.id,
      });
    }
    const rem = +(grams - fullN * bagSize).toFixed(2);
    if (rem > 0.001) {
      bags.push({
        key: `${m.id}:${fullN}`,
        qualification: q,
        grams: rem,
        bagSize,
        isFull: false,
        sourceDate: m.event_date,
        sourceMovementId: m.id,
      });
    } else {
      bags.push({
        key: `${m.id}:${fullN}`,
        qualification: q,
        grams: bagSize,
        bagSize,
        isFull: true,
        sourceDate: m.event_date,
        sourceMovementId: m.id,
      });
    }
  }
  return bags;
}

/** Grammes restants nets par qualification pour un batch (IN + retours − OUT). */
export function computeNetByQualification(
  batchId: string,
  movements: Movement[],
): Map<Qualification, number> {
  const map = new Map<Qualification, number>();
  for (const q of QUALIFICATIONS) map.set(q, 0);
  for (const m of movements) {
    if (m.batch_id !== batchId) continue;
    const q = detectQualification(m);
    if (!q) continue;
    const g = Number(m.quantity_g);
    map.set(q, (map.get(q) ?? 0) + (m.direction === "IN" ? g : -g));
  }
  return map;
}
