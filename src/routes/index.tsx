import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listMovements, computeInventory } from "@/lib/movements";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertTriangle, Boxes, ClipboardList, TrendingDown, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard — PostHarvest Companion" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: movements = [], isLoading } = useQuery({
    queryKey: ["movements"],
    queryFn: listMovements,
  });

  const inventory = computeInventory(movements);
  const totalGrams = inventory.reduce((s, b) => s + b.quantity_g, 0);
  const lowStock = inventory.filter((b) => b.quantity_g > 0 && b.quantity_g < 100);
  const negative = inventory.filter((b) => b.quantity_g < 0);
  const activeLots = inventory.filter((b) => b.quantity_g > 0).length;

  const today = new Date().toISOString().slice(0, 10);
  const inToday = movements.filter((m) => m.event_date === today && m.direction === "IN").length;
  const outToday = movements.filter((m) => m.event_date === today && m.direction === "OUT").length;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Vue d'ensemble de l'inventaire calculé depuis le Log 2026.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/inventory"><Boxes className="h-4 w-4 mr-1" /> Bulk Inventory</Link></Button>
          <Button asChild><Link to="/journal"><ClipboardList className="h-4 w-4 mr-1" /> Ouvrir le Journal</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Stock total" value={`${totalGrams.toFixed(0)} g`} sub={`${activeLots} lots actifs`} />
        <StatCard label="Événements" value={String(movements.length)} sub={`${inToday} IN · ${outToday} OUT aujourd'hui`} />
        <StatCard
          label="Stock faible"
          value={String(lowStock.length)}
          sub="< 100 g"
          tone={lowStock.length ? "warn" : undefined}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <StatCard
          label="Stock négatif"
          value={String(negative.length)}
          sub="À vérifier"
          tone={negative.length ? "danger" : undefined}
          icon={<TrendingDown className="h-4 w-4" />}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Inventaire par lot</h2>
            <p className="text-xs text-muted-foreground">Calculé automatiquement · IN – OUT depuis le Journal</p>
          </div>
          <Button asChild variant="ghost" size="sm"><Link to="/inventory">Voir tout →</Link></Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-3 py-2 border-b font-semibold">Lot</th>
                <th className="px-3 py-2 border-b font-semibold">Strain</th>
                <th className="px-3 py-2 border-b font-semibold">Type</th>
                <th className="px-3 py-2 border-b font-semibold">Format</th>
                <th className="px-3 py-2 border-b font-semibold text-right">Stock (g)</th>
                <th className="px-3 py-2 border-b font-semibold text-right">Unités</th>
                <th className="px-3 py-2 border-b font-semibold">Statut</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">Chargement…</td></tr>}
              {!isLoading && inventory.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">Aucun lot</td></tr>}
              {inventory.slice(0, 15).map((b, i) => (
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
        {inventory.length > 15 && (
          <div className="p-3 text-center border-t bg-muted/20">
            <Button asChild variant="outline" size="sm"><Link to="/inventory">Voir les {inventory.length} lots</Link></Button>
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({ label, value, sub, tone, icon }: { label: string; value: string; sub?: string; tone?: "warn" | "danger"; icon?: React.ReactNode }) {
  return (
    <Card className={cn("p-4",
      tone === "warn" && "border-amber-500/50 bg-amber-500/5",
      tone === "danger" && "border-red-500/50 bg-red-500/5",
    )}>
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>{icon}
      </div>
      <div className="mt-1 text-2xl font-bold font-mono">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );
}
