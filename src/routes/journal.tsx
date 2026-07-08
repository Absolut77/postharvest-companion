import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore, actions, batchSummaries, computeBatchStock } from "@/lib/store";
import { MovementForm } from "@/components/movement-form";
import { MovementTable } from "@/components/movement-table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRODUCT_FORMATS } from "@/lib/constants";
import { AlertTriangle, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/journal")({
  head: () => ({ meta: [{ title: "Journal 2026 — PostHarvest Central" }] }),
  component: Journal,
});

function Journal() {
  const [tab, setTab] = useState("log");
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Journal — Workbook</h1>
        <p className="text-sm text-muted-foreground">Interface principale de saisie — style tableur</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/60 border p-1 h-auto flex-wrap justify-start">
          <TabsTrigger value="log" className="data-[state=active]:bg-background">Log 2026</TabsTrigger>
          <TabsTrigger value="inventory">Inventaire Bulk</TabsTrigger>
          <TabsTrigger value="preorder">Pré-Commande Bulk</TabsTrigger>
          <TabsTrigger value="archive">Archive Rétention</TabsTrigger>
          <TabsTrigger value="internal">Échantillon Interne</TabsTrigger>
          <TabsTrigger value="external">Échantillon Externe</TabsTrigger>
        </TabsList>

        <TabsContent value="log" className="mt-4"><Log2026 /></TabsContent>
        <TabsContent value="inventory" className="mt-4"><BulkInventory /></TabsContent>
        <TabsContent value="preorder" className="mt-4"><PreOrders /></TabsContent>
        <TabsContent value="archive" className="mt-4"><ArchiveRetention /></TabsContent>
        <TabsContent value="internal" className="mt-4"><SamplesView category="internal" /></TabsContent>
        <TabsContent value="external" className="mt-4"><SamplesView category="external" /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============= LOG 2026 =============
function Log2026() {
  const store = useStore();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
      <Card className="p-4 h-fit lg:sticky lg:top-3">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Nouveau mouvement</h3>
        <MovementForm />
        <div className="mt-4 pt-3 border-t">
          <SamplingQuickFlow />
        </div>
      </Card>
      <div>
        <MovementTable title="Log 2026" />
      </div>
    </div>
  );
}

function SamplingQuickFlow() {
  const store = useStore();
  const [batchId, setBatchId] = useState("");
  const [qty, setQty] = useState("");
  const stock = batchId ? computeBatchStock(store.movements, batchId) : null;

  const sendOut = () => {
    if (!store.currentUser) return toast.error("Définissez vos initiales dans l'en-tête");
    if (!batchId) return toast.error("Sélectionner un lot");
    const q = parseFloat(qty);
    if (!q) return toast.error("Quantité invalide");
    const found = store.movements.find((m) => m.batchId === batchId);
    if (!found) return toast.error("Lot inconnu");
    actions.addMovement({
      date: new Date().toISOString(),
      initials: store.currentUser,
      strain: found.strain,
      batchId,
      productType: found.productType,
      productFormat: "Sample",
      quantity: q,
      units: 1,
      type: "OUT",
      destination: "Sortie pour Échantillonnage",
      comment: "Échantillonnage rapide",
      category: "internal-sample",
    });
    toast.success(`OUT · ${q}g · ${batchId}`);
    setQty("");
  };

  const returnBack = () => {
    if (!store.currentUser) return toast.error("Définissez vos initiales");
    if (!batchId) return toast.error("Sélectionner un lot");
    const q = parseFloat(qty);
    if (!q) return toast.error("Quantité invalide");
    const found = store.movements.find((m) => m.batchId === batchId);
    if (!found) return toast.error("Lot inconnu");
    actions.addMovement({
      date: new Date().toISOString(),
      initials: store.currentUser,
      strain: found.strain,
      batchId,
      productType: found.productType,
      productFormat: "Sample",
      quantity: q,
      units: 1,
      type: "IN",
      destination: "Retour d'Échantillonnage",
      comment: "Retour rapide",
      category: "internal-sample",
    });
    toast.success(`IN · ${q}g · ${batchId}`);
    setQty("");
  };

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ajustement Échantillonnage (rapide)</div>
      <div className="grid grid-cols-2 gap-2">
        <Select value={batchId} onValueChange={setBatchId}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Lot" /></SelectTrigger>
          <SelectContent>{store.batches.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="number" step="0.01" placeholder="g" value={qty} onChange={(e) => setQty(e.target.value)} className="h-9 font-mono" />
      </div>
      {stock !== null && <div className="text-xs text-muted-foreground">Stock: <span className="font-mono">{stock.toFixed(2)}g</span></div>}
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="outline" className="border-red-500/40 text-red-700 hover:bg-red-50" onClick={sendOut}>Sortie échant.</Button>
        <Button size="sm" variant="outline" className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-50" onClick={returnBack}>Retour échant.</Button>
      </div>
    </div>
  );
}

// ============= INVENTORY =============
function BulkInventory() {
  const { movements } = useStore();
  const [q, setQ] = useState("");
  const [format, setFormat] = useState("all");
  const [lowOnly, setLowOnly] = useState(false);

  const rows = useMemo(() => {
    const s = q.toLowerCase();
    return batchSummaries(movements)
      .filter((b) => !s || [b.batchId, b.strain].some((v) => v.toLowerCase().includes(s)))
      .filter((b) => (format === "all" ? true : b.format === format))
      .filter((b) => (lowOnly ? b.quantity < 100 : true));
  }, [movements, q, format, lowOnly]);

  const total = rows.reduce((s, r) => s + r.quantity, 0);

  return (
    <div className="space-y-3">
      <Card className="p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs">Rechercher</Label>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Lot ou strain..." className="h-9" />
        </div>
        <div>
          <Label className="text-xs">Format</Label>
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              {PRODUCT_FORMATS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button variant={lowOnly ? "default" : "outline"} size="sm" onClick={() => setLowOnly(!lowOnly)}>
          <AlertTriangle className="h-4 w-4 mr-1" /> Stock faible ({"<"}100g)
        </Button>
        <div className="ml-auto text-right">
          <div className="text-xs text-muted-foreground">Total vault</div>
          <div className="text-lg font-mono font-semibold">{total.toFixed(2)} g</div>
        </div>
      </Card>

      <div className="border rounded-md overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr className="text-left">
              <th className="px-3 py-2 font-semibold border-b">Lot</th>
              <th className="px-3 py-2 font-semibold border-b">Strain</th>
              <th className="px-3 py-2 font-semibold border-b">Format</th>
              <th className="px-3 py-2 font-semibold border-b text-right">Stock (g)</th>
              <th className="px-3 py-2 font-semibold border-b text-right">Mouvements</th>
              <th className="px-3 py-2 font-semibold border-b">Statut</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">Aucun lot</td></tr>}
            {rows.map((b, i) => (
              <tr key={b.batchId} className={cn("border-b hover:bg-accent/40", i % 2 && "bg-muted/20")}>
                <td className="px-3 py-1.5 font-mono">{b.batchId}</td>
                <td className="px-3 py-1.5">{b.strain}</td>
                <td className="px-3 py-1.5">{b.format}</td>
                <td className={cn("px-3 py-1.5 font-mono text-right font-semibold",
                  b.quantity < 0 && "text-red-600",
                  b.quantity < 100 && b.quantity >= 0 && "text-amber-600"
                )}>{b.quantity.toFixed(2)}</td>
                <td className="px-3 py-1.5 font-mono text-right text-muted-foreground">{b.movements}</td>
                <td className="px-3 py-1.5">
                  {b.quantity < 0 ? <Badge variant="destructive">Négatif</Badge> :
                   b.quantity < 100 ? <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/40" variant="outline">Faible</Badge> :
                   <Badge variant="outline" className="border-emerald-500/40 text-emerald-700">OK</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============= PRE-ORDERS =============
function PreOrders() {
  const store = useStore();
  const [form, setForm] = useState({ strain: "", batchId: "", format: "Bulk", quantity: "", units: "1", dueDate: "", notes: "" });

  const submit = () => {
    if (!store.currentUser) return toast.error("Initiales requises");
    if (!form.strain || !form.batchId || !form.quantity) return toast.error("Champs manquants");
    actions.addPreOrder({
      date: new Date().toISOString(),
      initials: store.currentUser,
      strain: form.strain,
      batchId: form.batchId,
      format: form.format,
      quantity: parseFloat(form.quantity),
      units: parseInt(form.units || "1", 10),
      dueDate: form.dueDate || undefined,
      status: "Requested",
      notes: form.notes,
    });
    toast.success("Pré-commande créée");
    setForm({ strain: "", batchId: "", format: "Bulk", quantity: "", units: "1", dueDate: "", notes: "" });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
      <Card className="p-4 h-fit">
        <h3 className="font-semibold text-sm mb-3">Nouvelle pré-commande</h3>
        <div className="space-y-2">
          <div><Label className="text-xs">Strain</Label><Input value={form.strain} onChange={(e) => setForm({ ...form, strain: e.target.value })} className="h-9" /></div>
          <div><Label className="text-xs">Lot</Label><Input value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })} className="h-9 font-mono" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Format</Label>
              <Select value={form.format} onValueChange={(v) => setForm({ ...form, format: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{PRODUCT_FORMATS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Qté (g)</Label><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="h-9 font-mono" /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Unités</Label><Input type="number" value={form.units} onChange={(e) => setForm({ ...form, units: e.target.value })} className="h-9" /></div>
            <div><Label className="text-xs">Échéance</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="h-9" /></div>
          </div>
          <div><Label className="text-xs">Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="h-9" /></div>
          <Button onClick={submit} className="w-full">Créer</Button>
        </div>
      </Card>

      <div className="border rounded-md overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr className="text-left">
              <th className="px-3 py-2 border-b">Date</th>
              <th className="px-3 py-2 border-b">Init.</th>
              <th className="px-3 py-2 border-b">Strain</th>
              <th className="px-3 py-2 border-b">Lot</th>
              <th className="px-3 py-2 border-b">Format</th>
              <th className="px-3 py-2 border-b text-right">Qté</th>
              <th className="px-3 py-2 border-b">Échéance</th>
              <th className="px-3 py-2 border-b">Statut</th>
              <th className="px-3 py-2 border-b"></th>
            </tr>
          </thead>
          <tbody>
            {store.preOrders.length === 0 && <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">Aucune pré-commande</td></tr>}
            {store.preOrders.map((p, i) => (
              <tr key={p.id} className={cn("border-b", i % 2 && "bg-muted/20")}>
                <td className="px-3 py-1.5 font-mono text-xs">{new Date(p.date).toLocaleDateString("fr-CA")}</td>
                <td className="px-3 py-1.5 font-semibold">{p.initials}</td>
                <td className="px-3 py-1.5">{p.strain}</td>
                <td className="px-3 py-1.5 font-mono">{p.batchId}</td>
                <td className="px-3 py-1.5">{p.format}</td>
                <td className="px-3 py-1.5 font-mono text-right">{p.quantity}</td>
                <td className="px-3 py-1.5 font-mono text-xs">{p.dueDate || "—"}</td>
                <td className="px-3 py-1.5">
                  <Select value={p.status} onValueChange={(v: any) => actions.updatePreOrder(p.id, { status: v })}>
                    <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Requested", "In Progress", "Fulfilled", "Cancelled"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-1.5">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => actions.deletePreOrder(p.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============= ARCHIVE =============
function ArchiveRetention() {
  return (
    <div className="space-y-3">
      <Card className="p-3 bg-muted/40 text-sm text-muted-foreground">
        Mouvements liés à la rétention et à l'archivage — vue historique (Format = Rétention ou destination Archive/Destruction).
      </Card>
      <MovementTable
        title="Archive"
        filter={(m) => m.productFormat === "Rétention" || m.destination === "Rétention Archive" || m.destination === "Destruction"}
        emptyLabel="Aucun mouvement archivé"
      />
    </div>
  );
}

// ============= SAMPLES =============
function SamplesView({ category }: { category: "internal" | "external" }) {
  const label = category === "internal" ? "Échantillon Interne" : "Échantillon Externe";
  const filter = (m: any) => {
    if (category === "internal") return m.category === "internal-sample" || m.destination?.includes("Échantillonnage");
    return m.category === "external-sample" || m.destination?.includes("Expédition");
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
      <Card className="p-4 h-fit">
        <h3 className="font-semibold text-sm mb-3">{label} — saisie rapide</h3>
        <MovementForm
          defaults={{
            productFormat: "Sample",
            destination: category === "internal" ? "Sortie pour Échantillonnage" : "Expédition",
            type: "OUT",
          }}
        />
      </Card>
      <MovementTable title={label} filter={filter} emptyLabel={`Aucun ${label.toLowerCase()}`} />
    </div>
  );
}
