import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listMovements, deleteMovement } from "@/lib/movements";
import type { Movement } from "@/lib/types";
import { MovementModal } from "@/components/movement-modal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Search, ArrowDown, ArrowUp, ArrowUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/journal")({
  head: () => ({ meta: [{ title: "Journal (Log 2026) — PostHarvest Companion" }] }),
  component: Journal,
});

type SortKey =
  | "event_date" | "initials" | "direction" | "strain" | "batch_id"
  | "product_type" | "product_format" | "quantity_g" | "units" | "destination" | "comment1";

type SortDir = "asc" | "desc";

function Journal() {
  const qc = useQueryClient();
  const { data: movements = [], isLoading } = useQuery({
    queryKey: ["movements"],
    queryFn: listMovements,
  });

  const [q, setQ] = useState("");
  const [dir, setDir] = useState<"all" | "IN" | "OUT">("all");
  const [batchFilter, setBatchFilter] = useState<string>("all");
  const [strainFilter, setStrainFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("event_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Movement | null>(null);

  const allBatches = useMemo(
    () => Array.from(new Set(movements.map((m) => m.batch_id).filter(Boolean))).sort(),
    [movements]
  );
  const allStrains = useMemo(
    () => Array.from(new Set(movements.map((m) => m.strain).filter(Boolean))).sort(),
    [movements]
  );

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    const arr = movements.filter((m) => {
      if (dir !== "all" && m.direction !== dir) return false;
      if (batchFilter !== "all" && m.batch_id !== batchFilter) return false;
      if (strainFilter !== "all" && m.strain !== strainFilter) return false;
      if (!s) return true;
      return [
        m.strain, m.batch_id, m.product_type, m.product_format,
        m.reason, m.destination, m.sku, m.comment, m.comment1, m.comment2,
        m.additional_comments, m.initials, m.stamp_used,
      ].some((v) => (v || "").toLowerCase().includes(s));
    });

    arr.sort((a, b) => {
      const av = a[sortKey] as any;
      const bv = b[sortKey] as any;
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [movements, q, dir, batchFilter, strainFilter, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  };

  const del = useMutation({
    mutationFn: deleteMovement,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["movements"] }); toast.success("Supprimé"); },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const openNew = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (m: Movement) => { setEditing(m); setModalOpen(true); };

  const Th = ({ k, children, align = "left", className }: { k: SortKey; children: React.ReactNode; align?: "left" | "right" | "center"; className?: string }) => (
    <th
      className={cn(
        "px-2 py-2 border-b font-semibold cursor-pointer select-none hover:bg-muted",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className
      )}
      onClick={() => toggleSort(k)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortKey === k
          ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
          : <ArrowUpDown className="h-3 w-3 opacity-40" />}
      </span>
    </th>
  );

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Journal (Log 2026)</h1>
          <p className="text-sm text-muted-foreground">
            Seule source de saisie. L'inventaire se met à jour automatiquement.
          </p>
        </div>
        <Button onClick={openNew} size="lg" className="shadow">
          <Plus className="h-5 w-5 mr-1" /> Ajouter un événement
        </Button>
      </div>

      <Card className="p-3 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <Label className="text-xs">Rechercher</Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Lot, strain, raison, commentaire…" className="pl-8 h-9" />
          </div>
        </div>
        <div>
          <Label className="text-xs">Direction</Label>
          <Select value={dir} onValueChange={(v: any) => setDir(v)}>
            <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              <SelectItem value="IN">IN</SelectItem>
              <SelectItem value="OUT">OUT</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Strain</Label>
          <Select value={strainFilter} onValueChange={setStrainFilter}>
            <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              {allStrains.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Batch</Label>
          <Select value={batchFilter} onValueChange={setBatchFilter}>
            <SelectTrigger className="h-9 w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              {allBatches.map((b) => <SelectItem key={b} value={b}><span className="font-mono text-xs">{b}</span></SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {(batchFilter !== "all" || strainFilter !== "all" || dir !== "all" || q) && (
          <Button variant="ghost" size="sm" onClick={() => { setBatchFilter("all"); setStrainFilter("all"); setDir("all"); setQ(""); }}>
            <X className="h-4 w-4 mr-1" /> Réinitialiser
          </Button>
        )}
        <div className="ml-auto text-right">
          <div className="text-xs text-muted-foreground">Lignes</div>
          <div className="text-lg font-mono font-semibold">{filtered.length} / {movements.length}</div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 sticky top-0">
              <tr className="text-left">
                <Th k="event_date" className="w-24">Date</Th>
                <Th k="initials" className="w-14">Init.</Th>
                <Th k="direction" align="center" className="w-16">Dir.</Th>
                <Th k="strain">Strain</Th>
                <Th k="batch_id">Lot</Th>
                <Th k="product_type">Type</Th>
                <Th k="product_format">Format</Th>
                <Th k="quantity_g" align="right">Qté (g)</Th>
                <Th k="units" align="right">U</Th>
                <Th k="destination">Destination</Th>
                <Th k="comment1">Commentaire</Th>
                <th className="px-2 py-2 border-b font-semibold w-20"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={12} className="text-center py-10 text-muted-foreground">Chargement…</td></tr>}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={12} className="text-center py-10 text-muted-foreground">Aucun événement</td></tr>
              )}
              {filtered.slice(0, 500).map((m, i) => (
                <tr key={m.id} className={cn("border-b hover:bg-accent/40", i % 2 && "bg-muted/20")}>
                  <td className="px-2 py-1 font-mono text-xs whitespace-nowrap">{m.event_date}</td>
                  <td className="px-2 py-1 font-semibold">{m.initials}</td>
                  <td className="px-2 py-1 text-center">
                    {m.direction === "IN"
                      ? <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 gap-1"><ArrowDown className="h-3 w-3" />IN</Badge>
                      : <Badge variant="outline" className="border-red-500/40 text-red-700 gap-1"><ArrowUp className="h-3 w-3" />OUT</Badge>}
                  </td>
                  <td className="px-2 py-1">{m.strain}</td>
                  <td className="px-2 py-1 font-mono text-xs">
                    <button className="hover:underline" onClick={() => setBatchFilter(m.batch_id)} title="Filtrer sur ce lot">{m.batch_id}</button>
                  </td>
                  <td className="px-2 py-1 text-muted-foreground">{m.product_type}</td>
                  <td className="px-2 py-1 text-muted-foreground">{m.product_format}</td>
                  <td className="px-2 py-1 font-mono text-right">{Number(m.quantity_g).toFixed(2)}</td>
                  <td className="px-2 py-1 font-mono text-right">{m.units}</td>
                  <td className="px-2 py-1 text-xs">{m.destination || m.reason}</td>
                  <td className="px-2 py-1 text-xs text-muted-foreground max-w-[240px] truncate" title={m.comment1 || m.comment}>{m.comment1 || m.comment}</td>
                  <td className="px-2 py-1">
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(m)} title="Éditer">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600"
                        onClick={() => { if (confirm(`Supprimer cette ligne (${m.batch_id}) ?`)) del.mutate(m.id); }}
                        title="Supprimer">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 500 && (
          <div className="p-3 text-center text-xs text-muted-foreground border-t bg-muted/20">
            Affichage limité à 500 lignes · {filtered.length - 500} de plus. Affinez la recherche.
          </div>
        )}
      </Card>

      <MovementModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editing={editing}
        movements={movements}
      />
    </div>
  );
}
