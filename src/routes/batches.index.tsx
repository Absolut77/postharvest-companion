import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Sprout } from "lucide-react";
import { toast } from "sonner";
import { listBatches, createBatch } from "@/lib/posthv/api";
import { STAGE_LABELS, type BatchStage } from "@/lib/posthv/types";

export const Route = createFileRoute("/batches/")({
  head: () => ({ meta: [{ title: "Batches — PostHarvest Companion" }] }),
  component: BatchesList,
});

const STAGE_COLORS: Record<BatchStage, string> = {
  harvest: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  drying: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  debudding: "bg-orange-500/10 text-orange-700 border-orange-500/30",
  sorting: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  curing: "bg-purple-500/10 text-purple-700 border-purple-500/30",
  bulk_packaging: "bg-indigo-500/10 text-indigo-700 border-indigo-500/30",
  vault: "bg-slate-500/10 text-slate-700 border-slate-500/30",
};

function BatchesList() {
  const { data: batches = [], isLoading } = useQuery({ queryKey: ["batches"], queryFn: listBatches });
  const [openNew, setOpenNew] = useState(false);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Sprout className="h-6 w-6 text-primary" /> Batches</h1>
          <p className="text-sm text-muted-foreground">Suivi complet post-récolte, de l'arrivée en séchage à l'entrée en voûte.</p>
        </div>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Nouveau batch</Button>
          </DialogTrigger>
          <NewBatchDialog onDone={() => setOpenNew(false)} />
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Chargement…</div>
      ) : batches.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="text-lg font-semibold">Aucun batch pour l'instant</div>
          <div className="text-sm text-muted-foreground mt-1">Commencez par créer un batch à l'arrivée de la récolte.</div>
          <Button className="mt-4" onClick={() => setOpenNew(true)}><Plus className="h-4 w-4 mr-1" /> Créer un batch</Button>
        </Card>
      ) : (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {batches.map((b) => (
            <Link key={b.id} to="/batches/$batchId" params={{ batchId: b.id }} className="block">
              <Card className="p-4 hover:shadow-md transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-sm font-semibold truncate">{b.batch_id}</div>
                    <div className="text-sm text-muted-foreground truncate">{b.strain || "—"}</div>
                  </div>
                  <Badge variant="outline" className={STAGE_COLORS[b.current_stage]}>
                    {STAGE_LABELS[b.current_stage]}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <Stat label="Plantes" value={b.plant_count} />
                  <Stat label="Humide" value={`${Number(b.wet_weight_g).toFixed(0)} g`} />
                  <Stat label="Sec" value={`${Number(b.dry_weight_g).toFixed(0)} g`} />
                </div>
                {b.harvest_date && (
                  <div className="mt-2 text-[11px] text-muted-foreground">Récolte : {b.harvest_date}</div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded bg-muted/40 px-2 py-1">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-sm">{value}</div>
    </div>
  );
}

function NewBatchDialog({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [batchId, setBatchId] = useState("");
  const [strain, setStrain] = useState("");
  const [plantCount, setPlantCount] = useState<number>(0);
  const [harvestDate, setHarvestDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [wet, setWet] = useState<number>(0);
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: () => createBatch({
      batch_id: batchId.trim(),
      strain: strain.trim(),
      plant_count: plantCount,
      harvest_date: harvestDate || null,
      wet_weight_g: wet,
      notes,
    }),
    onSuccess: () => {
      toast.success("Batch créé");
      qc.invalidateQueries({ queryKey: ["batches"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Nouveau batch</DialogTitle></DialogHeader>
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Numéro de batch *</Label>
            <Input value={batchId} onChange={(e) => setBatchId(e.target.value)} placeholder="ex : B26-0001" />
          </div>
          <div>
            <Label>Variété *</Label>
            <Input value={strain} onChange={(e) => setStrain(e.target.value)} placeholder="ex : Purple Punch" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Nb plantes</Label>
            <Input type="number" value={plantCount} onChange={(e) => setPlantCount(Number(e.target.value) || 0)} />
          </div>
          <div>
            <Label>Date récolte</Label>
            <Input type="date" value={harvestDate} onChange={(e) => setHarvestDate(e.target.value)} />
          </div>
          <div>
            <Label>Poids humide (g)</Label>
            <Input type="number" value={wet} onChange={(e) => setWet(Number(e.target.value) || 0)} />
          </div>
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>Annuler</Button>
        <Button
          onClick={() => create.mutate()}
          disabled={!batchId.trim() || !strain.trim() || create.isPending}
        >
          Créer
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
