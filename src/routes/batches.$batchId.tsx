import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Save, Trash2, Plus, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  getBatch, updateBatch, advanceStage,
  listDrying, addDryingReading, deleteDryingReading,
  listStageEvents,
} from "@/lib/posthv/api";
import { BATCH_STAGES, STAGE_LABELS, type BatchStage } from "@/lib/posthv/types";

export const Route = createFileRoute("/batches/$batchId")({
  head: () => ({ meta: [{ title: "Batch — PostHarvest Companion" }] }),
  component: BatchDetail,
});

function BatchDetail() {
  const { batchId } = Route.useParams();
  const { data: batch, isLoading } = useQuery({
    queryKey: ["batch", batchId],
    queryFn: () => getBatch(batchId),
  });

  const [tab, setTab] = useState<BatchStage>("harvest");

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;
  if (!batch) return <div className="p-6 text-sm">Batch introuvable.</div>;

  const currentIdx = BATCH_STAGES.indexOf(batch.current_stage);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px]">
      <div className="flex items-center gap-3 flex-wrap">
        <Button asChild variant="ghost" size="sm"><Link to="/batches"><ArrowLeft className="h-4 w-4 mr-1" /> Batches</Link></Button>
        <h1 className="text-xl font-semibold font-mono">{batch.batch_id}</h1>
        <span className="text-muted-foreground">·</span>
        <span className="text-sm">{batch.strain}</span>
        <Badge variant="outline" className="ml-auto">{STAGE_LABELS[batch.current_stage]}</Badge>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as BatchStage)}>
        <TabsList className="flex flex-wrap h-auto">
          {BATCH_STAGES.map((s, i) => {
            const locked = i > currentIdx + 1; // permet l'étape suivante immédiate
            return (
              <TabsTrigger key={s} value={s} disabled={locked} className="gap-1">
                {locked && <Lock className="h-3 w-3" />}
                {STAGE_LABELS[s]}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="harvest"><HarvestTab batchId={batch.id} /></TabsContent>
        <TabsContent value="drying"><DryingTab batchId={batch.id} /></TabsContent>
        <TabsContent value="debudding"><ComingSoon stage="debudding" /></TabsContent>
        <TabsContent value="sorting"><ComingSoon stage="sorting" /></TabsContent>
        <TabsContent value="curing"><ComingSoon stage="curing" /></TabsContent>
        <TabsContent value="bulk_packaging"><ComingSoon stage="bulk_packaging" /></TabsContent>
        <TabsContent value="vault"><VaultTab batchId={batch.id} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- Récolte ----------
function HarvestTab({ batchId }: { batchId: string }) {
  const qc = useQueryClient();
  const { data: batch } = useQuery({ queryKey: ["batch", batchId], queryFn: () => getBatch(batchId) });
  const [strain, setStrain] = useState(batch?.strain ?? "");
  const [plantCount, setPlantCount] = useState<number>(batch?.plant_count ?? 0);
  const [harvestDate, setHarvestDate] = useState<string>(batch?.harvest_date ?? "");
  const [wet, setWet] = useState<number>(Number(batch?.wet_weight_g ?? 0));
  const [notes, setNotes] = useState(batch?.notes ?? "");

  // sync state with refreshed data
  const key = `${batch?.id}:${batch?.updated_at}`;
  useSyncOnce(key, () => {
    if (!batch) return;
    setStrain(batch.strain);
    setPlantCount(batch.plant_count);
    setHarvestDate(batch.harvest_date ?? "");
    setWet(Number(batch.wet_weight_g));
    setNotes(batch.notes);
  });

  const save = useMutation({
    mutationFn: () => updateBatch(batchId, {
      strain, plant_count: plantCount, harvest_date: harvestDate || null,
      wet_weight_g: wet, notes,
    }),
    onSuccess: () => {
      toast.success("Enregistré");
      qc.invalidateQueries({ queryKey: ["batch", batchId] });
      qc.invalidateQueries({ queryKey: ["batches"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const advance = useMutation({
    mutationFn: () => advanceStage(batchId, "harvest", "drying", "Passage en séchage"),
    onSuccess: () => {
      toast.success("Batch passé en séchage");
      qc.invalidateQueries({ queryKey: ["batch", batchId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-4 space-y-4">
      <h2 className="font-semibold">Arrivée de la récolte</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>Variété</Label>
          <Input value={strain} onChange={(e) => setStrain(e.target.value)} />
        </div>
        <div>
          <Label>Date de récolte</Label>
          <Input type="date" value={harvestDate} onChange={(e) => setHarvestDate(e.target.value)} />
        </div>
        <div>
          <Label>Nb plantes</Label>
          <Input type="number" value={plantCount} onChange={(e) => setPlantCount(Number(e.target.value) || 0)} />
        </div>
        <div>
          <Label>Poids humide (g)</Label>
          <Input type="number" value={wet} onChange={(e) => setWet(Number(e.target.value) || 0)} />
        </div>
        <div className="md:col-span-2">
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="h-4 w-4 mr-1" /> Enregistrer</Button>
        {batch?.current_stage === "harvest" && (
          <Button variant="outline" onClick={() => advance.mutate()} disabled={advance.isPending}>
            Passer en séchage →
          </Button>
        )}
      </div>
    </Card>
  );
}

// ---------- Séchage ----------
function DryingTab({ batchId }: { batchId: string }) {
  const qc = useQueryClient();
  const { data: readings = [] } = useQuery({ queryKey: ["drying", batchId], queryFn: () => listDrying(batchId) });
  const { data: batch } = useQuery({ queryKey: ["batch", batchId], queryFn: () => getBatch(batchId) });

  const [temp, setTemp] = useState<string>("");
  const [humIn, setHumIn] = useState<string>("");
  const [humOut, setHumOut] = useState<string>("");
  const [aw, setAw] = useState<string>("");
  const [sart, setSart] = useState<string>("");
  const [note, setNote] = useState("");

  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  const add = useMutation({
    mutationFn: () => addDryingReading({
      batch_id: batchId,
      taken_at: new Date().toISOString(),
      room_temp_c: num(temp),
      internal_humidity: num(humIn),
      external_humidity: num(humOut),
      water_activity: num(aw),
      sartorius_value: num(sart),
      note,
    }),
    onSuccess: () => {
      toast.success("Mesure ajoutée");
      setTemp(""); setHumIn(""); setHumOut(""); setAw(""); setSart(""); setNote("");
      qc.invalidateQueries({ queryKey: ["drying", batchId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteDryingReading(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drying", batchId] }),
  });

  const advance = useMutation({
    mutationFn: () => advanceStage(batchId, "drying", "debudding", "Passage en débudage"),
    onSuccess: () => {
      toast.success("Batch passé en débudage");
      qc.invalidateQueries({ queryKey: ["batch", batchId] });
    },
  });

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <h2 className="font-semibold">Nouvelle mesure de séchage</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Field label="Température (°C)" value={temp} onChange={setTemp} />
          <Field label="Humidité int. (%)" value={humIn} onChange={setHumIn} />
          <Field label="Humidité ext. (%)" value={humOut} onChange={setHumOut} />
          <Field label="Activité eau (aw)" value={aw} onChange={setAw} />
          <Field label="Sartorius" value={sart} onChange={setSart} />
        </div>
        <div>
          <Label>Note</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Observation, action…" />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => add.mutate()} disabled={add.isPending}><Plus className="h-4 w-4 mr-1" /> Ajouter la mesure</Button>
          {batch?.current_stage === "drying" && (
            <Button variant="outline" onClick={() => advance.mutate()} disabled={advance.isPending}>
              Passer en débudage →
            </Button>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold mb-2">Historique ({readings.length})</h3>
        {readings.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">Aucune mesure enregistrée.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-2">Quand</th>
                  <th className="pr-2">T °C</th>
                  <th className="pr-2">Hum. int</th>
                  <th className="pr-2">Hum. ext</th>
                  <th className="pr-2">aw</th>
                  <th className="pr-2">Sartorius</th>
                  <th className="pr-2">Note</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {readings.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-accent/30">
                    <td className="py-2 pr-2 text-xs font-mono">{new Date(r.taken_at).toLocaleString("fr-FR")}</td>
                    <td className="pr-2">{r.room_temp_c ?? "—"}</td>
                    <td className="pr-2">{r.internal_humidity ?? "—"}</td>
                    <td className="pr-2">{r.external_humidity ?? "—"}</td>
                    <td className="pr-2">{r.water_activity ?? "—"}</td>
                    <td className="pr-2">{r.sartorius_value ?? "—"}</td>
                    <td className="pr-2 text-xs text-muted-foreground max-w-[240px] truncate">{r.note}</td>
                    <td>
                      <Button size="sm" variant="ghost" onClick={() => del.mutate(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type="number" step="0.01" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function ComingSoon({ stage }: { stage: BatchStage }) {
  return (
    <Card className="p-8 text-center">
      <div className="text-lg font-semibold">{STAGE_LABELS[stage]}</div>
      <div className="text-sm text-muted-foreground mt-2">
        Cet onglet sera activé à l'étape B (débudage, tri & ensachage, curing, bulk packaging).
      </div>
    </Card>
  );
}

function VaultTab({ batchId }: { batchId: string }) {
  const { data: events = [] } = useQuery({ queryKey: ["stage-events", batchId], queryFn: () => listStageEvents(batchId) });
  return (
    <Card className="p-4">
      <h2 className="font-semibold mb-3">Historique des étapes</h2>
      {events.length === 0 ? (
        <div className="text-sm text-muted-foreground">Aucun événement.</div>
      ) : (
        <ol className="relative border-l pl-4 space-y-3">
          {events.map((e) => (
            <li key={e.id} className="text-sm">
              <div className="font-mono text-xs text-muted-foreground">{new Date(e.at).toLocaleString("fr-FR")}</div>
              <div>
                {e.from_stage ? `${STAGE_LABELS[e.from_stage]} → ` : ""}
                <span className="font-semibold">{STAGE_LABELS[e.to_stage]}</span>
              </div>
              {e.note && <div className="text-xs text-muted-foreground">{e.note}</div>}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

// Utility: run a callback whenever a key string changes (avoids uncontrolled re-init loops)
import { useEffect, useRef } from "react";
function useSyncOnce(key: string, cb: () => void) {
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (last.current !== key) {
      last.current = key;
      cb();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
