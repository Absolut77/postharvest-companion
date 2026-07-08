import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useStore, batchSummaries } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { downloadCSV } from "@/lib/constants";
import { Download } from "lucide-react";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Rapports — PostHarvest Central" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const { movements, harvest } = useStore();
  const summary = useMemo(() => batchSummaries(movements), [movements]);

  const yields = useMemo(() =>
    harvest.filter(h => h.wetWeight && h.dryWeight).map(h => ({
      batchId: h.batchId, strain: h.strain,
      wet: h.wetWeight!, dry: h.dryWeight!,
      pct: (h.dryWeight! / h.wetWeight!) * 100,
    })), [harvest]);

  const exportAll = () => {
    downloadCSV("posthavest-full-export.csv", [
      ["Date", "Init", "Type", "Strain", "Lot", "Format", "Qté (g)", "Unités", "Destination", "Comment"],
      ...movements.map(m => [new Date(m.date).toISOString(), m.initials, m.type, m.strain, m.batchId, m.productFormat, m.quantity, m.units, m.destination, m.comment || ""]),
    ]);
  };

  const exportInventory = () => {
    downloadCSV("inventory.csv", [
      ["Lot", "Strain", "Format", "Stock (g)", "Mouvements"],
      ...summary.map(s => [s.batchId, s.strain, s.format, s.quantity, s.movements]),
    ]);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Rapports</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold">Résumé inventaire</h2>
            <Button size="sm" variant="outline" onClick={exportInventory}><Download className="h-4 w-4 mr-1" /> CSV</Button>
          </div>
          <div className="text-sm space-y-1 max-h-96 overflow-auto">
            {summary.map(s => (
              <div key={s.batchId} className="flex justify-between border-b py-1">
                <span className="font-mono">{s.batchId}</span>
                <span className="text-muted-foreground">{s.strain}</span>
                <span className="font-mono font-semibold">{s.quantity.toFixed(2)}g</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold">Rendements récolte</h2>
          </div>
          <div className="text-sm space-y-1 max-h-96 overflow-auto">
            {yields.length === 0 && <div className="text-muted-foreground text-center py-8">Pas de données</div>}
            {yields.map((y, i) => (
              <div key={i} className="flex justify-between border-b py-1">
                <span className="font-mono">{y.batchId}</span>
                <span>{y.wet}g → {y.dry}g</span>
                <span className="font-mono font-semibold text-emerald-600">{y.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="font-semibold">Export complet des mouvements</h2>
            <p className="text-sm text-muted-foreground">Toutes les lignes du Log 2026 au format CSV.</p>
          </div>
          <Button onClick={exportAll}><Download className="h-4 w-4 mr-1" /> Exporter tout</Button>
        </div>
      </Card>
    </div>
  );
}
