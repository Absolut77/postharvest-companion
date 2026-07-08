import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore, actions } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Trash2, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/harvest")({
  head: () => ({ meta: [{ title: "Arvest / Packaging — PostHarvest Central" }] }),
  component: HarvestPage,
});

function HarvestPage() {
  const store = useStore();
  const [f, setF] = useState({ batchId: "", strain: "", wetWeight: "", dryWeight: "", packagedUnits: "", notes: "", photo: "" });

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setF((s) => ({ ...s, photo: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const submit = () => {
    if (!store.currentUser) return toast.error("Initiales requises");
    if (!f.batchId) return toast.error("Lot requis");
    actions.addHarvest({
      date: new Date().toISOString(),
      batchId: f.batchId,
      strain: f.strain,
      wetWeight: f.wetWeight ? parseFloat(f.wetWeight) : undefined,
      dryWeight: f.dryWeight ? parseFloat(f.dryWeight) : undefined,
      packagedUnits: f.packagedUnits ? parseInt(f.packagedUnits, 10) : undefined,
      initials: store.currentUser,
      photoDataUrl: f.photo || undefined,
      notes: f.notes,
    });
    toast.success("Entrée récolte / packaging ajoutée");
    setF({ batchId: "", strain: "", wetWeight: "", dryWeight: "", packagedUnits: "", notes: "", photo: "" });
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Arvest / Packaging</h1>
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
        <Card className="p-4 h-fit">
          <h3 className="font-semibold text-sm mb-3">Nouvelle entrée</h3>
          <div className="space-y-2">
            <div><Label className="text-xs">Lot</Label><Input value={f.batchId} onChange={(e) => setF({ ...f, batchId: e.target.value })} className="h-9 font-mono" /></div>
            <div><Label className="text-xs">Strain</Label><Input value={f.strain} onChange={(e) => setF({ ...f, strain: e.target.value })} className="h-9" /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-xs">Wet (g)</Label><Input type="number" value={f.wetWeight} onChange={(e) => setF({ ...f, wetWeight: e.target.value })} className="h-9 font-mono" /></div>
              <div><Label className="text-xs">Dry (g)</Label><Input type="number" value={f.dryWeight} onChange={(e) => setF({ ...f, dryWeight: e.target.value })} className="h-9 font-mono" /></div>
              <div><Label className="text-xs">Unités</Label><Input type="number" value={f.packagedUnits} onChange={(e) => setF({ ...f, packagedUnits: e.target.value })} className="h-9 font-mono" /></div>
            </div>
            <div>
              <Label className="text-xs">Photo</Label>
              <label className="flex items-center gap-2 h-9 border rounded-md px-2 text-xs cursor-pointer hover:bg-accent">
                <ImagePlus className="h-4 w-4" /> {f.photo ? "Photo prête" : "Ajouter une photo"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
              </label>
              {f.photo && <img src={f.photo} alt="preview" className="mt-2 max-h-24 rounded border" />}
            </div>
            <div><Label className="text-xs">Notes</Label><Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} className="h-9" /></div>
            <Button onClick={submit} className="w-full">Enregistrer</Button>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {store.harvest.length === 0 && <div className="col-span-full text-center py-16 text-muted-foreground text-sm">Aucune entrée</div>}
          {store.harvest.map((h) => {
            const yieldPct = h.wetWeight && h.dryWeight ? ((h.dryWeight / h.wetWeight) * 100).toFixed(1) : null;
            return (
              <Card key={h.id} className="p-3">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-mono font-semibold text-sm">{h.batchId}</div>
                    <div className="text-xs text-muted-foreground">{h.strain} · {new Date(h.date).toLocaleDateString("fr-CA")} · {h.initials}</div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => actions.deleteHarvest(h.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
                {h.photoDataUrl && <img src={h.photoDataUrl} className="w-full h-32 object-cover rounded mb-2" alt="" />}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><div className="text-muted-foreground">Wet</div><div className="font-mono">{h.wetWeight ?? "—"}g</div></div>
                  <div><div className="text-muted-foreground">Dry</div><div className="font-mono">{h.dryWeight ?? "—"}g</div></div>
                  <div><div className="text-muted-foreground">Yield</div><div className={cn("font-mono font-semibold", yieldPct && "text-emerald-600")}>{yieldPct ? `${yieldPct}%` : "—"}</div></div>
                </div>
                {h.notes && <div className="text-xs text-muted-foreground mt-2">{h.notes}</div>}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
