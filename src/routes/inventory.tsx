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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertTriangle, Search, ArrowDown, ArrowUp, Package, Box } from "lucide-react";
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
        batchId={selected}
        stock={selectedBatch}
        movements={selectedMovements}
      />
    </div>
  );
}

function BatchDetail({
  open, onOpenChange, batchId, stock, movements,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  batchId: string | null;
  stock: ReturnType<typeof computeInventory>[number] | null | undefined;
  movements: Movement[];
}) {
  if (!batchId || !stock) return (
    <Dialog open={open} onOpenChange={onOpenChange}><DialogContent /></Dialog>
  );

  const samplesOut = movements
    .filter((m) => m.direction === "OUT" && /sampl/i.test(m.destination + " " + m.reason))
    .reduce((s, m) => s + Number(m.quantity_g), 0);
  const samplesBack = movements
    .filter((m) => m.direction === "IN" && /sampl/i.test(m.destination + " " + m.reason))
    .reduce((s, m) => s + Number(m.quantity_g), 0);
  const retentionOpen = Math.max(0, samplesOut - samplesBack);

  // "Lots disponibles" — SKU/lot dérivés (ex: ONO-xxx) présents dans les mouvements
  const derivedLots = Array.from(new Set(
    movements
      .map((m) => m.sku)
      .filter((s) => s && s.trim().length > 0)
  )).sort();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            <span className="font-mono">{stock.batch_id}</span>
            <span className="text-muted-foreground">·</span>
            <span>{stock.strain}</span>
          </DialogTitle>
          <DialogDescription>{stock.product_type} — {stock.product_format}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3">
            <div className="text-[10px] uppercase text-muted-foreground">Stock (g)</div>
            <div className={cn(
              "text-2xl font-mono font-bold",
              stock.quantity_g < 0 && "text-red-600",
              stock.quantity_g < 100 && stock.quantity_g >= 0 && "text-amber-600",
            )}>{stock.quantity_g.toFixed(2)}</div>
          </Card>
          <Card className="p-3">
            <div className="text-[10px] uppercase text-muted-foreground">Unités</div>
            <div className="text-2xl font-mono font-bold">{stock.units}</div>
          </Card>
          <Card className="p-3">
            <div className="text-[10px] uppercase text-muted-foreground">Mouvements</div>
            <div className="text-2xl font-mono font-bold">{stock.movements}</div>
          </Card>
        </div>

        <Card className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-sm">Échantillons</div>
            <Badge variant={retentionOpen > 0 ? "outline" : "secondary"}
              className={cn(retentionOpen > 0 && "border-amber-500/40 text-amber-700")}>
              {retentionOpen > 0 ? `Rétention en cours: ${retentionOpen.toFixed(2)}g` : "Rétention soldée"}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sortis pour échantillonnage</span>
              <span className="font-mono">{samplesOut.toFixed(2)} g</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Retournés</span>
              <span className="font-mono">{samplesBack.toFixed(2)} g</span>
            </div>
          </div>
        </Card>

        <Tabs defaultValue="photo">
          <TabsList>
            <TabsTrigger value="photo">Photo</TabsTrigger>
            <TabsTrigger value="curing">Curing</TabsTrigger>
            <TabsTrigger value="drying">Séchage</TabsTrigger>
            <TabsTrigger value="history">Historique</TabsTrigger>
          </TabsList>
          <TabsContent value="photo">
            <Card className="p-6 text-center text-muted-foreground text-sm">
              Aucune photo enregistrée. <br />
              <span className="text-xs">(Module photo à venir — le journal reste la source de saisie.)</span>
            </Card>
          </TabsContent>
          <TabsContent value="curing">
            <Card className="p-6 text-center text-muted-foreground text-sm">
              Pas de relevés de curing pour ce lot.
            </Card>
          </TabsContent>
          <TabsContent value="drying">
            <Card className="p-6 text-center text-muted-foreground text-sm">
              Pas de relevés de séchage pour ce lot.
            </Card>
          </TabsContent>
          <TabsContent value="history">
            <Card className="overflow-hidden">
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 sticky top-0">
                    <tr className="text-left">
                      <th className="px-2 py-1.5 border-b">Date</th>
                      <th className="px-2 py-1.5 border-b">Dir.</th>
                      <th className="px-2 py-1.5 border-b text-right">Qté (g)</th>
                      <th className="px-2 py-1.5 border-b text-right">U</th>
                      <th className="px-2 py-1.5 border-b">Destination</th>
                      <th className="px-2 py-1.5 border-b">Commentaire</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.slice().sort((a, b) => b.event_date.localeCompare(a.event_date)).map((m, i) => (
                      <tr key={m.id} className={cn("border-b", i % 2 && "bg-muted/20")}>
                        <td className="px-2 py-1 font-mono">{m.event_date}</td>
                        <td className="px-2 py-1">
                          {m.direction === "IN"
                            ? <span className="inline-flex items-center gap-1 text-emerald-700"><ArrowDown className="h-3 w-3" />IN</span>
                            : <span className="inline-flex items-center gap-1 text-red-700"><ArrowUp className="h-3 w-3" />OUT</span>}
                        </td>
                        <td className="px-2 py-1 font-mono text-right">{Number(m.quantity_g).toFixed(2)}</td>
                        <td className="px-2 py-1 font-mono text-right">{m.units}</td>
                        <td className="px-2 py-1">{m.destination || m.reason}</td>
                        <td className="px-2 py-1 text-muted-foreground truncate max-w-[200px]" title={m.comment1 || m.comment}>{m.comment1 || m.comment}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Box className="h-4 w-4" />
            <div className="font-semibold text-sm">Lots disponibles (SKU)</div>
          </div>
          {derivedLots.length === 0 ? (
            <div className="text-xs text-muted-foreground">Aucun SKU associé pour l'instant.</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {derivedLots.map((s) => (
                <Badge key={s} variant="outline" className="font-mono text-xs">{s}</Badge>
              ))}
            </div>
          )}
        </Card>
      </DialogContent>
    </Dialog>
  );
}
