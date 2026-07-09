import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { supabase } from "@/integrations/supabase/client";
import type { MovementInput, Movement } from "./types";
import { listMovements } from "./movements";

const LOG_SHEET_CANDIDATES = ["LOG 2026", "Log 2026", "log 2026"];
const TEMPLATE_BUCKET = "templates";
const TEMPLATE_PATH = "log-template.xlsx";

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

function buildHeaderMap(headers: unknown[]): Record<string, number> {
  const norm = headers.map((h) => normalize(String(h ?? "")));
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
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
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
  templateSaved: boolean;
};

/**
 * IMPORT
 * - Lit uniquement les données de la feuille LOG 2026
 * - Enregistre le fichier tel quel dans le bucket "templates" (modèle intact)
 * - Purge la table `movements` et réinsère les lignes importées, marquées `from_import = true`
 */
export async function importFromXlsx(file: File): Promise<ImportResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  let sheetName = LOG_SHEET_CANDIDATES.find((n) => wb.SheetNames.includes(n));
  if (!sheetName) {
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false });
      if (rows.length && (rows[0] as unknown[]).some((h) => normalize(String(h)) === "date")) {
        sheetName = name; break;
      }
    }
  }
  if (!sheetName) throw new Error("Feuille 'LOG 2026' introuvable dans le fichier.");
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: null });
  if (rows.length < 2) throw new Error("Feuille vide.");
  const map = buildHeaderMap(rows[0] as unknown[]);
  if (map.event_date == null || map.destination == null) {
    throw new Error("Colonnes 'Date' et/ou 'Destination' introuvables.");
  }
  const get = (row: unknown[], field: string): unknown =>
    map[field] != null ? row[map[field]] : undefined;

  const inserts: (MovementInput & { from_import: true })[] = [];
  let skipped = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
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
      from_import: true,
    });
  }

  // Sauvegarde le fichier tel quel comme modèle intact
  let templateSaved = false;
  try {
    const { error: upErr } = await supabase.storage
      .from(TEMPLATE_BUCKET)
      .upload(TEMPLATE_PATH, file, {
        upsert: true,
        contentType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
    if (!upErr) templateSaved = true;
  } catch {
    /* non-blocking */
  }

  const { count: prevCount } = await supabase
    .from("movements")
    .select("*", { count: "exact", head: true });
  const { error: delErr } = await supabase.from("movements").delete().not("id", "is", null);
  if (delErr) throw delErr;

  const BATCH = 200;
  let inserted = 0;
  for (let i = 0; i < inserts.length; i += BATCH) {
    const chunk = inserts.slice(i, i + BATCH);
    const { error } = await supabase.from("movements").insert(chunk);
    if (error) throw error;
    inserted += chunk.length;
  }
  return { inserted, skipped, deletedPrevious: prevCount ?? 0, templateSaved };
}

// -------- EXPORT --------
// N'écrit AUCUNE modification sur les lignes issues du modèle : on prend une copie
// du fichier d'origine et on ajoute uniquement les mouvements créés dans l'app.

async function fetchTemplateBuffer(): Promise<ArrayBuffer | null> {
  const { data, error } = await supabase.storage.from(TEMPLATE_BUCKET).download(TEMPLATE_PATH);
  if (error || !data) return null;
  return await data.arrayBuffer();
}

function movementCellByField(m: Movement, field: string): string | number | boolean | null {
  switch (field) {
    case "event_date": return m.event_date;
    case "initials": return m.initials;
    case "strain": return m.strain;
    case "batch_id": return m.batch_id;
    case "product_type": return m.product_type;
    case "product_format": return m.product_format;
    case "quantity_g": return Number(m.quantity_g);
    case "units": return Number(m.units);
    case "destination": return m.direction === "OUT" ? "Out" : "In";
    case "comment1": return m.comment1 || m.reason;
    case "adjustment_validation": return m.adjustment_validation ? 1 : null;
    case "comment2": return m.comment2;
    case "units2": return Number(m.units2) || null;
    case "unit_indicator": return m.unit_indicator;
    case "sku": return m.sku;
    case "additional_comments": return m.additional_comments;
    case "elevated_update": return m.elevated_update ? 1 : null;
    default: return null;
  }
}

export async function exportToXlsx(): Promise<{ appended: number }> {
  const templateBuf = await fetchTemplateBuffer();
  if (!templateBuf) {
    throw new Error(
      "Aucun modèle Excel enregistré. Importe d'abord ton fichier .xlsx d'origine — il sera conservé comme modèle pour tous les exports suivants.",
    );
  }
  const movements = await listMovements();
  const appRows = movements
    .filter((m) => !m.from_import)
    .sort((a, b) =>
      a.event_date === b.event_date
        ? (a.created_at ?? "").localeCompare(b.created_at ?? "")
        : a.event_date.localeCompare(b.event_date),
    );

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBuf);

  let ws = LOG_SHEET_CANDIDATES.map((n) => wb.getWorksheet(n)).find(Boolean) as ExcelJS.Worksheet | undefined;
  if (!ws) {
    for (const candidate of wb.worksheets) {
      const first = candidate.getRow(1);
      const headers: string[] = [];
      first.eachCell({ includeEmpty: true }, (c) => headers.push(String(c.value ?? "")));
      if (headers.some((h) => normalize(h) === "date")) { ws = candidate; break; }
    }
  }
  if (!ws) throw new Error("Impossible de trouver la feuille LOG 2026 dans le modèle.");

  const headerRow = ws.getRow(1);
  const headerCells: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (c) => headerCells.push(String(c.value ?? "")));
  const map = buildHeaderMap(headerCells);
  const colCount = headerCells.length || 17;

  // Cherche la première ligne vide APRÈS toutes les données existantes du modèle,
  // pour ajouter à la suite sans rien écraser.
  let appendAt = Math.max(ws.actualRowCount, 1) + 1;
  // Précaution : si la dernière ligne réelle est vide, remonte pour compacter
  while (appendAt > 2) {
    const prev = ws.getRow(appendAt - 1);
    const empty = prev.actualCellCount === 0;
    if (!empty) break;
    appendAt--;
  }

  for (const m of appRows) {
    const rowArr: (string | number | boolean | null)[] = new Array(colCount).fill(null);
    for (const [field, colIdx] of Object.entries(map)) {
      rowArr[colIdx] = movementCellByField(m, field);
    }
    const row = ws.getRow(appendAt);
    rowArr.forEach((v, i) => {
      row.getCell(i + 1).value = v as ExcelJS.CellValue;
    });
    row.commit();
    appendAt++;
  }

  const out = await wb.xlsx.writeBuffer();
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const stamp = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `PostHarvest_Log_${stamp}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  return { appended: appRows.length };
}
