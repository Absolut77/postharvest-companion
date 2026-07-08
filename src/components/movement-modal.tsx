import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Check, ChevronsUpDown, Plus, ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { insertMovement, updateMovement } from "@/lib/movements";
import { PRODUCT_FORMATS, PRODUCT_TYPES, REASONS_IN, REASONS_OUT } from "@/lib/constants";
import type { Movement, Direction } from "@/lib/types";
import { useCurrentUser } from "@/lib/current-user";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: Movement | null;
  knownStrains: string[];
  knownBatches: string[];
  knownProductTypes: string[];
  knownFormats: string[];
  knownReasons: string[];
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
});

export function MovementModal({
  open, onOpenChange, editing,
  knownStrains, knownBatches, knownProductTypes, knownFormats, knownReasons,
}: Props) {
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
        reason: editing.reason,
        detail: editing.detail,
        sku: editing.sku,
        comment: editing.comment,
      });
    } else {
      setForm(empty(currentUser));
    }
  }, [open, editing, currentUser]);

  const set = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const reasonOptions = useMemo(() => {
    const base = form.direction === "IN" ? REASONS_IN : REASONS_OUT;
    return Array.from(new Set([...base, ...knownReasons])).sort();
  }, [form.direction, knownReasons]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (editing) return updateMovement(editing.id, form);
      return insertMovement(form);
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifier l'événement" : "Ajouter un événement"}</DialogTitle>
          <DialogDescription>Toute saisie ici met à jour l'inventaire automatiquement.</DialogDescription>
        </DialogHeader>

        {/* Direction toggle */}
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
              options={knownStrains}
              placeholder="Sélectionner ou créer…"
              createLabel="Créer la strain"
            />
          </div>
          <div>
            <Label className="text-xs">Batch / Lot ID</Label>
            <ComboCreate
              value={form.batch_id}
              onChange={(v) => set("batch_id", v)}
              options={knownBatches}
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
              options={Array.from(new Set([...PRODUCT_TYPES, ...knownProductTypes])).sort()}
              placeholder="Type…"
              createLabel="Créer le type"
            />
          </div>
          <div>
            <Label className="text-xs">Product Format</Label>
            <Select value={form.product_format} onValueChange={(v) => set("product_format", v)}>
              <SelectTrigger><SelectValue placeholder="Format…" /></SelectTrigger>
              <SelectContent>
                {Array.from(new Set([...PRODUCT_FORMATS, ...knownFormats])).sort().map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Quantité (g)</Label>
            <Input type="number" step="0.01" min="0" value={form.quantity_g}
              onChange={(e) => set("quantity_g", parseFloat(e.target.value) || 0)}
              className="font-mono" />
          </div>
          <div>
            <Label className="text-xs">Unités</Label>
            <Input type="number" min="0" value={form.units}
              onChange={(e) => set("units", parseInt(e.target.value || "0", 10))}
              className="font-mono" />
          </div>

          <div className="col-span-2">
            <Label className="text-xs">Destination / Raison</Label>
            <ComboCreate
              value={form.reason}
              onChange={(v) => set("reason", v)}
              options={reasonOptions}
              placeholder="Raison du mouvement…"
              createLabel="Créer une raison"
            />
          </div>

          <div className="col-span-2">
            <Label className="text-xs">Commentaire</Label>
            <Textarea value={form.comment} onChange={(e) => set("comment", e.target.value)} rows={2} placeholder="Détails additionnels…" />
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
