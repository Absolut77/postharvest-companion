export type BatchStage =
  | "harvest" | "drying" | "debudding" | "sorting" | "curing" | "bulk_packaging" | "vault";

export type Qualification = "handtrim" | "large" | "medium" | "small" | "trim";
export type BagStage =
  | "post_debudding" | "in_curing" | "bulk_packed" | "sampled" | "retained" | "shipped" | "destroyed";
export type DebuddingMethod = "hand_trim" | "mobius";

export const BATCH_STAGES: BatchStage[] = [
  "harvest","drying","debudding","sorting","curing","bulk_packaging","vault",
];

export const STAGE_LABELS: Record<BatchStage, string> = {
  harvest: "Récolte",
  drying: "Séchage",
  debudding: "Débudage",
  sorting: "Tri & Ensachage",
  curing: "Curing",
  bulk_packaging: "Bulk Packaging",
  vault: "Voûte",
};

export const QUALIFICATION_LABELS: Record<Qualification, string> = {
  handtrim: "Handtrim",
  large: "Large",
  medium: "Medium",
  small: "Small",
  trim: "Trim",
};

export type Batch = {
  id: string;
  batch_id: string;
  strain: string;
  plant_count: number;
  harvest_date: string | null;
  wet_weight_g: number;
  dry_weight_g: number;
  current_stage: BatchStage;
  notes: string;
  created_at?: string;
  updated_at?: string;
};

export type DryingReading = {
  id: string;
  batch_id: string;
  taken_at: string;
  room_temp_c: number | null;
  internal_humidity: number | null;
  external_humidity: number | null;
  water_activity: number | null;
  sartorius_value: number | null;
  note: string;
};

export type CuringReading = {
  id: string;
  batch_id: string;
  taken_at: string;
  water_activity: number | null;
  humidity: number | null;
  note: string;
};

export type BatchStageEvent = {
  id: string;
  batch_id: string;
  from_stage: BatchStage | null;
  to_stage: BatchStage;
  at: string;
  actor: string;
  note: string;
};
