import { supabase } from "@/integrations/supabase/client";
import type { Batch, BatchStage, DryingReading, CuringReading, BatchStageEvent } from "./types";

// ---------- Batches ----------
export async function listBatches(): Promise<Batch[]> {
  const { data, error } = await supabase
    .from("batches")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Batch[];
}

export async function getBatch(id: string): Promise<Batch> {
  const { data, error } = await supabase.from("batches").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Batch;
}

export async function createBatch(input: {
  batch_id: string;
  strain: string;
  plant_count?: number;
  harvest_date?: string | null;
  wet_weight_g?: number;
  notes?: string;
}): Promise<Batch> {
  const { data, error } = await supabase
    .from("batches")
    .insert({
      batch_id: input.batch_id,
      strain: input.strain,
      plant_count: input.plant_count ?? 0,
      harvest_date: input.harvest_date ?? null,
      wet_weight_g: input.wet_weight_g ?? 0,
      notes: input.notes ?? "",
      current_stage: "harvest",
    })
    .select("*")
    .single();
  if (error) throw error;
  await logStage(data!.id, null, "harvest", "Création du batch");
  return data as Batch;
}

export async function updateBatch(id: string, patch: Partial<Batch>): Promise<Batch> {
  const { data, error } = await supabase.from("batches").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data as Batch;
}

export async function advanceStage(id: string, from: BatchStage | null, to: BatchStage, note = ""): Promise<void> {
  const { error } = await supabase.from("batches").update({ current_stage: to }).eq("id", id);
  if (error) throw error;
  await logStage(id, from, to, note);
}

async function logStage(batch_id: string, from: BatchStage | null, to: BatchStage, note: string) {
  await supabase.from("batch_stage_events").insert({
    batch_id, from_stage: from, to_stage: to, note, actor: "",
  });
}

export async function listStageEvents(batch_id: string): Promise<BatchStageEvent[]> {
  const { data, error } = await supabase
    .from("batch_stage_events").select("*").eq("batch_id", batch_id)
    .order("at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BatchStageEvent[];
}

// ---------- Drying ----------
export async function listDrying(batch_id: string): Promise<DryingReading[]> {
  const { data, error } = await supabase
    .from("drying_readings").select("*").eq("batch_id", batch_id)
    .order("taken_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DryingReading[];
}

export async function addDryingReading(input: Omit<DryingReading, "id"> & { id?: string }) {
  const { error } = await supabase.from("drying_readings").insert(input);
  if (error) throw error;
}

export async function deleteDryingReading(id: string) {
  const { error } = await supabase.from("drying_readings").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Curing ----------
export async function listCuring(batch_id: string): Promise<CuringReading[]> {
  const { data, error } = await supabase
    .from("curing_readings").select("*").eq("batch_id", batch_id)
    .order("taken_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CuringReading[];
}

export async function addCuringReading(input: Omit<CuringReading, "id">) {
  const { error } = await supabase.from("curing_readings").insert(input);
  if (error) throw error;
}
