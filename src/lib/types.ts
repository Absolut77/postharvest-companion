export type Direction = "IN" | "OUT";

export type Movement = {
  id: string;
  event_date: string;
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
  destination: string;
  comment1: string;
  comment2: string;
  adjustment_validation: boolean;
  stamp_used: string;
  stamp_type: string;
  additional_comments: string;
  elevated_update: boolean;
  created_at?: string;
  updated_at?: string;
};

export type MovementInput = Omit<Movement, "id" | "created_at" | "updated_at">;
