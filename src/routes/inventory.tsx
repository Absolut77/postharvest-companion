import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listMovements, computeInventory } from "@/lib/movements";
import type { Movement } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent,
} from "@/components/ui/dialog";
import {
  AlertTriangle, Search, ArrowDown, ArrowUp, Package,
  Camera, Wind, Droplets, History, Boxes, ChevronLeft, Layers, PlusCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MovementModal } from "@/components/movement-modal";


export const Route = createFileRoute("/inventory")({
  head: () => ({ meta: [{ title: "Bulk Inventory — PostHarvest Companion" }] }),
  component: Inventory,
});

function Inventory() {
  const { data: movements = [], isLoading } = useQuery({
    queryKey: ["movements"],
    queryFn: listMovements,
  });

  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [prefill, setPrefill] = useState<{ batch_id: string; strain: string; comment2: string; direction: "OUT" } | null>(null);

  const handleLogEvent = (batch_id: string, strain: string, qualif: string) => {
    setPrefill({ batch_id, strain, comment2: qualif, direction: "OUT" });
    setModalOpen(true);
  };


  const inventory = useMemo(() => computeInventory(movements), [movements]);

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    const arr = inventory.filter((b) =>
      !s || [b.batch_id, b.strain, b.product_type].some((v) => v.toLowerCase().includes(s))
    );
    return arr.sort((a, b) => b.quantity_g - a.quantity_g);
  }, [inventory, q]);

  const selectedBatch = selected ? inventory.find((b) => b.batch_id === selected) : null;
  const selectedMovements = useMemo(
    () => selected ? movements.filter((m) => m.batch_id === selected) : [],
    [movements, selected]
  );

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1600px]">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Bulk Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Stock restant par lot — calculé automatiquement depuis le Journal.
          </p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un lot…" className="pl-8 h-9" />
        </div>
      </div>

      {isLoading && <div className="text-center py-16 text-muted-foreground">Chargement…</div>}

      {!isLoading && filtered.length === 0 && (
        <Card className="p-10 text-center text-muted-foreground">Aucun lot trouvé.</Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map((b) => {
          const low = b.quantity_g >= 0 && b.quantity_g < 100;
          const neg = b.quantity_g < 0;
          return (
            <button
              key={b.batch_id}
              onClick={() => setSelected(b.batch_id)}
              className={cn(
                "text-left rounded-lg border-2 bg-card p-3 hover:shadow-md hover:border-primary/60 transition",
                neg && "border-red-500/50 bg-red-500/5",
                low && "border-amber-500/50 bg-amber-500/5",
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="font-mono text-xs font-semibold truncate">{b.batch_id}</div>
                {neg ? <Badge variant="destructive" className="text-[10px]">Négatif</Badge>
                  : low ? <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/40 text-[10px]" variant="outline"><AlertTriangle className="h-3 w-3 mr-1" />Faible</Badge>
                  : <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 text-[10px]">OK</Badge>}
              </div>
              <div className="text-sm font-semibold truncate">{b.strain || "—"}</div>
              <div className="text-xs text-muted-foreground truncate">{b.product_type} · {b.product_format}</div>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground">Stock</div>
                  <div className={cn(
                    "text-xl font-mono font-bold",
                    neg && "text-red-600",
                    low && "text-amber-600",
                  )}>
                    {b.quantity_g.toFixed(1)}<span className="text-xs text-muted-foreground ml-1">g</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase text-muted-foreground">Unités</div>
                  <div className="text-sm font-mono">{b.units}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <BatchDetail
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
        stock={selectedBatch}
        movements={selectedMovements}
        onLogEvent={handleLogEvent}
      />

      <MovementModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editing={null}
        movements={movements}
        prefill={prefill ?? undefined}
      />
    </div>
  );
}


// ---------- Detail modal ----------

const SECTIONS = [
  { id: "inventory", label: "Inventaire", icon: Boxes },
  { id: "history", label: "Historique", icon: History },
  { id: "photos", label: "Photos", icon: Camera },
  { id: "curing", label: "Curing", icon: Droplets },
  { id: "drying", label: "Séchage", icon: Wind },
] as const;

type SectionId = typeof SECTIONS[number]["id"];

const QUALIFICATIONS = [
  "Handtrim Flower",
  "Large Flower",
  "Medium Flower",
  "Small Flower",
  "Trim",
] as const;
type Qualification = typeof QUALIFICATIONS[number];

/** Détecte la qualification depuis Comment #2 (fallback: Comment #1 / product_type). */
function detectQualification(m: Movement): Qualification | null {
  const hay = `${m.comment2} ${m.comment1} ${m.product_type}`.toLowerCase();
  if (/hand[\s-]?trim/.test(hay)) return "Handtrim Flower";
  if (/large/.test(hay)) return "Large Flower";
  if (/medium|\bmed\b/.test(hay)) return "Medium Flower";
  if (/small/.test(hay)) return "Small Flower";
  if (/trim/.test(hay)) return "Trim";
  return null;
}

/** Taille de sac standard par qualification (en g). Trim = 1500 g, fleurs = 1000 g. */
function bagSizeFor(q: Qualification): number {
  return q === "Trim" ? 1500 : 1000;
}

type BagEntry = { grams: number; units: number };

type BagBreakdown = {
  bagSize: number;
  fullBags: number;
  remainders: number[];
};

/**
 * Décompose une liste d'entrées "In from Cultivation" en sacs.
 * Règle métier : la colonne Units = nombre total de sacs de l'entrée.
 * Décomposition : (units - 1) sacs pleins de `bagSize` g + 1 sac du reste.
 * Si units ≤ 1, on considère toute la quantité comme un seul sac.
 */
function decomposeBags(entries: BagEntry[], bagSize: number): BagBreakdown {
  let full = 0;
  const remainders: number[] = [];
  for (const { grams, units } of entries) {
    if (grams <= 0) continue;
    const u = Math.max(1, Math.round(units || 1));
    if (u === 1) {
      remainders.push(+grams.toFixed(2));
      continue;
    }
    const fullThis = u - 1;
    const rem = +(grams - fullThis * bagSize).toFixed(2);
    full += fullThis;
    if (rem > 0.001) remainders.push(rem);
    else full += 1;
  }
  return { bagSize, fullBags: full, remainders };
}


function BatchDetail({
  open, onOpenChange, stock, movements, onLogEvent,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  stock: ReturnType<typeof computeInventory>[number] | null | undefined;
  movements: Movement[];
  onLogEvent: (batchId: string, strain: string, qualif: Qualification) => void;
}) {
  const [section, setSection] = useState<SectionId>("inventory");
  const [qualif, setQualif] = useState<"__all__" | Qualification>("__all__");

  // Hooks TOUJOURS appelés dans le même ordre.
  const byQualif = useMemo(() => {
    type Bucket = {
      incomingEntries: BagEntry[]; // {grams, units} des IN "In from Cultivation"
      incomingG: number;
      returnsG: number;          // Back from Packaging / Sampling / Rework
      outsG: number;             // toutes les sorties
      inEntries: Movement[];     // pour l'affichage détaillé
    };
    const map = new Map<Qualification, Bucket>();
    for (const q of QUALIFICATIONS) {
      map.set(q, { incomingEntries: [], incomingG: 0, returnsG: 0, outsG: 0, inEntries: [] });
    }

    for (const m of movements) {
      const q = detectQualification(m);
      if (!q) continue;
      const bucket = map.get(q)!;
      const grams = Number(m.quantity_g);
      const units = Number(m.units);
      if (m.direction === "IN") {
        if (/in from cultivation/i.test(m.reason)) {
          bucket.incomingEntries.push({ grams, units });
          bucket.incomingG += grams;
          bucket.inEntries.push(m);
        } else {
          // Back from Packaging / Sampling / Rework / External
          bucket.returnsG += grams;
        }
      } else {
        bucket.outsG += grams;
      }
    }
    return map;
  }, [movements]);

  const totalNet = Array.from(byQualif.values()).reduce(
    (s, v) => s + (v.incomingG + v.returnsG - v.outsG), 0,
  );

  // Rendu conditionnel APRÈS que tous les hooks ont été déclarés.
  if (!stock) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent />
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] p-0 overflow-hidden">
        <div className="flex h-[85vh]">
          {/* Sidebar */}
          <aside className="w-56 shrink-0 border-r bg-muted/40 flex flex-col">
            <div className="p-4 border-b">

              <div className="flex items-center gap-2 mb-1">
                <Package className="h-4 w-4 text-primary" />
                <div className="text-xs uppercase text-muted-foreground font-semibold">Variété</div>
              </div>
              <div className="text-lg font-bold leading-tight">{stock.strain || "—"}</div>
              <div className="font-mono text-xs text-muted-foreground mt-1">{stock.batch_id}</div>
            </div>
            <nav className="p-2 space-y-1 flex-1">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSection(s.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition",
                      section === s.id
                        ? "bg-primary text-primary-foreground font-medium"
                        : "hover:bg-accent text-foreground/80",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {s.label}
                  </button>
                );
              })}
            </nav>
            <div className="p-3 border-t bg-background/50 space-y-2">
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">Stock total</div>
                <div className={cn(
                  "text-xl font-mono font-bold",
                  stock.quantity_g < 0 && "text-red-600",
                  stock.quantity_g < 100 && stock.quantity_g >= 0 && "text-amber-600",
                )}>{stock.quantity_g.toFixed(1)} g</div>
                <div className="text-xs text-muted-foreground">{stock.units} unités · {stock.movements} mvts</div>
              </div>
              {(() => {
                // Compte le stock en attente de retour : chaque catégorie temporaire (Packaging / Sampling / Rework)
                // est soldée par ses IN "Back from ..." correspondants.
                const cats: Array<{ key: string; outRe: RegExp; inRe: RegExp; label: string }> = [
                  { key: "packaging", outRe: /out\s*for\s*packaging/i, inRe: /back\s*from\s*packaging/i, label: "Packaging" },
                  { key: "sampling",  outRe: /out\s*for\s*sampling/i,  inRe: /back\s*from\s*sampling/i,  label: "Sampling" },
                  { key: "rework",    outRe: /out\s*for\s*rework/i,    inRe: /back\s*from\s*rework/i,    label: "Rework" },
                ];
                const balances = cats.map((c) => {
                  const out = movements
                    .filter((m) => m.direction === "OUT" && c.outRe.test(m.reason))
                    .reduce((s, m) => s + Number(m.quantity_g), 0);
                  const back = movements
                    .filter((m) => m.direction === "IN" && c.inRe.test(m.reason))
                    .reduce((s, m) => s + Number(m.quantity_g), 0);
                  return { ...c, net: out - back };
                }).filter((b) => b.net > 0.01);
                if (balances.length === 0) return null;
                const total = balances.reduce((s, b) => s + b.net, 0);
                return (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] uppercase text-amber-700 font-semibold">En cours — retour attendu</div>
                      <div className="text-sm font-mono font-bold text-amber-800">{total.toFixed(1)} g</div>
                    </div>
                    {balances.map((b) => (
                      <div key={b.key} className="flex items-center justify-between text-[11px] text-amber-800">
                        <span>{b.label}</span>
                        <span className="font-mono">{b.net.toFixed(1)} g</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </aside>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {section === "inventory" && (
              <InventorySection
                byQualif={byQualif}
                qualif={qualif}
                setQualif={setQualif}
                totalNet={totalNet}
                onLogEvent={(q) => onLogEvent(stock.batch_id, stock.strain, q)}
              />
            )}
            {section === "history" && <HistorySection movements={movements} />}
            {section === "photos" && <Placeholder icon={Camera} title="Photos" msg="Module photo à venir." />}
            {section === "curing" && <Placeholder icon={Droplets} title="Curing" msg="Aucun relevé de curing pour ce lot." />}
            {section === "drying" && <Placeholder icon={Wind} title="Séchage" msg="Aucun relevé de séchage pour ce lot." />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InventorySection({
  byQualif, qualif, setQualif, totalNet, onLogEvent,
}: {
  byQualif: Map<Qualification, {
    incomingEntries: BagEntry[];
    incomingG: number;
    returnsG: number;
    outsG: number;
    inEntries: Movement[];
  }>;
  qualif: "__all__" | Qualification;
  setQualif: (q: "__all__" | Qualification) => void;
  totalNet: number;
  onLogEvent: (qualif: Qualification) => void;
}) {
  if (qualif === "__all__") {
    const activeQualifs = QUALIFICATIONS.filter((q) => {
      const b = byQualif.get(q)!;
      return b.incomingG > 0 || b.returnsG > 0 || b.outsG > 0;
    });
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <Layers className="h-5 w-5" /> Inventaire par qualification
            </h3>
            <p className="text-xs text-muted-foreground">
              Stock net calculé depuis le Journal (In from Cultivation − sorties + retours).
            </p>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase text-muted-foreground">Stock net total</div>
            <div className="text-2xl font-mono font-bold">{totalNet.toFixed(1)} g</div>
          </div>
        </div>

        {activeQualifs.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Aucune entrée "In from Cultivation" avec qualification pour ce lot.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeQualifs.map((q) => {
              const b = byQualif.get(q)!;
              const net = b.incomingG + b.returnsG - b.outsG;
              const bags = decomposeBags(b.incomingEntries, bagSizeFor(q));
              const totalBags = bags.fullBags + bags.remainders.length;
              return (
                <button
                  key={q}
                  onClick={() => setQualif(q)}
                  className={cn(
                    "text-left rounded-lg border p-3 hover:border-primary hover:shadow-sm transition",
                    net < 0 && "border-red-500/50 bg-red-500/5",
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold">{q}</div>
                    <div className={cn(
                      "font-mono text-sm font-bold",
                      net < 0 && "text-red-600",
                    )}>
                      {net.toFixed(1)} g
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {totalBags} sac{totalBags > 1 ? "s" : ""} à l'entrée · reçu {b.incomingG.toFixed(1)} g
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {formatBags(bags)}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const b = byQualif.get(qualif)!;
  const net = b.incomingG + b.returnsG - b.outsG;
  const bags = decomposeBags(b.incomingEntries, bagSizeFor(qualif));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setQualif("__all__")}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Retour
        </button>
        <Button size="sm" onClick={() => onLogEvent(qualif)} className="shadow">
          <PlusCircle className="h-4 w-4 mr-1" /> Utiliser ces {qualif} — Loguer un événement
        </Button>
      </div>
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">{qualif}</h3>
        <div className="text-right">
          <div className="text-[10px] uppercase text-muted-foreground">Stock net</div>
          <div className={cn(
            "text-xl font-mono font-bold",
            net < 0 && "text-red-600",
          )}>{net.toFixed(2)} g</div>
        </div>
      </div>


      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3">
          <div className="text-[10px] uppercase text-muted-foreground">Reçu (Cultivation)</div>
          <div className="text-lg font-mono font-bold">{b.incomingG.toFixed(1)} g</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] uppercase text-muted-foreground">Retours</div>
          <div className="text-lg font-mono font-bold text-emerald-700">+{b.returnsG.toFixed(1)} g</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] uppercase text-muted-foreground">Sorties</div>
          <div className="text-lg font-mono font-bold text-red-700">−{b.outsG.toFixed(1)} g</div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="text-sm font-semibold mb-2">
          Décomposition en sacs ({bags.fullBags + bags.remainders.length} total)
        </div>
        <div className="text-sm font-mono">{formatBags(bags)}</div>
        <div className="text-xs text-muted-foreground mt-2">
          Décomposition dérivée de la colonne <strong>Units</strong> du Journal :
          par entrée, (Units − 1) sacs pleins de {bagSizeFor(qualif)} g + 1 sac du reste.
        </div>
      </Card>


      {b.inEntries.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Aucune entrée "In from Cultivation" pour cette qualification.
        </Card>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="text-left">
                <th className="px-3 py-2 border-b text-xs font-semibold">#</th>
                <th className="px-3 py-2 border-b text-xs font-semibold">Date</th>
                <th className="px-3 py-2 border-b text-xs font-semibold text-right">Poids (g)</th>
                <th className="px-3 py-2 border-b text-xs font-semibold text-right">Sacs</th>
                <th className="px-3 py-2 border-b text-xs font-semibold">Commentaire</th>
              </tr>
            </thead>
            <tbody>
              {b.inEntries.map((m, i) => {
                const g = Number(m.quantity_g);
                const eb = decomposeBags([{ grams: g, units: Number(m.units) }], bagSizeFor(qualif));
                return (
                  <tr key={m.id} className={cn("border-b", i % 2 && "bg-muted/20")}>
                    <td className="px-3 py-1.5 font-mono text-xs">#{i + 1}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{m.event_date}</td>
                    <td className="px-3 py-1.5 font-mono text-right">{g.toFixed(2)}</td>
                    <td className="px-3 py-1.5 text-xs text-right">{formatBags(eb)}</td>
                    <td className="px-3 py-1.5 text-xs text-muted-foreground truncate max-w-[240px]" title={m.comment1}>{m.comment1}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatBags(b: BagBreakdown): string {
  const parts: string[] = [];
  if (b.fullBags > 0) parts.push(`${b.fullBags} sac${b.fullBags > 1 ? "s" : ""} de ${b.bagSize} g`);
  for (const r of b.remainders) parts.push(`1 sac de ${r.toFixed(0)} g`);
  return parts.length ? parts.join(" + ") : "—";
}



function HistorySection({ movements }: { movements: Movement[] }) {
  const sorted = [...movements].sort((a, b) => b.event_date.localeCompare(a.event_date));
  return (
    <div className="space-y-3">
      <h3 className="text-xl font-semibold flex items-center gap-2">
        <History className="h-5 w-5" /> Historique des mouvements
      </h3>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr className="text-left">
              <th className="px-2 py-1.5 border-b text-xs">Date</th>
              <th className="px-2 py-1.5 border-b text-xs">Init.</th>
              <th className="px-2 py-1.5 border-b text-xs">Dir.</th>
              <th className="px-2 py-1.5 border-b text-xs text-right">Qté (g)</th>
              <th className="px-2 py-1.5 border-b text-xs text-right">U</th>
              <th className="px-2 py-1.5 border-b text-xs">Destination</th>
              <th className="px-2 py-1.5 border-b text-xs">Commentaire</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m, i) => (
              <tr key={m.id} className={cn("border-b", i % 2 && "bg-muted/20")}>
                <td className="px-2 py-1 font-mono text-xs">{m.event_date}</td>
                <td className="px-2 py-1 font-mono text-xs font-semibold">{m.initials}</td>
                <td className="px-2 py-1">
                  {m.direction === "IN"
                    ? <span className="inline-flex items-center gap-1 text-emerald-700 text-xs"><ArrowDown className="h-3 w-3" />IN</span>
                    : <span className="inline-flex items-center gap-1 text-red-700 text-xs"><ArrowUp className="h-3 w-3" />OUT</span>}
                </td>
                <td className="px-2 py-1 font-mono text-right">{Number(m.quantity_g).toFixed(2)}</td>
                <td className="px-2 py-1 font-mono text-right">{m.units}</td>
                <td className="px-2 py-1 text-xs">{m.destination || m.reason}</td>
                <td className="px-2 py-1 text-xs text-muted-foreground truncate max-w-[200px]" title={m.comment1}>{m.comment1}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Placeholder({ icon: Icon, title, msg }: { icon: any; title: string; msg: string }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xl font-semibold flex items-center gap-2"><Icon className="h-5 w-5" /> {title}</h3>
      <Card className="p-10 text-center text-sm text-muted-foreground">{msg}</Card>
    </div>
  );
}
