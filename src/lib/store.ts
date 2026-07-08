import { useSyncExternalStore } from "react";
import type { Store, Movement, PreOrder, CuringLog, HarvestLog } from "./types";

const KEY = "postharvest-central-v1";

const defaultStore: Store = {
  movements: [],
  preOrders: [],
  curing: [],
  harvest: [],
  strains: ["Blue Dream", "OG Kush", "Wedding Cake", "Gelato", "Northern Lights"],
  batches: [],
  currentUser: "",
};

let state: Store = defaultStore;
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = { ...defaultStore, ...JSON.parse(raw) };
  } catch {}
}

function persist() {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(state));
}

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot(): Store {
  hydrate();
  return state;
}

function getServerSnapshot(): Store {
  return defaultStore;
}

export function useStore(): Store {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export const actions = {
  setUser(u: string) {
    state = { ...state, currentUser: u };
    persist();
    emit();
  },
  addMovement(m: Omit<Movement, "id">) {
    const movement: Movement = { ...m, id: crypto.randomUUID() };
    const batches = state.batches.includes(m.batchId)
      ? state.batches
      : [...state.batches, m.batchId].filter(Boolean);
    const strains = state.strains.includes(m.strain)
      ? state.strains
      : [...state.strains, m.strain].filter(Boolean);
    state = { ...state, movements: [movement, ...state.movements], batches, strains };
    persist();
    emit();
    return movement;
  },
  updateMovement(id: string, patch: Partial<Movement>) {
    state = {
      ...state,
      movements: state.movements.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    };
    persist();
    emit();
  },
  deleteMovement(id: string) {
    state = { ...state, movements: state.movements.filter((m) => m.id !== id) };
    persist();
    emit();
  },
  addPreOrder(p: Omit<PreOrder, "id">) {
    state = { ...state, preOrders: [{ ...p, id: crypto.randomUUID() }, ...state.preOrders] };
    persist();
    emit();
  },
  updatePreOrder(id: string, patch: Partial<PreOrder>) {
    state = {
      ...state,
      preOrders: state.preOrders.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    };
    persist();
    emit();
  },
  deletePreOrder(id: string) {
    state = { ...state, preOrders: state.preOrders.filter((p) => p.id !== id) };
    persist();
    emit();
  },
  addCuring(c: Omit<CuringLog, "id">) {
    state = { ...state, curing: [{ ...c, id: crypto.randomUUID() }, ...state.curing] };
    persist();
    emit();
  },
  deleteCuring(id: string) {
    state = { ...state, curing: state.curing.filter((c) => c.id !== id) };
    persist();
    emit();
  },
  addHarvest(h: Omit<HarvestLog, "id">) {
    state = { ...state, harvest: [{ ...h, id: crypto.randomUUID() }, ...state.harvest] };
    persist();
    emit();
  },
  deleteHarvest(id: string) {
    state = { ...state, harvest: state.harvest.filter((h) => h.id !== id) };
    persist();
    emit();
  },
  seedDemo() {
    if (state.movements.length > 0) return;
    const now = new Date();
    const iso = (d: Date) => d.toISOString();
    const mk = (o: Partial<Movement>): Movement => ({
      id: crypto.randomUUID(),
      date: iso(now),
      initials: "AB",
      strain: "Blue Dream",
      batchId: "BD-2601",
      productType: "Fleur",
      productFormat: "Bulk",
      quantity: 0,
      units: 1,
      type: "IN",
      destination: "Réception",
      comment: "",
      category: null,
      ...o,
    });
    state = {
      ...state,
      batches: ["BD-2601", "OGK-2603", "WC-2610"],
      movements: [
        mk({ batchId: "BD-2601", strain: "Blue Dream", quantity: 5000, type: "IN", destination: "Réception" }),
        mk({ batchId: "OGK-2603", strain: "OG Kush", quantity: 3200, type: "IN", destination: "Réception", initials: "MJ" }),
        mk({ batchId: "WC-2610", strain: "Wedding Cake", quantity: 4100, type: "IN", destination: "Réception", initials: "AB" }),
        mk({ batchId: "BD-2601", strain: "Blue Dream", quantity: 30, type: "OUT", destination: "Sortie pour Échantillonnage", productFormat: "Sample", initials: "MJ", category: "internal-sample" }),
        mk({ batchId: "BD-2601", strain: "Blue Dream", quantity: 28, type: "IN", destination: "Retour d'Échantillonnage", productFormat: "Sample", initials: "MJ", category: "internal-sample" }),
      ],
    };
    persist();
    emit();
  },
};

export function computeBatchStock(movements: Movement[], batchId: string): number {
  return movements
    .filter((m) => m.batchId === batchId)
    .reduce((s, m) => s + (m.type === "IN" ? m.quantity : -m.quantity), 0);
}

export function batchSummaries(movements: Movement[]) {
  const map = new Map<string, { batchId: string; strain: string; format: string; quantity: number; movements: number }>();
  for (const m of movements) {
    const cur = map.get(m.batchId) || { batchId: m.batchId, strain: m.strain, format: m.productFormat, quantity: 0, movements: 0 };
    cur.quantity += m.type === "IN" ? m.quantity : -m.quantity;
    cur.movements += 1;
    cur.strain = m.strain || cur.strain;
    cur.format = m.productFormat || cur.format;
    map.set(m.batchId, cur);
  }
  return Array.from(map.values()).sort((a, b) => a.batchId.localeCompare(b.batchId));
}
