import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listMovements, computeInventory } from "@/lib/movements";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  AlertTriangle, Boxes, ClipboardList, TrendingDown, Plus,
  ArrowDown, ArrowUp, CalendarDays,
} from "lucide-react";
import { MovementModal } from "@/components/movement-modal";
import type { Movement } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard — PostHarvest Companion" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: movements = [] } = useQuery({
    queryKey: ["movements"],
    queryFn: listMovements,
  });

  const inventory = computeInventory(movements);
  const totalGrams = inventory.reduce((s, b) => s + b.quantity_g, 0);
  const lowStock = inventory.filter((b) => b.quantity_g > 0 && b.quantity_g < 100);
  const negative = inventory.filter((b) => b.quantity_g < 0);
  const activeLots = inventory.filter((b) => b.quantity_g > 0).length;

  const todayStr = new Date().toISOString().slice(0, 10);
  const inToday = movements.filter((m) => m.event_date === todayStr && m.direction === "IN").length;
  const outToday = movements.filter((m) => m.event_date === todayStr && m.direction === "OUT").length;

  // Groupe les mouvements par jour (YYYY-MM-DD)
  const byDay = useMemo(() => {
    const map = new Map<string, Movement[]>();
    for (const m of movements) {
      if (!map.has(m.event_date)) map.set(m.event_date, []);
      map.get(m.event_date)!.push(m);
    }
    return map;
  }, [movements]);

  const upcoming = useMemo(() => {
    return movements
      .filter((m) => m.event_date >= todayStr)
      .sort((a, b) => a.event_date.localeCompare(b.event_date))
      .slice(0, 15);
  }, [movements, todayStr]);

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [prefillDate, setPrefillDate] = useState<string | null>(null);
  const [newDirection, setNewDirection] = useState<"IN" | "OUT">("IN");

  const selectedKey = ymd(selectedDate);
  const dayEvents = byDay.get(selectedKey) ?? [];

  const eventDays = useMemo(() => Array.from(byDay.keys()).map((d) => new Date(d + "T00:00")), [byDay]);

  const openAddForDate = (d: Date, dir: "IN" | "OUT") => {
    setPrefillDate(ymd(d));
    setNewDirection(dir);
    setModalOpen(true);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Vue d'ensemble et calendrier des événements du Log 2026.</p>
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
          label="Stock faible" value={String(lowStock.length)} sub="< 100 g"
          tone={lowStock.length ? "warn" : undefined}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <StatCard
          label="Stock négatif" value={String(negative.length)} sub="À vérifier"
          tone={negative.length ? "danger" : undefined}
          icon={<TrendingDown className="h-4 w-4" />}
        />
      </div>

      {/* Calendrier + panneau du jour */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(420px,1fr)_1fr] gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-lg">Calendrier</h2>
            </div>
            <div className="flex gap-1">
              <Button size="sm" onClick={() => openAddForDate(selectedDate, "IN")} className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-2">
                <ArrowDown className="h-3.5 w-3.5 mr-1" /> IN
              </Button>
              <Button size="sm" onClick={() => openAddForDate(selectedDate, "OUT")} className="bg-red-600 hover:bg-red-700 text-white h-8 px-2">
                <ArrowUp className="h-3.5 w-3.5 mr-1" /> OUT
              </Button>
            </div>
          </div>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(d) => d && setSelectedDate(d)}
            modifiers={{ hasEvent: eventDays }}
            modifiersClassNames={{
              hasEvent: "relative font-semibold text-primary after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary",
            }}
            className={cn("p-3 pointer-events-auto rounded-md border w-full [&_table]:w-full [&_.rdp-cell]:h-11 [&_.rdp-day]:h-11 [&_.rdp-day]:w-11 [&_.rdp-day]:text-sm")}
          />
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" /> Jour avec événement
            </span>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-lg">
                {formatFrDate(selectedDate)}
              </h2>
              <p className="text-xs text-muted-foreground">
                {dayEvents.length === 0 ? "Aucun événement" : `${dayEvents.length} événement(s)`}
              </p>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => openAddForDate(selectedDate, "IN")} className="border-emerald-500 text-emerald-700 hover:bg-emerald-50">
                <ArrowDown className="h-3.5 w-3.5 mr-1" /> IN
              </Button>
              <Button size="sm" variant="outline" onClick={() => openAddForDate(selectedDate, "OUT")} className="border-red-500 text-red-700 hover:bg-red-50">
                <ArrowUp className="h-3.5 w-3.5 mr-1" /> OUT
              </Button>
            </div>
          </div>
          <div className="max-h-[380px] overflow-y-auto -mx-1">
            {dayEvents.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-10">
                Cliquez sur « Nouveau » pour ajouter un événement à cette date.
              </div>
            ) : (
              <ul className="space-y-1.5 px-1">
                {dayEvents.map((m) => <EventRow key={m.id} m={m} />)}
              </ul>
            )}
          </div>
        </Card>
      </div>

      {/* À venir */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Événements à venir</h2>
          <Button asChild variant="ghost" size="sm"><Link to="/journal">Voir tout →</Link></Button>
        </div>
        {upcoming.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">Aucun événement planifié.</div>
        ) : (
          <ul className="divide-y">
            {upcoming.map((m) => (
              <li key={m.id} className="py-2 flex items-center gap-3 hover:bg-accent/40 -mx-2 px-2 rounded">
                <div className="font-mono text-xs w-24 shrink-0">{m.event_date}</div>
                <DirBadge dir={m.direction} />
                <div className="text-sm flex-1 min-w-0 truncate">
                  <span className="font-semibold">{m.strain || "—"}</span>
                  <span className="text-muted-foreground"> · </span>
                  <span className="font-mono text-xs">{m.batch_id}</span>
                </div>
                <div className="text-xs text-muted-foreground truncate max-w-[220px]">{m.destination || m.reason}</div>
                <div className="font-mono text-sm whitespace-nowrap">{Number(m.quantity_g).toFixed(1)}g</div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <MovementModal
        open={modalOpen}
        onOpenChange={(v) => { setModalOpen(v); if (!v) setPrefillDate(null); }}
        editing={null}
        movements={movements}
        defaultDate={prefillDate ?? undefined}
        prefill={{ direction: newDirection }}
      />
    </div>
  );
}

function EventRow({ m }: { m: Movement }) {
  return (
    <li className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-accent/50 border-l-2"
      style={{ borderLeftColor: m.direction === "IN" ? "rgb(16 185 129 / 0.6)" : "rgb(239 68 68 / 0.6)" }}
    >
      <DirBadge dir={m.direction} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{m.strain || "—"}</div>
        <div className="text-xs text-muted-foreground truncate">
          <span className="font-mono">{m.batch_id}</span>
          {m.destination && <> · {m.destination}</>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-mono text-sm">{Number(m.quantity_g).toFixed(1)}g</div>
        <div className="text-[10px] text-muted-foreground">{m.units} u</div>
      </div>
    </li>
  );
}

function DirBadge({ dir }: { dir: "IN" | "OUT" }) {
  return dir === "IN" ? (
    <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 gap-1 shrink-0">
      <ArrowDown className="h-3 w-3" /> IN
    </Badge>
  ) : (
    <Badge variant="outline" className="border-red-500/40 text-red-700 gap-1 shrink-0">
      <ArrowUp className="h-3 w-3" /> OUT
    </Badge>
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

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatFrDate(d: Date) {
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
