import { useSyncExternalStore } from "react";

const KEY = "phc:initials";
const listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }

export function setCurrentUser(v: string) {
  const clean = v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  if (typeof window !== "undefined") localStorage.setItem(KEY, clean);
  emit();
}

function getSnapshot(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(KEY) ?? "";
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) l(); };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(l); window.removeEventListener("storage", onStorage); };
}

export function useCurrentUser() {
  return useSyncExternalStore(subscribe, getSnapshot, () => "");
}
