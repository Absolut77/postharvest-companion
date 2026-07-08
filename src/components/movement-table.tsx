import { useMemo, useState } from "react";
import { useStore, actions } from "@/lib/store";
import type { Movement } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { downloadCSV } from "@/lib/constants";
import { Search, Trash2, Download, ArrowUpFromLine, ArrowDownToLine } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  filter?: (m: Movement) => boolean;
  title?: string;
  emptyLabel?: string;
};

export function MovementTable({ filter, title = "Mouvements", emptyLabel = "Aucun mouvement" }: Props) {
  const { movements } = useStore();
  const [q, setQ] = useState("");
  const [typeF, setTypeF] = useState<string>("all");
  const [batchF, setBatchF] = useState<string>("all");
  const [sortKey, setSortKey] = useState<keyof Movement>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const base = useMemo(() => (filter ? movements.filter(filter) : movements), [movements, filter]);
  const batches = useMemo(() => Array.from(new Set(base.map((m) => m.batchId))).sort(), [base]);

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return base
      .filter((m) => (typeF === "all" ? true : m.type === typeF))
      .filter((m) => (batchF === "all" ? true : m.batchId === batchF))
      .filter((m) =>
        !s ||
        [m.strain, m.batchId, m.destination, m.comment, m.initials, m.productFormat, m.productType]
          .some((v) => (v || "").toLowerCase().includes(s))
      )
      .sort((a, b) => {
        const av = a[sortKey] as any;
        const bv = b[sortKey] as any;
        if (av === bv) return 0;
        return (av > bv ? 1 : -1) * (sortDir === "asc" ? 1 : -1);
      });
  }, [base, q, typeF, batchF, sortKey, sortDir]);

  const toggleSort = (k: keyof Movement) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  };

  const exportCSV = () => {
    const rows: (string | number)[][] = [
      ["Date", "Initiales", "Type", "Strain", "Lot", "Type Produit", "Format", "Quantité (g)", "Unités", "Destination", "Commentaire"],
      ...filtered.map((m) => [
        new Date(m.date).toLocaleString("fr-CA"),
        m.initials,
        m.type,
        m.strain,
        m.batchId,
        m.productType,
        m.productFormat,
        m.quantity,
        m.units,
        m.destination,
        m.comment || "",
      ]),
    ];
    downloadCSV(`log-${title.toLowerCase().replace(/\s+/g, "-")}.csv`, rows);
  };

  const totals = useMemo(() => {
    let inG = 0, outG = 0;
    for (const m of filtered) (m.type === "IN" ? (inG += m.quantity) : (outG += m.quantity));
    return { inG, outG, net: inG - outG };
  }, [filtered]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher strain, lot, initiales..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-8 h-9" />
        </div>
        <Select value={typeF} onValueChange={setTypeF}>
          <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            <SelectItem value="IN">Entrées</SelectItem>
            <SelectItem value="OUT">Sorties</SelectItem>
          </SelectContent>
        </Select>
        <Select value={batchF} onValueChange={setBatchF}>
          <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les lots</SelectItem>
            {batches.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" /> CSV</Button>
      </div>

      <div className="flex gap-4 text-xs text-muted-foreground">
        <span><span className="text-emerald-600 font-semibold">IN: {totals.inG.toFixed(2)}g</span></span>
        <span><span className="text-red-600 font-semibold">OUT: {totals.outG.toFixed(2)}g</span></span>
        <span>Net: <span className="font-mono font-semibold">{totals.net.toFixed(2)}g</span></span>
        <span className="ml-auto">{filtered.length} lignes</span>
      </div>

      <div className="border rounded-md overflow-hidden bg-card">
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 sticky top-0 z-10">
              <tr className="text-left">
                {[
                  ["date", "Date"],
                  ["initials", "Init."],
                  ["type", "Type"],
                  ["strain", "Strain"],
                  ["batchId", "Lot"],
                  ["productFormat", "Format"],
                  ["quantity", "Qté (g)"],
                  ["units", "Un."],
                  ["destination", "Destination"],
                  ["comment", "Commentaire"],
                ].map(([k, label]) => (
                  <th
                    key={k}
                    onClick={() => toggleSort(k as keyof Movement)}
                    className="px-2 py-2 font-semibold border-b cursor-pointer hover:bg-muted whitespace-nowrap"
                  >
                    {label} {sortKey === k && (sortDir === "asc" ? "▲" : "▼")}
                  </th>
                ))}
                <th className="px-2 py-2 border-b"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={11} className="text-center py-10 text-muted-foreground">{emptyLabel}</td></tr>
              )}
              {filtered.map((m, i) => (
                <tr key={m.id} className={cn("border-b hover:bg-accent/40", i % 2 === 1 && "bg-muted/20")}>
                  <td className="px-2 py-1.5 whitespace-nowrap font-mono text-xs">
                    {new Date(m.date).toLocaleString("fr-CA", { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-2 py-1.5 font-semibold">{m.initials}</td>
                  <td className="px-2 py-1.5">
                    <Badge variant="outline" className={cn("gap-1 font-mono",
                      m.type === "IN" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700" : "border-red-500/40 bg-red-500/10 text-red-700"
                    )}>
                      {m.type === "IN" ? <ArrowDownToLine className="h-3 w-3" /> : <ArrowUpFromLine className="h-3 w-3" />}
                      {m.type}
                    </Badge>
                  </td>
                  <td className="px-2 py-1.5">{m.strain}</td>
                  <td className="px-2 py-1.5 font-mono text-xs">{m.batchId}</td>
                  <td className="px-2 py-1.5">{m.productFormat}</td>
                  <td className="px-2 py-1.5 font-mono text-right">{m.quantity.toFixed(2)}</td>
                  <td className="px-2 py-1.5 font-mono text-right">{m.units}</td>
                  <td className="px-2 py-1.5">{m.destination}</td>
                  <td className="px-2 py-1.5 text-muted-foreground text-xs max-w-[220px] truncate">{m.comment}</td>
                  <td className="px-2 py-1.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => actions.deleteMovement(m.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
