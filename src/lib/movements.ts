import { supabase } from "@/integrations/supabase/client";
import type { Movement, MovementInput } from "./types";

export async function listMovements(): Promise<Movement[]> {
  const { data, error } = await supabase
    .from("movements")
    .select("*")
    .order("event_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) throw error;
  return (data ?? []) as Movement[];
}

export async function insertMovement(input: MovementInput): Promise<Movement> {
  const { data, error } = await supabase.from("movements").insert(input).select("*").single();
  if (error) throw error;
  return data as Movement;
}

export async function updateMovement(id: string, input: Partial<MovementInput>): Promise<Movement> {
  const { data, error } = await supabase.from("movements").update(input).eq("id", id).select("*").single();
  if (error) throw error;
  return data as Movement;
}

export async function deleteMovement(id: string): Promise<void> {
  const { error } = await supabase.from("movements").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Derived helpers ----------

export type BatchStock = {
  batch_id: string;
  strain: string;
  product_type: string;
  product_format: string;
  quantity_g: number;
  units: number;
  movements: number;
  last_date: string;
};

export function computeInventory(movs: Movement[]): BatchStock[] {
  const map = new Map<string, BatchStock>();
  for (const m of movs) {
    const key = m.batch_id;
    if (!map.has(key)) {
      map.set(key, {
        batch_id: m.batch_id,
        strain: m.strain,
        product_type: m.product_type,
        product_format: m.product_format,
        quantity_g: 0,
        units: 0,
        movements: 0,
        last_date: m.event_date,
      });
    }
    const b = map.get(key)!;
    const sign = m.direction === "IN" ? 1 : -1;
    b.quantity_g += sign * Number(m.quantity_g);
    b.units += sign * Number(m.units);
    b.movements += 1;
    if (m.event_date > b.last_date) b.last_date = m.event_date;
    // keep the most recent strain/format seen
    b.strain = m.strain || b.strain;
    b.product_format = m.product_format || b.product_format;
    b.product_type = m.product_type || b.product_type;
  }
  return Array.from(map.values()).sort((a, b) => a.batch_id.localeCompare(b.batch_id));
}

export function uniqueSorted<T extends string>(vals: (T | undefined | null)[]): T[] {
  const s = new Set<T>();
  for (const v of vals) if (v && v.trim()) s.add(v as T);
  return Array.from(s).sort((a, b) => a.localeCompare(b));
}
