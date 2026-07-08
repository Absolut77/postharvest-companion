export type MovementType = "IN" | "OUT";

export type Movement = {
  id: string;
  date: string; // ISO
  initials: string;
  strain: string;
  batchId: string;
  productType: string;
  productFormat: string;
  quantity: number; // grams
  units: number;
  type: MovementType;
  destination: string;
  comment?: string;
  category?: "internal-sample" | "external-sample" | "archive" | null;
};

export type PreOrder = {
  id: string;
  date: string;
  initials: string;
  strain: string;
  batchId: string;
  format: string;
  quantity: number;
  units: number;
  dueDate?: string;
  status: "Requested" | "In Progress" | "Fulfilled" | "Cancelled";
  notes?: string;
};

export type CuringLog = {
  id: string;
  date: string;
  batchId: string;
  strain: string;
  humidity?: number;
  temperature?: number;
  day?: number;
  initials: string;
  notes?: string;
};

export type HarvestLog = {
  id: string;
  date: string;
  batchId: string;
  strain: string;
  wetWeight?: number;
  dryWeight?: number;
  packagedUnits?: number;
  initials: string;
  photoDataUrl?: string;
  notes?: string;
};

export type Store = {
  movements: Movement[];
  preOrders: PreOrder[];
  curing: CuringLog[];
  harvest: HarvestLog[];
  strains: string[];
  batches: string[];
  currentUser: string;
};
