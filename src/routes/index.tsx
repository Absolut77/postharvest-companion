import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useStore, batchSummaries } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Boxes, ArrowUpFromLine, ArrowDownToLine, FlaskConical, Package } from "lucide-react";

export const Route = createFileRoute("/")({ component: Dashboard });

function Stat({ icon: Icon, label, value, sub, color }: any) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-md grid place-items-center ${color}`}><Icon className="h-5 w-5" /></div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-semibold font-mono">{value}</div>
          {sub && <div className="text-xs text-muted-foreground truncate">{sub}</div>}
        </div>
      </div>
    </Card>
  );
}

function Dashboard() {
  const { movements, preOrders } = useStore();
  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todayMoves = movements.filter((m) => new Date(m.date).toDateString() === today);
    const totalIn = movements.filter(m => m.type === "IN").reduce((s, m) => s + m.quantity, 0);
    const totalOut = movements.filter(m => m.type === "OUT").reduce((s, m) => s + m.quantity, 0);
    const batches = batchSummaries(movements);
    const totalStock = batches.reduce((s, b) => s + b.quantity, 0);
    return { todayCount: todayMoves.length, totalIn, totalOut, totalStock, batches, preCount: preOrders.length };
  }, [movements, preOrders]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground">Vue d'ensemble en temps réel</p>
        </div>
        <Link to="/journal" className="text-sm text-primary hover:underline">Ouvrir le Journal →</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Boxes} label="Stock total (bulk)" value={`${stats.totalStock.toFixed(0)} g`} sub={`${stats.batches.length} lots actifs`} color="bg-primary/10 text-primary" />
        <Stat icon={ArrowDownToLine} label="Entrées cumulées" value={`${stats.totalIn.toFixed(0)} g`} color="bg-emerald-500/10 text-emerald-600" />
        <Stat icon={ArrowUpFromLine} label="Sorties cumulées" value={`${stats.totalOut.toFixed(0)} g`} color="bg-red-500/10 text-red-600" />
        <Stat icon={FlaskConical} label="Mouvements aujourd'hui" value={stats.todayCount} sub={`${stats.preCount} pré-commandes`} color="bg-amber-500/10 text-amber-600" />
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2"><Package className="h-4 w-4" /> Inventaire par lot</h2>
          <Link to="/journal" className="text-xs text-primary hover:underline">Détails →</Link>
        </div>
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="text-left">
                <th className="px-3 py-2 font-semibold">Lot</th>
                <th className="px-3 py-2 font-semibold">Strain</th>
                <th className="px-3 py-2 font-semibold">Format</th>
                <th className="px-3 py-2 font-semibold text-right">Stock (g)</th>
                <th className="px-3 py-2 font-semibold text-right">Mouvements</th>
              </tr>
            </thead>
            <tbody>
              {stats.batches.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">Aucun lot enregistré</td></tr>}
              {stats.batches.map((b, i) => (
                <tr key={b.batchId} className={i % 2 ? "bg-muted/20" : ""}>
                  <td className="px-3 py-1.5 font-mono">{b.batchId}</td>
                  <td className="px-3 py-1.5">{b.strain}</td>
                  <td className="px-3 py-1.5">{b.format}</td>
                  <td className="px-3 py-1.5 font-mono text-right font-semibold">{b.quantity.toFixed(2)}</td>
                  <td className="px-3 py-1.5 font-mono text-right text-muted-foreground">{b.movements}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
