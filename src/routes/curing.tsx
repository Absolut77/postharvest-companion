import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore, actions } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/curing")({
  head: () => ({ meta: [{ title: "Curing Logs — PostHarvest Central" }] }),
  component: CuringPage,
});

function CuringPage() {
  const store = useStore();
  const [f, setF] = useState({ batchId: "", strain: "", humidity: "", temperature: "", day: "", notes: "" });

  const submit = () => {
    if (!store.currentUser) return toast.error("Initiales requises");
    if (!f.batchId) return toast.error("Lot requis");
    actions.addCuring({
      date: new Date().toISOString(),
      batchId: f.batchId,
      strain: f.strain,
      humidity: f.humidity ? parseFloat(f.humidity) : undefined,
      temperature: f.temperature ? parseFloat(f.temperature) : undefined,
      day: f.day ? parseInt(f.day, 10) : undefined,
      initials: store.currentUser,
      notes: f.notes,
    });
    toast.success("Entrée curing ajoutée");
    setF({ batchId: "", strain: "", humidity: "", temperature: "", day: "", notes: "" });
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Curing Logs</h1>
      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
        <Card className="p-4 h-fit">
          <h3 className="font-semibold text-sm mb-3">Nouvelle mesure</h3>
          <div className="space-y-2">
            <div><Label className="text-xs">Lot</Label><Input value={f.batchId} onChange={(e) => setF({ ...f, batchId: e.target.value })} className="h-9 font-mono" /></div>
            <div><Label className="text-xs">Strain</Label><Input value={f.strain} onChange={(e) => setF({ ...f, strain: e.target.value })} className="h-9" /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-xs">Jour</Label><Input type="number" value={f.day} onChange={(e) => setF({ ...f, day: e.target.value })} className="h-9" /></div>
              <div><Label className="text-xs">RH %</Label><Input type="number" step="0.1" value={f.humidity} onChange={(e) => setF({ ...f, humidity: e.target.value })} className="h-9" /></div>
              <div><Label className="text-xs">T° C</Label><Input type="number" step="0.1" value={f.temperature} onChange={(e) => setF({ ...f, temperature: e.target.value })} className="h-9" /></div>
            </div>
            <div><Label className="text-xs">Notes</Label><Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} className="h-9" /></div>
            <Button onClick={submit} className="w-full">Enregistrer</Button>
          </div>
        </Card>

        <div className="border rounded-md overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="text-left">
                <th className="px-3 py-2 border-b">Date</th>
                <th className="px-3 py-2 border-b">Lot</th>
                <th className="px-3 py-2 border-b">Strain</th>
                <th className="px-3 py-2 border-b">Jour</th>
                <th className="px-3 py-2 border-b">RH %</th>
                <th className="px-3 py-2 border-b">T° C</th>
                <th className="px-3 py-2 border-b">Init.</th>
                <th className="px-3 py-2 border-b">Notes</th>
                <th className="px-3 py-2 border-b"></th>
              </tr>
            </thead>
            <tbody>
              {store.curing.length === 0 && <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">Aucune mesure</td></tr>}
              {store.curing.map((c, i) => (
                <tr key={c.id} className={cn("border-b", i % 2 && "bg-muted/20")}>
                  <td className="px-3 py-1.5 font-mono text-xs">{new Date(c.date).toLocaleDateString("fr-CA")}</td>
                  <td className="px-3 py-1.5 font-mono">{c.batchId}</td>
                  <td className="px-3 py-1.5">{c.strain}</td>
                  <td className="px-3 py-1.5 font-mono">{c.day ?? "—"}</td>
                  <td className="px-3 py-1.5 font-mono">{c.humidity ?? "—"}</td>
                  <td className="px-3 py-1.5 font-mono">{c.temperature ?? "—"}</td>
                  <td className="px-3 py-1.5 font-semibold">{c.initials}</td>
                  <td className="px-3 py-1.5 text-muted-foreground text-xs">{c.notes}</td>
                  <td className="px-3 py-1.5"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => actions.deleteCuring(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
