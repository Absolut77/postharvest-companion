export type Direction = "IN" | "OUT";

export type Movement = {
  id: string;
  event_date: string; // ISO date YYYY-MM-DD
  initials: string;
  strain: string;
  batch_id: string;
  product_type: string;
  product_format: string;
  quantity_g: number;
  units: number;
  direction: Direction;
  reason: string;
  detail: string;
  sku: string;
  comment: string;
  created_at?: string;
  updated_at?: string;
};

export type MovementInput = Omit<Movement, "id" | "created_at" | "updated_at">;
