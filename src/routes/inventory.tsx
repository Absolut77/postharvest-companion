import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listMovements, computeInventory } from "@/lib/movements";
import type { Movement } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent,
} from "@/components/ui/dialog";
import {
  AlertTriangle, Search, ArrowDown, ArrowUp, Package,
  Camera, Wind, Droplets, History, Boxes, ChevronLeft, Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

const CATEGORIES = ["Big Hand Trim", "Big", "Medium", "Small", "Trim", "Sample", "Rétention"] as const;
type Category = typeof CATEGORIES[number];

/** Catégorise un mouvement en cherchant des mots-clés dans product_type/format/comments. */
function categorize(m: Movement): Category {
  const hay = [
    m.product_type, m.product_format, m.comment1, m.comment2,
    m.additional_comments, m.destination, m.reason,
  ].join(" ").toLowerCase();
  if (/retention|rétention/.test(hay)) return "Rétention";
  if (/big.*hand.*trim/.test(hay)) return "Big Hand Trim";
  if (/sample|échantillon|echantillon/.test(hay)) return "Sample";
  if (/\btrim\b/.test(hay)) return "Trim";
  if (/\bmedium\b|\bmed\b/.test(hay)) return "Medium";
  if (/\bsmall\b/.test(hay)) return "Small";
  if (/\bbig\b/.test(hay)) return "Big";
  return "Big"; // défaut : bulk = Big
}

function BatchDetail({
  open, onOpenChange, stock, movements,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  stock: ReturnType<typeof computeInventory>[number] | null | undefined;
  movements: Movement[];
}) {
  const [section, setSection] = useState<SectionId>("inventory");
  const [category, setCategory] = useState<"__all__" | Category>("__all__");

  if (!stock) return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent /></Dialog>;

  // Résumé par catégorie basé sur les IN nets (IN - OUT) de chaque catégorie
  const byCategory = useMemo(() => {
    const map = new Map<Category, { sacs: Movement[]; totalG: number; totalU: number }>();
    for (const c of CATEGORIES) map.set(c, { sacs: [], totalG: 0, totalU: 0 });

    // Rétention calculée : samples sortis - samples retournés
    let sampleOut = 0, sampleBack = 0;
    for (const m of movements) {
      const isSample = /sampl|échantillon|echantillon/i.test(
        (m.destination + " " + m.reason + " " + m.comment1 + " " + m.additional_comments)
      );
      if (isSample) {
        if (m.direction === "OUT") sampleOut += Number(m.quantity_g);
        else sampleBack += Number(m.quantity_g);
      }
    }
    const retention = Math.max(0, sampleOut - sampleBack);
    map.get("Rétention")!.totalG = retention;

    // Autres : chaque IN = un sac dans sa catégorie
    for (const m of movements) {
      if (m.direction !== "IN") continue;
      const cat = categorize(m);
      if (cat === "Rétention") continue;
      const bucket = map.get(cat)!;
      bucket.sacs.push(m);
      bucket.totalG += Number(m.quantity_g);
      bucket.totalU += Number(m.units);
    }
    // Retrancher les OUT correspondants (sauf sample déjà comptés en rétention)
    for (const m of movements) {
      if (m.direction !== "OUT") continue;
      const cat = categorize(m);
      if (cat === "Rétention" || cat === "Sample") continue;
      const bucket = map.get(cat)!;
      bucket.totalG -= Number(m.quantity_g);
      bucket.totalU -= Number(m.units);
    }
    return map;
  }, [movements]);

  const totalG = Array.from(byCategory.values()).reduce((s, v) => s + v.totalG, 0);

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
            <div className="p-3 border-t bg-background/50">
              <div className="text-[10px] uppercase text-muted-foreground">Stock total</div>
              <div className={cn(
                "text-xl font-mono font-bold",
                stock.quantity_g < 0 && "text-red-600",
                stock.quantity_g < 100 && stock.quantity_g >= 0 && "text-amber-600",
              )}>{stock.quantity_g.toFixed(1)} g</div>
              <div className="text-xs text-muted-foreground">{stock.units} unités · {stock.movements} mvts</div>
            </div>
          </aside>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {section === "inventory" && (
              <InventorySection
                byCategory={byCategory}
                category={category}
                setCategory={setCategory}
                totalG={totalG}
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
  byCategory, category, setCategory, totalG,
}: {
  byCategory: Map<Category, { sacs: Movement[]; totalG: number; totalU: number }>;
  category: "__all__" | Category;
  setCategory: (c: "__all__" | Category) => void;
  totalG: number;
}) {
  if (category === "__all__") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <Layers className="h-5 w-5" /> Résumé de l'inventaire
            </h3>
            <p className="text-xs text-muted-foreground">Cliquez sur une catégorie pour voir le détail.</p>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase text-muted-foreground">Total catégorisé</div>
            <div className="text-2xl font-mono font-bold">{totalG.toFixed(1)} g</div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {CATEGORIES.map((c) => {
            const b = byCategory.get(c)!;
            const count = c === "Rétention" ? (b.totalG > 0 ? 1 : 0) : b.sacs.length;
            const empty = b.totalG <= 0.001 && count === 0;
            return (
              <button
                key={c}
                onClick={() => setCategory(c)}
                disabled={empty}
                className={cn(
                  "text-left rounded-lg border p-3 hover:border-primary hover:shadow-sm transition",
                  empty && "opacity-40 cursor-not-allowed",
                )}
              >
                <div className="text-sm font-semibold">{c}</div>
                <div className="mt-2 flex items-end justify-between">
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Sacs</div>
                    <div className="text-xl font-mono font-bold">{count}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase text-muted-foreground">Poids</div>
                    <div className="font-mono text-sm">{b.totalG.toFixed(1)} g</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const b = byCategory.get(category)!;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCategory("__all__")}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Retour
        </button>
      </div>
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">{category}</h3>
        <div className="text-right">
          <div className="text-[10px] uppercase text-muted-foreground">Total</div>
          <div className="text-xl font-mono font-bold">{b.totalG.toFixed(2)} g · {b.totalU} u</div>
        </div>
      </div>
      {category === "Rétention" ? (
        <Card className="p-4 text-sm">
          Rétention d'échantillons en cours : <strong className="font-mono">{b.totalG.toFixed(2)} g</strong>.
          <div className="text-xs text-muted-foreground mt-1">
            Calculée à partir des sorties d'échantillonnage non retournées.
          </div>
        </Card>
      ) : b.sacs.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Aucun sac dans cette catégorie.
        </Card>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="text-left">
                <th className="px-3 py-2 border-b text-xs font-semibold">#</th>
                <th className="px-3 py-2 border-b text-xs font-semibold">Date</th>
                <th className="px-3 py-2 border-b text-xs font-semibold">Type</th>
                <th className="px-3 py-2 border-b text-xs font-semibold text-right">Poids (g)</th>
                <th className="px-3 py-2 border-b text-xs font-semibold text-right">Unités</th>
                <th className="px-3 py-2 border-b text-xs font-semibold">Commentaire</th>
              </tr>
            </thead>
            <tbody>
              {b.sacs.map((m, i) => (
                <tr key={m.id} className={cn("border-b", i % 2 && "bg-muted/20")}>
                  <td className="px-3 py-1.5 font-mono text-xs">#{i + 1}</td>
                  <td className="px-3 py-1.5 font-mono text-xs">{m.event_date}</td>
                  <td className="px-3 py-1.5 text-xs">{m.product_type || m.product_format}</td>
                  <td className="px-3 py-1.5 font-mono text-right">{Number(m.quantity_g).toFixed(2)}</td>
                  <td className="px-3 py-1.5 font-mono text-right">{m.units}</td>
                  <td className="px-3 py-1.5 text-xs text-muted-foreground truncate max-w-[240px]" title={m.comment1}>{m.comment1}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
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
