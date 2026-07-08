import { useMemo, useState, useEffect } from "react";
import { useStore, actions, computeBatchStock } from "@/lib/store";
import type { Movement, MovementType } from "@/lib/types";
import { PRODUCT_TYPES, PRODUCT_FORMATS, DESTINATIONS, OUT_DESTINATIONS, IN_DESTINATIONS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { ArrowDownToLine, ArrowUpFromLine, Zap, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";

type Props = {
  defaults?: Partial<Movement>;
  onSaved?: () => void;
  compact?: boolean;
};

function Combobox({
  value,
  onChange,
  options,
  placeholder,
  allowCreate = true,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  allowCreate?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="justify-between h-9 font-normal">
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>
              {allowCreate && query ? (
                <button
                  className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded"
                  onClick={() => {
                    onChange(query);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  Créer « {query} »
                </button>
              ) : (
                "Aucun résultat"
              )}
            </CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o}
                  value={o}
                  onSelect={() => {
                    onChange(o);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === o ? "opacity-100" : "opacity-0")} />
                  {o}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function MovementForm({ defaults, onSaved, compact }: Props) {
  const store = useStore();
  const [type, setType] = useState<MovementType>(defaults?.type || "OUT");
  const [initials, setInitials] = useState(defaults?.initials ?? store.currentUser);
  const [strain, setStrain] = useState(defaults?.strain ?? "");
  const [batchId, setBatchId] = useState(defaults?.batchId ?? "");
  const [productType, setProductType] = useState(defaults?.productType ?? "Fleur");
  const [productFormat, setProductFormat] = useState(defaults?.productFormat ?? "Bulk");
  const [quantity, setQuantity] = useState<string>(defaults?.quantity ? String(defaults.quantity) : "");
  const [units, setUnits] = useState<string>(defaults?.units ? String(defaults.units) : "1");
  const [destination, setDestination] = useState(defaults?.destination ?? "");
  const [comment, setComment] = useState(defaults?.comment ?? "");

  useEffect(() => {
    if (!initials && store.currentUser) setInitials(store.currentUser);
  }, [store.currentUser, initials]);

  const stock = useMemo(() => (batchId ? computeBatchStock(store.movements, batchId) : null), [store.movements, batchId]);

  const setTypeFromDest = (d: string) => {
    setDestination(d);
    if (OUT_DESTINATIONS.has(d)) setType("OUT");
    else if (IN_DESTINATIONS.has(d)) setType("IN");
  };

  const submit = () => {
    if (!initials) return toast.error("Initiales requises");
    if (!strain) return toast.error("Strain requise");
    if (!batchId) return toast.error("Lot requis");
    if (!destination) return toast.error("Destination / Raison requise");
    const q = parseFloat(quantity);
    if (!q || q <= 0) return toast.error("Quantité invalide");

    let category: Movement["category"] = null;
    if (destination.includes("Échantillonnage")) category = "internal-sample";
    if (destination.includes("Expédition")) category = "external-sample";

    actions.addMovement({
      date: new Date().toISOString(),
      initials: initials.toUpperCase(),
      strain,
      batchId,
      productType,
      productFormat,
      quantity: q,
      units: parseInt(units || "1", 10),
      type,
      destination,
      comment,
      category,
    });
    toast.success(`${type} enregistré · ${q}g · ${batchId}`);
    setQuantity("");
    setComment("");
    onSaved?.();
  };

  return (
    <div className={cn("space-y-3", compact && "text-sm")}>
      <div className="flex gap-2">
        <Button
          type="button"
          variant={type === "OUT" ? "default" : "outline"}
          className={cn("flex-1", type === "OUT" && "bg-red-600 hover:bg-red-700 text-white")}
          onClick={() => setType("OUT")}
        >
          <ArrowUpFromLine className="h-4 w-4 mr-1" /> SORTIE
        </Button>
        <Button
          type="button"
          variant={type === "IN" ? "default" : "outline"}
          className={cn("flex-1", type === "IN" && "bg-emerald-600 hover:bg-emerald-700 text-white")}
          onClick={() => setType("IN")}
        >
          <ArrowDownToLine className="h-4 w-4 mr-1" /> ENTRÉE
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Initiales</Label>
          <Input value={initials} onChange={(e) => setInitials(e.target.value.toUpperCase().slice(0, 4))} className="h-9 uppercase" />
        </div>
        <div>
          <Label className="text-xs">Type Produit</Label>
          <Select value={productType} onValueChange={setProductType}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{PRODUCT_TYPES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col">
          <Label className="text-xs mb-1">Strain</Label>
          <Combobox value={strain} onChange={setStrain} options={store.strains} placeholder="Sélectionner..." />
        </div>
        <div className="flex flex-col">
          <Label className="text-xs mb-1">Lot / Batch</Label>
          <Combobox value={batchId} onChange={setBatchId} options={store.batches} placeholder="BD-2601..." />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">Format</Label>
          <Select value={productFormat} onValueChange={setProductFormat}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{PRODUCT_FORMATS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Quantité (g)</Label>
          <Input type="number" inputMode="decimal" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="h-9 font-mono" />
        </div>
        <div>
          <Label className="text-xs">Unités</Label>
          <Input type="number" value={units} onChange={(e) => setUnits(e.target.value)} className="h-9 font-mono" />
        </div>
      </div>

      <div>
        <Label className="text-xs">Destination / Raison</Label>
        <Select value={destination} onValueChange={setTypeFromDest}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
          <SelectContent>{DESTINATIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs">Commentaire</Label>
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} className="resize-none" />
      </div>

      {batchId && stock !== null && (
        <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Stock actuel · {batchId}</span>
          <span className="font-mono font-semibold">{stock.toFixed(2)} g</span>
        </div>
      )}

      <Button onClick={submit} className="w-full" size="lg">
        <Zap className="h-4 w-4 mr-1" /> Enregistrer le mouvement
      </Button>
    </div>
  );
}
