import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import type { MovementInput } from "./types";
import { listMovements } from "./movements";

const LOG_SHEET_CANDIDATES = ["LOG 2026", "Log 2026", "log 2026"];

const HEADER_ALIASES: Record<string, string[]> = {
  event_date: ["Date"],
  initials: ["Requester Initials", "Initials"],
  strain: ["Strain"],
  batch_id: ["Batch/ Lot ID", "Batch/Lot ID", "Batch ID", "Batch"],
  product_type: ["Product type", "Product Type"],
  product_format: ["Product Format"],
  quantity_g: ["Quantity (G)", "Quantity (g)", "Quantity"],
  units: ["Units"],
  destination: ["Destination"],
  comment1: ["Comment #1", "Comment 1"],
  adjustment_validation: ["Adjustement Validation", "Adjustment Validation"],
  comment2: ["Comment #2", "Comment 2"],
  units2: ["Units 2"],
  unit_indicator: ["Unit Indicator"],
  sku: ["SKU"],
  additional_comments: ["Aditional Comments", "Additional Comments"],
  elevated_update: ["Elevated Update"],
};

function normalize(h: string): string {
  return String(h ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function buildHeaderMap(headers: string[]): Record<string, number> {
  const norm = headers.map(normalize);
  const map: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const a of aliases) {
      const idx = norm.indexOf(normalize(a));
      if (idx >= 0) { map[field] = idx; break; }
    }
  }
  return map;
}

function excelDateToISO(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return null;
  }
  const s = String(v).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const fr = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/.exec(s);
  if (fr) return `${fr[3]}-${fr[2].padStart(2, "0")}-${fr[1].padStart(2, "0")}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function toStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}
function toNum(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return isFinite(n) ? n : 0;
}
function toBool(v: unknown): boolean {
  if (v == null || v === "") return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "oui" || s === "x";
}

export type ImportResult = {
  inserted: number;
  skipped: number;
  deletedPrevious: number;
};

export async function importFromXlsx(file: File): Promise<ImportResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  let sheetName = LOG_SHEET_CANDIDATES.find((n) => wb.SheetNames.includes(n));
  if (!sheetName) {
    // Fallback: first sheet that has a "Date" column
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false });
      if (rows.length && rows[0].some((h) => normalize(String(h)) === "date")) {
        sheetName = name; break;
      }
    }
  }
  if (!sheetName) throw new Error("Feuille 'LOG 2026' introuvable dans le fichier.");
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false, defval: null });
  if (rows.length < 2) throw new Error("Feuille vide.");
  const headers = (rows[0] as unknown[]).map((h) => String(h ?? ""));
  const map = buildHeaderMap(headers);
  if (map.event_date == null || map.destination == null) {
    throw new Error("Colonnes 'Date' et/ou 'Destination' introuvables.");
  }
  const get = (row: any[], field: string): unknown =>
    map[field] != null ? row[map[field]] : undefined;

  const inserts: MovementInput[] = [];
  let skipped = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as any[];
    if (!row || row.every((c) => c == null || c === "")) { skipped++; continue; }
    const iso = excelDateToISO(get(row, "event_date"));
    const dest = toStr(get(row, "destination"));
    if (!iso || !dest) { skipped++; continue; }
    const direction: "IN" | "OUT" = /^out/i.test(dest) ? "OUT" : "IN";
    const comment1 = toStr(get(row, "comment1"));
    inserts.push({
      event_date: iso,
      initials: toStr(get(row, "initials")),
      strain: toStr(get(row, "strain")),
      batch_id: toStr(get(row, "batch_id")),
      product_type: toStr(get(row, "product_type")),
      product_format: toStr(get(row, "product_format")),
      quantity_g: toNum(get(row, "quantity_g")),
      units: Math.round(toNum(get(row, "units"))),
      direction,
      reason: comment1,
      detail: "",
      sku: toStr(get(row, "sku")),
      comment: "",
      destination: dest,
      comment1,
      comment2: toStr(get(row, "comment2")),
      adjustment_validation: toBool(get(row, "adjustment_validation")),
      stamp_used: "",
      stamp_type: "",
      additional_comments: toStr(get(row, "additional_comments")),
      elevated_update: toBool(get(row, "elevated_update")),
      units2: toNum(get(row, "units2")),
      unit_indicator: toStr(get(row, "unit_indicator")),
    });
  }

  // Count previous
  const { count: prevCount } = await supabase
    .from("movements")
    .select("*", { count: "exact", head: true });
  // Purge (RLS allows public delete)
  const { error: delErr } = await supabase
    .from("movements")
    .delete()
    .not("id", "is", null);
  if (delErr) throw delErr;

  // Batched insert
  const BATCH = 200;
  let inserted = 0;
  for (let i = 0; i < inserts.length; i += BATCH) {
    const chunk = inserts.slice(i, i + BATCH);
    const { error } = await supabase.from("movements").insert(chunk);
    if (error) throw error;
    inserted += chunk.length;
  }
  return { inserted, skipped, deletedPrevious: prevCount ?? 0 };
}

export async function exportToXlsx(): Promise<void> {
  const movements = await listMovements();
  // Sort chronologically ascending for the export (matches the log)
  const sorted = [...movements].sort((a, b) =>
    a.event_date === b.event_date
      ? (a.created_at ?? "").localeCompare(b.created_at ?? "")
      : a.event_date.localeCompare(b.event_date),
  );
  const rows = sorted.map((m) => ({
    "Date": m.event_date,
    "Requester Initials": m.initials,
    "Strain": m.strain,
    "Batch/ Lot ID": m.batch_id,
    "Product type": m.product_type,
    "Product Format": m.product_format,
    "Quantity (G)": Number(m.quantity_g),
    "Units": Number(m.units),
    "Destination": m.direction === "OUT" ? "Out" : "In",
    "Comment #1": m.comment1 || m.reason,
    "Adjustement Validation": m.adjustment_validation ? 1 : "",
    "Comment #2": m.comment2,
    "Units 2": Number(m.units2) || "",
    "Unit Indicator": m.unit_indicator,
    "SKU": m.sku,
    "Aditional Comments": m.additional_comments,
    "Elevated Update": m.elevated_update ? 1 : "",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "LOG 2026");
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `PostHarvest_Log_${stamp}.xlsx`);
}
