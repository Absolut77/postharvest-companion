import * as XLSX from "xlsx";
import type { Movement, MovementInput, Direction } from "./types";

/**
 * Mapping colonne Excel (Log 2026) <-> champs DB.
 * Le premier alias est utilisé pour l'export.
 */
type Field = keyof MovementInput;

const COLUMNS: ReadonlyArray<{ field: Field; aliases: string[] }> = [
  { field: "event_date",            aliases: ["Date", "Event Date"] },
  { field: "initials",              aliases: ["Initials", "Initiales", "Init.", "Init"] },
  { field: "strain",                aliases: ["Strain", "Souche", "Product"] },
  { field: "batch_id",              aliases: ["Batch ID", "Batch #", "Batch#", "Batch No", "Batch No.", "Batch Number", "Batch", "Lot", "Lot #", "N° Lot", "No Lot"] },
  { field: "product_type",          aliases: ["Product Type", "Type"] },
  { field: "product_format",        aliases: ["Product Format", "Format"] },
  { field: "quantity_g",            aliases: ["Quantity (g)", "Quantity", "Qty (g)", "Qty", "Quantité (g)", "Quantity g"] },
  { field: "units",                 aliases: ["Units", "Unités", "Unit", "# Units"] },
  { field: "direction",             aliases: ["Direction", "IN/OUT", "In/Out"] },
  { field: "reason",                aliases: ["Reason", "Motif"] },
  { field: "destination",           aliases: ["Destination", "Dest.", "Dest"] },
  { field: "comment1",              aliases: ["Comment #1", "Comment 1", "Comment1", "Commentaire 1"] },
  { field: "comment2",              aliases: ["Comment #2", "Comment 2", "Comment2", "Commentaire 2", "Additional Comment"] },
  { field: "unit_indicator",        aliases: ["Unit Indicator", "Province", "Distributor", "Distributeur"] },
  { field: "sku",                   aliases: ["SKU"] },
  { field: "detail",                aliases: ["Detail", "Détail", "Details"] },
  { field: "stamp_used",            aliases: ["Stamp Used", "Stamp"] },
  { field: "stamp_type",            aliases: ["Stamp Type"] },
  { field: "adjustment_validation", aliases: ["Adjustment Validation", "Adjustment"] },
  { field: "additional_comments",   aliases: ["Additional Comments", "Notes"] },
  { field: "elevated_update",       aliases: ["Elevated Update"] },
  { field: "units2",                aliases: ["Units 2", "Units2", "Unit 2"] },
  { field: "comment",               aliases: ["Comment", "Commentaire"] },
];

// ---------- Helpers ----------

function normHeader(s: string) {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function toDateStr(v: unknown): string {
  if (!v) return new Date().toISOString().slice(0, 10);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  // Try ISO already
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // DD/MM/YYYY or MM/DD/YYYY
  const m = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/.exec(s);
  if (m) {
    const [_, a, b, y] = m;
    const yr = y.length === 2 ? `20${y}` : y;
    // Assume DD/MM/YYYY (canadien/français prédomine dans le log)
    return `${yr}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
  }
  return new Date().toISOString().slice(0, 10);
}

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/\s/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "oui" || s === "x";
}

function toDir(v: unknown): Direction {
  const s = String(v ?? "").trim().toUpperCase();
  return s === "IN" ? "IN" : "OUT";
}

// ---------- Import ----------

export type ParsedImport = {
  rows: MovementInput[];
  skipped: number;
  totalRows: number;
  sheetName: string;
  matchedHeaders: string[];
  unknownHeaders: string[];
};

/** Déduit la direction à partir des colonnes disponibles (Destination "In/Out", motif, etc.) */
function inferDirection(acc: Partial<Record<Field, unknown>>): Direction {
  const explicit = String(acc.direction ?? "").trim().toUpperCase();
  if (explicit === "IN" || explicit === "OUT") return explicit as Direction;

  const dest = String(acc.destination ?? "").trim().toLowerCase();
  if (dest === "in" || dest === "entrée" || dest === "entree") return "IN";
  if (dest === "out" || dest === "sortie") return "OUT";

  const reason = `${String(acc.reason ?? "")} ${String(acc.comment1 ?? "")}`.toLowerCase();
  if (/\b(in from|back from|standby|réception|reception|retour)\b/.test(reason)) return "IN";
  if (/\b(out |out of|out for|destruction|shipment|expédition|expedition|sortie)\b/.test(reason)) return "OUT";

  return "OUT";
}

export function parseWorkbook(buf: ArrayBuffer): ParsedImport {
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheetName =
    wb.SheetNames.find((n) => /log.*2026/i.test(n)) ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, {
    defval: "",
    raw: true,
  });

  const aliasMap = new Map<string, Field>();
  for (const { field, aliases } of COLUMNS) {
    for (const a of aliases) aliasMap.set(normHeader(a), field);
  }

  const matched = new Set<string>();
  const unknown = new Set<string>();
  const rows: MovementInput[] = [];
  let skipped = 0;

  for (const r of raw) {
    const acc: Partial<Record<Field, unknown>> = {};
    for (const [k, v] of Object.entries(r)) {
      const f = aliasMap.get(normHeader(k));
      if (f) {
        acc[f] = v;
        matched.add(k);
      } else if (k && String(v ?? "").toString().trim() !== "") {
        unknown.add(k);
      }
    }
    if (!acc.strain && !acc.batch_id) { skipped++; continue; }

    const mov: MovementInput = {
      event_date: toDateStr(acc.event_date),
      initials: String(acc.initials ?? ""),
      strain: String(acc.strain ?? ""),
      batch_id: String(acc.batch_id ?? ""),
      product_type: String(acc.product_type ?? ""),
      product_format: String(acc.product_format ?? ""),
      quantity_g: toNum(acc.quantity_g),
      units: Math.round(toNum(acc.units)),
      direction: inferDirection(acc),
      reason: String(acc.reason ?? ""),
      destination: String(acc.destination ?? ""),
      comment1: String(acc.comment1 ?? ""),
      comment2: String(acc.comment2 ?? ""),
      unit_indicator: String(acc.unit_indicator ?? ""),
      sku: String(acc.sku ?? ""),
      detail: String(acc.detail ?? ""),
      stamp_used: String(acc.stamp_used ?? ""),
      stamp_type: String(acc.stamp_type ?? ""),
      adjustment_validation: toBool(acc.adjustment_validation),
      additional_comments: String(acc.additional_comments ?? ""),
      elevated_update: toBool(acc.elevated_update),
      units2: toNum(acc.units2),
      comment: String(acc.comment ?? ""),
    };
    rows.push(mov);
  }

  return {
    rows,
    skipped,
    totalRows: raw.length,
    sheetName,
    matchedHeaders: Array.from(matched),
    unknownHeaders: Array.from(unknown),
  };
}


// ---------- Export ----------

export function exportMovements(movements: Movement[], filename = "log-2026-export.xlsx") {
  const headers = COLUMNS.map((c) => c.aliases[0]);
  const data = movements
    .slice()
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
    .map((m) => {
      const row: Record<string, unknown> = {};
      for (const { field, aliases } of COLUMNS) {
        row[aliases[0]] = (m as Movement)[field as keyof Movement];
      }
      return row;
    });

  const ws = XLSX.utils.json_to_sheet(data, { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Log 2026");
  XLSX.writeFile(wb, filename);
}
