import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listMovements, computeInventory } from "@/lib/movements";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { AlertTriangle, Search } from "lucide-react";
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
  const [format, setFormat] = useState("all");
  const [status, setStatus] = useState<"all" | "low" | "neg" | "ok">("all");

  const inventory = useMemo(() => computeInventory(movements), [movements]);
  const formats = useMemo(() => Array.from(new Set(inventory.map((b) => b.product_format).filter(Boolean))).sort(), [inventory]);

  const rows = useMemo(() => {
    const s = q.toLowerCase().trim();
    return inventory.filter((b) => {
      if (s && ![b.batch_id, b.strain, b.product_type].some((v) => v.toLowerCase().includes(s))) return false;
      if (format !== "all" && b.product_format !== format) return false;
      if (status === "low" && !(b.quantity_g >= 0 && b.quantity_g < 100)) return false;
      if (status === "neg" && !(b.quantity_g < 0)) return false;
      if (status === "ok" && !(b.quantity_g >= 100)) return false;
      return true;
    }).sort((a, b) => b.quantity_g - a.quantity_g);
  }, [inventory, q, format, status]);

  const total = rows.reduce((s, r) => s + r.quantity_g, 0);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px]">
      <div>
        <h1 className="text-2xl font-semibold">Bulk Inventory</h1>
        <p className="text-sm text-muted-foreground">Stock restant par lot — calculé depuis le Journal (IN – OUT).</p>
      </div>

      <Card className="p-3 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <Label className="text-xs">Rechercher</Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Lot, strain, type…" className="pl-8 h-9" />
          </div>
        </div>
        <div>
          <Label className="text-xs">Format</Label>
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              {formats.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Statut</Label>
          <Select value={status} onValueChange={(v: any) => setStatus(v)}>
            <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="ok">OK (≥ 100g)</SelectItem>
              <SelectItem value="low">Faible (&lt; 100g)</SelectItem>
              <SelectItem value="neg">Négatif</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {status !== "low" && (
          <Button variant="outline" size="sm" onClick={() => setStatus("low")}>
            <AlertTriangle className="h-4 w-4 mr-1" /> Stock faible
          </Button>
        )}
        <div className="ml-auto text-right">
          <div className="text-xs text-muted-foreground">Total filtré</div>
          <div className="text-lg font-mono font-semibold">{total.toFixed(2)} g</div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="text-left">
                <th className="px-3 py-2 border-b font-semibold">Lot</th>
                <th className="px-3 py-2 border-b font-semibold">Strain</th>
                <th className="px-3 py-2 border-b font-semibold">Type</th>
                <th className="px-3 py-2 border-b font-semibold">Format</th>
                <th className="px-3 py-2 border-b font-semibold text-right">Stock (g)</th>
                <th className="px-3 py-2 border-b font-semibold text-right">Unités</th>
                <th className="px-3 py-2 border-b font-semibold text-right">Mouvements</th>
                <th className="px-3 py-2 border-b font-semibold">Dernière activité</th>
                <th className="px-3 py-2 border-b font-semibold">Statut</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">Chargement…</td></tr>}
              {!isLoading && rows.length === 0 && <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">Aucun lot</td></tr>}
              {rows.map((b, i) => (
                <tr key={b.batch_id} className={cn("border-b hover:bg-accent/40", i % 2 && "bg-muted/20")}>
                  <td className="px-3 py-1.5 font-mono">{b.batch_id}</td>
                  <td className="px-3 py-1.5">{b.strain}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{b.product_type}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{b.product_format}</td>
                  <td className={cn("px-3 py-1.5 font-mono text-right font-semibold",
                    b.quantity_g < 0 && "text-red-600",
                    b.quantity_g < 100 && b.quantity_g >= 0 && "text-amber-600"
                  )}>{b.quantity_g.toFixed(2)}</td>
                  <td className="px-3 py-1.5 font-mono text-right">{b.units}</td>
                  <td className="px-3 py-1.5 font-mono text-right text-muted-foreground">{b.movements}</td>
                  <td className="px-3 py-1.5 font-mono text-xs">{b.last_date}</td>
                  <td className="px-3 py-1.5">
                    {b.quantity_g < 0
                      ? <Badge variant="destructive">Négatif</Badge>
                      : b.quantity_g < 100
                      ? <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/40" variant="outline">Faible</Badge>
                      : <Badge variant="outline" className="border-emerald-500/40 text-emerald-700">OK</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
