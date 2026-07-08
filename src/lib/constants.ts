export const PRODUCT_TYPES = ["Fleur", "Pré-roulé", "Trim", "Kief", "Concentré", "Autre"];
export const PRODUCT_FORMATS = ["Bulk", "Sample", "Pré-pack", "Rétention", "R&D", "Autre"];
export const DESTINATIONS = [
  "Réception",
  "Sortie de l'Installation",
  "Sortie pour Échantillonnage",
  "Retour d'Échantillonnage",
  "Expédition",
  "Transfert Interne",
  "Rétention Archive",
  "Destruction",
  "Autre",
];

export const OUT_DESTINATIONS = new Set([
  "Sortie de l'Installation",
  "Sortie pour Échantillonnage",
  "Expédition",
  "Destruction",
]);
export const IN_DESTINATIONS = new Set([
  "Réception",
  "Retour d'Échantillonnage",
]);

export function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
