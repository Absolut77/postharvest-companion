import * as XLSX from "xlsx";
import JSZip from "jszip";
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
// Le fichier importé reste la source intacte : on modifie uniquement le XML strictement
// nécessaire pour ajouter les nouvelles lignes à la fin de la table LOG, sans réécrire
// le classeur avec une librairie qui pourrait casser les formules/styles/filtres existants.

async function fetchTemplateBuffer(): Promise<ArrayBuffer | null> {
  const { data, error } = await supabase.storage.from(TEMPLATE_BUCKET).download(TEMPLATE_PATH);
  if (error || !data) return null;
  return await data.arrayBuffer();
}

type ExportCellValue = string | number | boolean | null | { kind: "date"; iso: string };

function movementCellByField(m: Movement, field: string): ExportCellValue {
  switch (field) {
    case "event_date": return { kind: "date", iso: m.event_date };
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

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function attrEscape(value: string): string {
  return xmlEscape(value).replace(/"/g, "&quot;");
}

function parseXml(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const err = doc.getElementsByTagName("parsererror")[0];
  if (err) throw new Error("Impossible de lire la structure interne du fichier Excel.");
  return doc;
}

function getRelationshipId(el: Element): string | null {
  return el.getAttribute("r:id") || el.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
}

function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const part of path.replace(/^\//, "").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function resolveTarget(sourcePath: string, target: string): string {
  if (target.startsWith("/")) return normalizePath(target);
  const base = sourcePath.split("/").slice(0, -1).join("/");
  return normalizePath(`${base}/${target}`);
}

function relsPathFor(sourcePath: string): string {
  const parts = sourcePath.split("/");
  const file = parts.pop();
  return `${parts.join("/")}/_rels/${file}.rels`;
}

async function zipText(zip: JSZip, path: string): Promise<string> {
  const file = zip.file(path);
  if (!file) throw new Error(`Fichier Excel interne introuvable: ${path}`);
  return file.async("string");
}

async function relMap(zip: JSZip, relsPath: string): Promise<Map<string, string>> {
  const file = zip.file(relsPath);
  const map = new Map<string, string>();
  if (!file) return map;
  const doc = parseXml(await file.async("string"));
  Array.from(doc.getElementsByTagName("Relationship")).forEach((rel) => {
    const id = rel.getAttribute("Id");
    const target = rel.getAttribute("Target");
    if (id && target) map.set(id, target);
  });
  return map;
}

async function worksheetPathFor(zip: JSZip, wantedSheetName: string): Promise<string> {
  const workbookXml = await zipText(zip, "xl/workbook.xml");
  const rels = await relMap(zip, "xl/_rels/workbook.xml.rels");
  const doc = parseXml(workbookXml);
  const sheets = Array.from(doc.getElementsByTagName("sheet"));
  const sheet = sheets.find((s) => s.getAttribute("name") === wantedSheetName)
    ?? sheets.find((s) => normalize(s.getAttribute("name") ?? "") === normalize(wantedSheetName));
  const id = sheet ? getRelationshipId(sheet) : null;
  const target = id ? rels.get(id) : null;
  if (!target) throw new Error(`Impossible de localiser la feuille ${wantedSheetName} dans le fichier Excel.`);
  return resolveTarget("xl/workbook.xml", target);
}

async function tablePathForWorksheet(zip: JSZip, sheetPath: string, sheetXml: string): Promise<string | null> {
  const tablePart = /<tablePart\b[^>]*(?:r:id|id)="([^"]+)"[^>]*\/>/.exec(sheetXml);
  const relId = tablePart?.[1];
  if (!relId) return null;
  const rels = await relMap(zip, relsPathFor(sheetPath));
  const target = rels.get(relId);
  return target ? resolveTarget(sheetPath, target) : null;
}

function rowNumFromRef(ref: string): number {
  const match = /\d+$/.exec(ref);
  return match ? Number(match[0]) : 1;
}

function maxRowInSheetXml(sheetXml: string): number {
  let max = 1;
  for (const match of sheetXml.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>/g)) {
    max = Math.max(max, Number(match[1]));
  }
  for (const match of sheetXml.matchAll(/<c\b[^>]*\br="[A-Z]+(\d+)"[^>]*>/g)) {
    max = Math.max(max, Number(match[1]));
  }
  return max;
}

function getTableRef(tableXml: string | null): string | null {
  if (!tableXml) return null;
  return /<table\b[^>]*\bref="([^"]+)"/.exec(tableXml)?.[1] ?? null;
}

function extendRefRows(ref: string, endRow: number): string {
  const range = XLSX.utils.decode_range(ref);
  range.e.r = Math.max(range.e.r, endRow - 1);
  return XLSX.utils.encode_range(range);
}

function getRowXml(sheetXml: string, rowNumber: number): string | null {
  const escaped = String(rowNumber).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`<row\\b[^>]*\\br="${escaped}"[^>]*>[\\s\\S]*?<\\/row>`).exec(sheetXml)?.[0] ?? null;
}

function countCells(rowXml: string): number {
  return Array.from(rowXml.matchAll(/<c\b/g)).length;
}

function findReferenceStyles(sheetXml: string, maxRow: number): Record<string, string> {
  let best: string | null = null;
  let bestCount = 0;
  for (let row = maxRow; row >= 2; row--) {
    const xml = getRowXml(sheetXml, row);
    if (!xml) continue;
    const count = countCells(xml);
    const hasDateCell = /<c\b[^>]*\br="A\d+"/.test(xml);
    if (hasDateCell && count >= 8) { best = xml; break; }
    if (count > bestCount) { best = xml; bestCount = count; }
  }
  best ||= getRowXml(sheetXml, 2);
  const styles: Record<string, string> = {};
  if (!best) return styles;
  for (const match of best.matchAll(/<c\b([^>]*)\br="([A-Z]+)\d+"([^>]*)>/g)) {
    const attrs = `${match[1]} ${match[3]}`;
    const style = /\bs="(\d+)"/.exec(attrs)?.[1];
    if (style) styles[match[2]] = style;
  }
  return styles;
}

function isoDateToExcelSerial(iso: string): number | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!parts) return null;
  const utc = Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  if (!Number.isFinite(utc)) return null;
  return Math.round(utc / 86400000 + 25569);
}

function cellXml(ref: string, value: ExportCellValue, style?: string): string {
  if (value == null || value === "") return "";
  const styleAttr = style ? ` s="${attrEscape(style)}"` : "";
  if (typeof value === "object" && value.kind === "date") {
    const serial = isoDateToExcelSerial(value.iso);
    return serial == null ? "" : `<c r="${ref}"${styleAttr}><v>${serial}</v></c>`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}"${styleAttr}><v>${value}</v></c>`;
  }
  if (typeof value === "boolean") {
    return `<c r="${ref}" t="b"${styleAttr}><v>${value ? 1 : 0}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"${styleAttr}><is><t>${xmlEscape(String(value))}</t></is></c>`;
}

function rowXml(rowNumber: number, values: ExportCellValue[], colCount: number, styles: Record<string, string>): string {
  const cells: string[] = [];
  for (let index = 0; index < colCount; index++) {
    const col = XLSX.utils.encode_col(index);
    cells.push(cellXml(`${col}${rowNumber}`, values[index] ?? null, styles[col]));
  }
  return `<row r="${rowNumber}" spans="1:${colCount}">${cells.join("")}</row>`;
}

function appendRowsToSheetXml(sheetXml: string, rowsXml: string): string {
  if (/<sheetData\s*\/>/.test(sheetXml)) return sheetXml.replace(/<sheetData\s*\/>/, `<sheetData>${rowsXml}</sheetData>`);
  return sheetXml.replace(/<\/sheetData>/, `${rowsXml}</sheetData>`);
}

function updateSheetDimension(sheetXml: string, endRow: number): string {
  return sheetXml.replace(/(<dimension\b[^>]*\bref=")([^"]+)("[^>]*\/>)/, (_m, a, ref, b) => `${a}${extendRefRows(ref, endRow)}${b}`);
}

function updateTableRef(tableXml: string, nextRef: string): string {
  return tableXml
    .replace(/(<table\b[^>]*\bref=")([^"]+)(")/, (_m, a, _ref, b) => `${a}${nextRef}${b}`)
    .replace(/(<autoFilter\b[^>]*\bref=")([^"]+)(")/, (_m, a, _ref, b) => `${a}${nextRef}${b}`);
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

  const parsed = XLSX.read(templateBuf, { type: "array", cellDates: true });
  let sheetName = LOG_SHEET_CANDIDATES.find((n) => parsed.SheetNames.includes(n));
  if (!sheetName) {
    sheetName = parsed.SheetNames.find((name) => {
      const rows = XLSX.utils.sheet_to_json<unknown[]>(parsed.Sheets[name], { header: 1, blankrows: false });
      return rows.length > 0 && (rows[0] as unknown[]).some((h) => normalize(String(h)) === "date");
    });
  }
  if (!sheetName) throw new Error("Impossible de trouver la feuille LOG 2026 dans le modèle.");

  const rows = XLSX.utils.sheet_to_json<unknown[]>(parsed.Sheets[sheetName], { header: 1, blankrows: false, defval: null });
  const headerCells = (rows[0] ?? []) as unknown[];
  const map = buildHeaderMap(headerCells);
  const colCount = Math.max(headerCells.length, ...Object.values(map).map((i) => i + 1), 17);

  const zip = await JSZip.loadAsync(templateBuf);
  const sheetPath = await worksheetPathFor(zip, sheetName);
  let sheetXml = await zipText(zip, sheetPath);
  const tablePath = await tablePathForWorksheet(zip, sheetPath, sheetXml);
  let tableXml = tablePath ? await zipText(zip, tablePath) : null;
  const tableRef = getTableRef(tableXml);
  const tableEndRow = tableRef ? rowNumFromRef(tableRef.split(":").pop() ?? tableRef) : 1;
  const sheetEndRow = maxRowInSheetXml(sheetXml);
  // Toujours empiler juste après la dernière ligne du tableau structuré Excel, pour
  // que les nouvelles lignes fassent partie de la Table (filtres + styles hérités).
  const appendAt = (tableRef ? tableEndRow : sheetEndRow) + 1;
  const newEndRow = appendAt + appRows.length - 1;
  const styles = findReferenceStyles(sheetXml, Math.max(tableEndRow, sheetEndRow));

  const newRowsXml = appRows.map((m, offset) => {
    const rowValues: ExportCellValue[] = new Array(colCount).fill(null);
    for (const [field, colIdx] of Object.entries(map)) rowValues[colIdx] = movementCellByField(m, field);
    return rowXml(appendAt + offset, rowValues, colCount, styles);
  }).join("");

  if (newRowsXml) {
    sheetXml = appendRowsToSheetXml(sheetXml, newRowsXml);
    sheetXml = updateSheetDimension(sheetXml, newEndRow);
    // Certaines feuilles portent leur propre <autoFilter> (indépendant de la Table)
    sheetXml = sheetXml.replace(
      /(<autoFilter\b[^>]*\bref=")([^"]+)(")/,
      (_m, a, ref, b) => `${a}${extendRefRows(ref, newEndRow)}${b}`,
    );
    zip.file(sheetPath, sheetXml);

    if (tablePath && tableXml && tableRef) {
      const nextTableRef = extendRefRows(tableRef, newEndRow);
      tableXml = updateTableRef(tableXml, nextTableRef);
      zip.file(tablePath, tableXml);
    }
  }

  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
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
