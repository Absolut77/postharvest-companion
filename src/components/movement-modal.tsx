import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Check, ChevronsUpDown, Plus, ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { insertMovement, updateMovement } from "@/lib/movements";
import {
  PRODUCT_FORMATS, PRODUCT_TYPES, PACKAGED_FORMATS, inferGramsPerUnit,
  DESTINATIONS, STAMP_TYPES,
} from "@/lib/constants";
import type { Movement, Direction } from "@/lib/types";
import { useCurrentUser } from "@/lib/current-user";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: Movement | null;
  movements: Movement[];
};

const empty = (initials: string) => ({
  event_date: new Date().toISOString().slice(0, 10),
  initials,
  strain: "",
  batch_id: "",
  product_type: "",
  product_format: "Bulk",
  quantity_g: 0,
  units: 0,
  direction: "OUT" as Direction,
  reason: "",
  detail: "",
  sku: "",
  comment: "",
  destination: "",
  comment1: "",
  comment2: "",
  adjustment_validation: false,
  stamp_used: "",
  stamp_type: "",
  additional_comments: "",
  elevated_update: false,
});

export function MovementModal({ open, onOpenChange, editing, movements }: Props) {
  const currentUser = useCurrentUser();
  const [form, setForm] = useState(empty(currentUser));
  const qc = useQueryClient();

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        event_date: editing.event_date,
        initials: editing.initials,
        strain: editing.strain,
        batch_id: editing.batch_id,
        product_type: editing.product_type,
        product_format: editing.product_format || "Bulk",
        quantity_g: Number(editing.quantity_g),
        units: Number(editing.units),
        direction: editing.direction,
        reason: editing.reason ?? "",
        detail: editing.detail ?? "",
        sku: editing.sku ?? "",
        comment: editing.comment ?? "",
        destination: editing.destination ?? "",
        comment1: editing.comment1 ?? "",
        comment2: editing.comment2 ?? "",
        adjustment_validation: !!editing.adjustment_validation,
        stamp_used: editing.stamp_used ?? "",
        stamp_type: editing.stamp_type ?? "",
        additional_comments: editing.additional_comments ?? "",
        elevated_update: !!editing.elevated_update,
      });
    } else {
      setForm(empty(currentUser));
    }
  }, [open, editing, currentUser]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Index Batch → Strain (dernier vu) et Strain → Batches
  const { batchToStrain, strainToBatches, allStrains, allBatches, allProductTypes, allFormats, allDestinations, allStamps } = useMemo(() => {
    const b2s = new Map<string, string>();
    const s2b = new Map<string, Set<string>>();
    const strains = new Set<string>();
    const batches = new Set<string>();
    const types = new Set<string>();
    const formats = new Set<string>();
    const dests = new Set<string>();
    const stamps = new Set<string>();
    for (const m of movements) {
      if (m.batch_id && m.strain) b2s.set(m.batch_id, m.strain);
      if (m.strain) {
        strains.add(m.strain);
        if (m.batch_id) {
          if (!s2b.has(m.strain)) s2b.set(m.strain, new Set());
          s2b.get(m.strain)!.add(m.batch_id);
        }
      }
      if (m.batch_id) batches.add(m.batch_id);
      if (m.product_type) types.add(m.product_type);
      if (m.product_format) formats.add(m.product_format);
      if (m.destination) dests.add(m.destination);
      if (m.stamp_used) stamps.add(m.stamp_used);
    }
    return {
      batchToStrain: b2s,
      strainToBatches: s2b,
      allStrains: Array.from(strains).sort(),
      allBatches: Array.from(batches).sort(),
      allProductTypes: Array.from(new Set([...PRODUCT_TYPES, ...types])).sort(),
      allFormats: Array.from(new Set([...PRODUCT_FORMATS, ...formats])).sort(),
      allDestinations: Array.from(new Set([...DESTINATIONS, ...dests])).sort(),
      allStamps: Array.from(stamps).sort(),
    };
  }, [movements]);

  // Batches filtrés par strain sélectionnée
  const batchOptions = useMemo(() => {
    if (form.strain && strainToBatches.has(form.strain)) {
      return Array.from(strainToBatches.get(form.strain)!).sort();
    }
    return allBatches;
  }, [form.strain, strainToBatches, allBatches]);

  // Auto-fill strain quand un batch connu est choisi
  const onBatchChange = (v: string) => {
    setForm((f) => {
      const next = { ...f, batch_id: v };
      const s = batchToStrain.get(v);
      if (s && !f.strain) next.strain = s;
      // Si strain incohérente, on la remplace par celle du batch
      if (s && f.strain && f.strain !== s) next.strain = s;
      return next;
    });
  };

  // Auto-calc Qté ↔ Unités pour formats packagés
  const isPackaged = PACKAGED_FORMATS.has(form.product_format);
  const gPerUnit = inferGramsPerUnit(form.product_type);

  const onUnitsChange = (u: number) => {
    setForm((f) => {
      const next = { ...f, units: u };
      if (isPackaged && gPerUnit) next.quantity_g = +(u * gPerUnit).toFixed(3);
      return next;
    });
  };
  const onQuantityChange = (q: number) => {
    setForm((f) => {
      const next = { ...f, quantity_g: q };
      if (isPackaged && gPerUnit) next.units = Math.round(q / gPerUnit);
      return next;
    });
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form, reason: form.destination || form.reason };
      if (editing) return updateMovement(editing.id, payload);
      return insertMovement(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["movements"] });
      toast.success(editing ? "Ligne mise à jour" : "Événement ajouté");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const submit = () => {
    if (!form.initials) return toast.error("Initiales requises");
    if (!form.strain) return toast.error("Strain requise");
    if (!form.batch_id) return toast.error("Batch/Lot ID requis");
    if (form.quantity_g <= 0 && form.units <= 0)
      return toast.error("Quantité ou unités requise");
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifier l'événement" : "Ajouter un événement"}</DialogTitle>
          <DialogDescription>Toute saisie ici met à jour l'inventaire automatiquement.</DialogDescription>
        </DialogHeader>

        {/* Direction */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => set("direction", "IN")}
            className={cn(
              "h-14 rounded-md border-2 flex items-center justify-center gap-2 font-semibold transition",
              form.direction === "IN"
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-700"
                : "border-border text-muted-foreground hover:bg-accent"
            )}
          >
            <ArrowDown className="h-5 w-5" /> IN (Entrée)
          </button>
          <button
            type="button"
            onClick={() => set("direction", "OUT")}
            className={cn(
              "h-14 rounded-md border-2 flex items-center justify-center gap-2 font-semibold transition",
              form.direction === "OUT"
                ? "border-red-500 bg-red-500/10 text-red-700"
                : "border-border text-muted-foreground hover:bg-accent"
            )}
          >
            <ArrowUp className="h-5 w-5" /> OUT (Sortie)
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Date</Label>
            <Input type="date" value={form.event_date} onChange={(e) => set("event_date", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Initiales</Label>
            <Input value={form.initials} onChange={(e) => set("initials", e.target.value.toUpperCase().slice(0, 4))} className="uppercase font-mono" />
          </div>

          <div>
            <Label className="text-xs">Strain</Label>
            <ComboCreate
              value={form.strain}
              onChange={(v) => set("strain", v)}
              options={allStrains}
              placeholder="Sélectionner ou créer…"
              createLabel="Créer la strain"
            />
          </div>
          <div>
            <Label className="text-xs">
              Batch / Lot ID
              {form.strain && (
                <span className="ml-2 text-[10px] text-muted-foreground font-normal">
                  ({batchOptions.length} pour {form.strain})
                </span>
              )}
            </Label>
            <ComboCreate
              value={form.batch_id}
              onChange={onBatchChange}
              options={batchOptions}
              placeholder="Sélectionner ou créer…"
              createLabel="Créer le lot"
              mono
            />
          </div>

          <div>
            <Label className="text-xs">Product Type</Label>
            <ComboCreate
              value={form.product_type}
              onChange={(v) => set("product_type", v)}
              options={allProductTypes}
              placeholder="Type…"
              createLabel="Créer le type"
            />
          </div>
          <div>
            <Label className="text-xs">Product Format</Label>
            <Select value={form.product_format} onValueChange={(v) => set("product_format", v)}>
              <SelectTrigger><SelectValue placeholder="Format…" /></SelectTrigger>
              <SelectContent>
                {allFormats.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs flex items-center gap-2">
              Quantité (g)
              {isPackaged && gPerUnit && <span className="text-[10px] text-primary">↔ auto ({gPerUnit}g/u)</span>}
            </Label>
            <Input type="number" step="0.01" min="0" value={form.quantity_g}
              onChange={(e) => onQuantityChange(parseFloat(e.target.value) || 0)}
              className="font-mono" />
          </div>
          <div>
            <Label className="text-xs flex items-center gap-2">
              Unités
              {isPackaged && gPerUnit && <span className="text-[10px] text-primary">↔ auto</span>}
            </Label>
            <Input type="number" min="0" value={form.units}
              onChange={(e) => onUnitsChange(parseInt(e.target.value || "0", 10))}
              className="font-mono" />
          </div>

          <div className="col-span-2">
            <Label className="text-xs">Destination</Label>
            <ComboCreate
              value={form.destination}
              onChange={(v) => set("destination", v)}
              options={allDestinations}
              placeholder="Destination…"
              createLabel="Créer une destination"
            />
          </div>

          <div className="col-span-2">
            <Label className="text-xs">Commentaire #1</Label>
            <Input value={form.comment1} onChange={(e) => set("comment1", e.target.value)} />
          </div>

          <div className="col-span-2 flex items-center gap-2 py-1">
            <Checkbox
              id="adj"
              checked={form.adjustment_validation}
              onCheckedChange={(v) => set("adjustment_validation", !!v)}
            />
            <Label htmlFor="adj" className="text-sm cursor-pointer">Adjustment Validation</Label>
          </div>

          <div className="col-span-2">
            <Label className="text-xs">Commentaire #2</Label>
            <Input value={form.comment2} onChange={(e) => set("comment2", e.target.value)} />
          </div>

          <div>
            <Label className="text-xs">Timbre utilisé</Label>
            <ComboCreate
              value={form.stamp_used}
              onChange={(v) => set("stamp_used", v)}
              options={allStamps}
              placeholder="N° / réf. timbre…"
              createLabel="Ajouter"
              mono
            />
          </div>
          <div>
            <Label className="text-xs">Type de timbre</Label>
            <Select value={form.stamp_type || "__none__"} onValueChange={(v) => set("stamp_type", v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Type…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {STAMP_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2">
            <Label className="text-xs">SKU</Label>
            <Input value={form.sku} onChange={(e) => set("sku", e.target.value)} className="font-mono" />
          </div>

          <div className="col-span-2">
            <Label className="text-xs">Commentaires additionnels</Label>
            <Textarea value={form.additional_comments} onChange={(e) => set("additional_comments", e.target.value)} rows={2} />
          </div>

          <div className="col-span-2 flex items-center gap-2 py-1">
            <Checkbox
              id="elev"
              checked={form.elevated_update}
              onCheckedChange={(v) => set("elevated_update", !!v)}
            />
            <Label htmlFor="elev" className="text-sm cursor-pointer">Elevated Update</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? "…" : editing ? "Enregistrer" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ComboCreate({
  value, onChange, options, placeholder, createLabel, mono,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  createLabel: string;
  mono?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const canCreate = search.trim().length > 0 && !options.some((o) => o.toLowerCase() === search.trim().toLowerCase());
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn("w-full justify-between font-normal", mono && "font-mono", !value && "text-muted-foreground")}
        >
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Rechercher…" value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>Aucun résultat</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem key={o} value={o} onSelect={() => { onChange(o); setOpen(false); setSearch(""); }}>
                  <Check className={cn("mr-2 h-4 w-4", o === value ? "opacity-100" : "opacity-0")} />
                  <span className={mono ? "font-mono text-sm" : ""}>{o}</span>
                </CommandItem>
              ))}
              {canCreate && (
                <CommandItem
                  value={`__create__${search}`}
                  onSelect={() => { onChange(search.trim()); setOpen(false); setSearch(""); }}
                  className="text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {createLabel} : <span className={cn("ml-1 font-semibold", mono && "font-mono")}>{search.trim()}</span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
