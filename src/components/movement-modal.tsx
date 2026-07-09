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
import { Check, ChevronsUpDown, Plus, ArrowDown, ArrowUp, X, PackageOpen } from "lucide-react";
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
import { ColoredCheckbox } from "./colored-checkbox";
import { computeAvailableBags, computeNetByQualification, type AvailableBag, QUALIFICATIONS, type Qualification } from "@/lib/bags";
import {
  OUT_CATEGORIES, FACILITY_PURPOSES, IN_CATEGORIES,
  CULTIVATION_QUALIFS, PROVINCES,
  detectOutCategory, detectFacilityPurpose, detectInCategory,
  outInputMode, inInputMode, formatForCultivationQualif,
  type OutCategory, type FacilityPurpose, type InCategory,
} from "@/lib/movement-taxonomy";


type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: Movement | null;
  movements: Movement[];
  defaultDate?: string;
  prefill?: { batch_id?: string; strain?: string; comment2?: string; product_format?: string; direction?: Direction };
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
  units2: 0,
  unit_indicator: "",
});

export function MovementModal({ open, onOpenChange, editing, movements, defaultDate, prefill }: Props) {
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
        units2: Number(editing.units2 ?? 0),
        unit_indicator: editing.unit_indicator ?? "",
      });
    } else {
      setForm({
        ...empty(currentUser),
        event_date: defaultDate ?? new Date().toISOString().slice(0, 10),
        ...(prefill ?? {}),
      });
    }
  }, [open, editing, currentUser, defaultDate, prefill]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const { batchToStrain, strainToBatches, allStrains, allBatches, allProductTypes, allFormats, allDestinations, allStamps, allIndicators } = useMemo(() => {
    const b2s = new Map<string, string>();
    const s2b = new Map<string, Set<string>>();
    const strains = new Set<string>();
    const batches = new Set<string>();
    const types = new Set<string>();
    const formats = new Set<string>();
    const dests = new Set<string>();
    const stamps = new Set<string>();
    const indicators = new Set<string>();
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
      if (m.unit_indicator) indicators.add(m.unit_indicator);
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
      allIndicators: Array.from(indicators).sort(),
    };
  }, [movements]);

  // Strain sélectionnée → filtre les batchs. Inversement, un batch sélectionné → force la strain associée.
  const batchOptions = useMemo(() => {
    if (form.strain && strainToBatches.has(form.strain)) {
      return Array.from(strainToBatches.get(form.strain)!).sort();
    }
    return allBatches;
  }, [form.strain, strainToBatches, allBatches]);

  const strainOptions = useMemo(() => {
    // Si un batch est choisi mais aucune strain, on ne restreint pas
    return allStrains;
  }, [allStrains]);

  const onBatchChange = (v: string) => {
    setForm((f) => {
      const next = { ...f, batch_id: v };
      const s = batchToStrain.get(v);
      if (s) next.strain = s; // filtrage intelligent inverse
      return next;
    });
  };

  const onStrainChange = (v: string) => {
    setForm((f) => {
      const next = { ...f, strain: v };
      // Si le batch actuel n'appartient pas à cette strain, on le vide
      if (f.batch_id && batchToStrain.get(f.batch_id) !== v) next.batch_id = "";
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

  // ============= OUT bag picker (state) =============
  const isOut = form.direction === "OUT";
  const isEditing = !!editing;
  // NB: showBagPicker is derived later from inputMode; here we still need bag data for any OUT sub-type.
  const needsBagPickerData = isOut && !isEditing;

  const [selectedBagKeys, setSelectedBagKeys] = useState<Set<string>>(new Set());

  // Reset selection when batch changes or modal reopens
  useEffect(() => { setSelectedBagKeys(new Set()); }, [form.batch_id, open]);

  const availableBags = useMemo<AvailableBag[]>(
    () => (needsBagPickerData && form.batch_id ? computeAvailableBags(form.batch_id, movements) : []),
    [needsBagPickerData, form.batch_id, movements],
  );
  const netByQualif = useMemo(
    () => (needsBagPickerData && form.batch_id ? computeNetByQualification(form.batch_id, movements) : new Map()),
    [needsBagPickerData, form.batch_id, movements],
  );

  const bagsByQualif = useMemo(() => {
    const map = new Map<string, AvailableBag[]>();
    for (const b of availableBags) {
      if (!map.has(b.qualification)) map.set(b.qualification, []);
      map.get(b.qualification)!.push(b);
    }
    return map;
  }, [availableBags]);

  const selectedBags = useMemo(
    () => availableBags.filter((b) => selectedBagKeys.has(b.key)),
    [availableBags, selectedBagKeys],
  );
  const selectedTotalG = selectedBags.reduce((s, b) => s + b.grams, 0);
  const selectedUnits = selectedBags.length;

  // Sync form fields from selected bags (only when the picker actually has a selection)
  useEffect(() => {
    if (!needsBagPickerData) return;
    if (selectedBagKeys.size === 0) return;
    const qualifs = new Set(selectedBags.map((b) => b.qualification));
    const singleQualif = qualifs.size === 1 ? Array.from(qualifs)[0] : "";
    setForm((f) => ({
      ...f,
      quantity_g: +selectedTotalG.toFixed(2),
      units: selectedUnits,
      product_format: f.product_format || "Bulk",
      comment2: singleQualif || f.comment2,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsBagPickerData, selectedTotalG, selectedUnits]);

  const toggleBag = (key: string) => {
    setSelectedBagKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // ============= Sub-type taxonomy =============
  const isIn = form.direction === "IN";

  // IN state
  const [inCat, setInCat] = useState<InCategory>("cultivation");
  const [cultivationQualif, setCultivationQualif] = useState<string>("");

  // OUT state
  const [outCat, setOutCat] = useState<OutCategory>("facility");
  const [facilityPurpose, setFacilityPurpose] = useState<FacilityPurpose>("b2b_sale");

  // Shared conditional fields
  const [province, setProvince] = useState<string>("");
  const [packagedBatch, setPackagedBatch] = useState<string>("");
  const [recipient, setRecipient] = useState<string>("");

  // Derive input mode
  const inputMode = isEditing
    ? "manualEntry"
    : isIn
      ? inInputMode(inCat)
      : outInputMode(outCat, facilityPurpose);

  const showBagPicker = !isEditing && inputMode === "bagPicker";
  const showReturnBuilder = !isEditing && inputMode === "bagBuilder";
  const showCultivationEntry = !isEditing && inputMode === "cultivationEntry";
  const showPackagedShipment = !isEditing && inputMode === "packagedShipment";
  const showManualSample = !isEditing && inputMode === "manualSample";
  const showManualEntry = isEditing || inputMode === "manualEntry";

  // Return bag builder rows
  type ReturnRow = { id: string; qualification: Qualification | ""; grams: number };
  const [returnBags, setReturnBags] = useState<ReturnRow[]>([]);
  const addReturnBag = () => setReturnBags((r) => [...r, { id: crypto.randomUUID(), qualification: "", grams: 0 }]);
  const updateReturnBag = (id: string, patch: Partial<ReturnRow>) =>
    setReturnBags((r) => r.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const removeReturnBag = (id: string) => setReturnBags((r) => r.filter((b) => b.id !== id));

  // Init when modal opens or editing changes
  useEffect(() => {
    if (!open) return;
    if (editing) {
      if (editing.direction === "IN") {
        const c = detectInCategory(editing.reason || "");
        setInCat(c);
        if (c === "cultivation") setCultivationQualif(editing.comment2 || "");
      } else {
        const c = detectOutCategory(editing.reason || "");
        setOutCat(c);
        if (c === "facility") setFacilityPurpose(detectFacilityPurpose(editing.comment2 || ""));
      }
      setProvince(editing.unit_indicator || "");
      setPackagedBatch(editing.comment2 || "");
      setRecipient(editing.additional_comments || "");
      setReturnBags([]);
      setCultivationQualif(editing.comment2 || "");
    } else {
      setInCat("cultivation");
      setOutCat("facility");
      setFacilityPurpose("b2b_sale");
      setCultivationQualif("");
      setProvince("");
      setPackagedBatch("");
      setRecipient("");
      setReturnBags([]);
    }
  }, [open, editing]);

  // Seed one empty row when entering bag builder mode
  useEffect(() => {
    if (showReturnBuilder && returnBags.length === 0) {
      setReturnBags([{ id: crypto.randomUUID(), qualification: "", grams: 0 }]);
    }
  }, [showReturnBuilder]); // eslint-disable-line react-hooks/exhaustive-deps

  const returnTotalG = returnBags.reduce((s, b) => s + (Number(b.grams) || 0), 0);
  const returnUnits = returnBags.filter((b) => (Number(b.grams) || 0) > 0).length;

  // Sync form from return builder
  useEffect(() => {
    if (!showReturnBuilder) return;
    const qualifs = new Set(returnBags.map((b) => b.qualification).filter(Boolean));
    const singleQualif = qualifs.size === 1 ? Array.from(qualifs)[0] : "";
    setForm((f) => ({
      ...f,
      quantity_g: +returnTotalG.toFixed(2),
      units: returnUnits,
      product_format: f.product_format || (isIn ? IN_CATEGORIES.find((c) => c.id === inCat)?.defaultFormat ?? "Bulk" : "Bulk"),
      comment2: singleQualif || f.comment2,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showReturnBuilder, returnTotalG, returnUnits]);

  // Auto-set product_format from sub-type
  useEffect(() => {
    if (isEditing) return;
    if (isIn) {
      const cfg = IN_CATEGORIES.find((c) => c.id === inCat);
      if (cfg) setForm((f) => ({ ...f, product_format: cfg.defaultFormat }));
    } else if (outCat === "facility") {
      const cfg = FACILITY_PURPOSES.find((p) => p.id === facilityPurpose);
      if (cfg) setForm((f) => ({ ...f, product_format: cfg.defaultFormat }));
    } else {
      const cfg = OUT_CATEGORIES.find((c) => c.id === outCat);
      if (cfg && cfg.id === "sampling") setForm((f) => ({ ...f, product_format: "Sample" }));
      else setForm((f) => ({ ...f, product_format: "Bulk" }));
    }
  }, [isIn, inCat, outCat, facilityPurpose, isEditing]);

  // Auto-set comment2 from cultivation qualif
  useEffect(() => {
    if (isEditing) return;
    if (isIn && inCat === "cultivation" && cultivationQualif) {
      setForm((f) => ({
        ...f,
        comment2: cultivationQualif,
        product_format: formatForCultivationQualif(cultivationQualif),
      }));
    }
  }, [cultivationQualif, isIn, inCat, isEditing]);

  const mutation = useMutation({
    mutationFn: async () => {
      let reason = form.reason;
      let destination = form.destination;
      let comment2 = form.comment2;
      let unit_indicator = form.unit_indicator;
      let additional_comments = form.additional_comments;

      if (!editing) {
        if (isIn) {
          const cfg = IN_CATEGORIES.find((c) => c.id === inCat)!;
          reason = cfg.reason;
          destination = "In";
          if (cfg.needsQualif && cultivationQualif) comment2 = cultivationQualif;
          if (cfg.needsPackagedBatch && packagedBatch) comment2 = packagedBatch;
          if (cfg.needsRecipient && recipient) additional_comments = additional_comments || recipient;
        } else {
          const outCfg = OUT_CATEGORIES.find((c) => c.id === outCat)!;
          reason = outCfg.reason;
          destination = "Out";
          if (outCat === "facility") {
            const pCfg = FACILITY_PURPOSES.find((p) => p.id === facilityPurpose)!;
            if (pCfg.comment2) comment2 = pCfg.comment2;
            if (pCfg.needsProvince && province) unit_indicator = province;
            if (pCfg.needsRecipient && recipient) additional_comments = additional_comments || recipient;
          }
          if (outCat === "packaging" && packagedBatch) comment2 = packagedBatch;
        }
      }

      const payload = { ...form, reason, destination, comment2, unit_indicator, additional_comments };
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifier l'événement" : "Ajouter un événement"}</DialogTitle>
          <DialogDescription>Toute saisie ici met à jour l'inventaire automatiquement.</DialogDescription>
        </DialogHeader>

        {/* Direction lock banner */}
        <div
          className={cn(
            "h-12 rounded-md border-2 flex items-center justify-center gap-2 font-semibold",
            isOut
              ? "border-red-500 bg-red-500/10 text-red-700"
              : "border-emerald-500 bg-emerald-500/10 text-emerald-700",
          )}
        >
          {isOut ? <><ArrowUp className="h-5 w-5" /> OUT (Sortie)</> : <><ArrowDown className="h-5 w-5" /> IN (Entrée)</>}
          <span className="text-xs font-normal opacity-70 ml-2">Verrouillé</span>
        </div>

        {/* Sub-type selector (taxonomie officielle Log 2026) */}
        {!isEditing && (
          <div className="space-y-2">
            <div>
              <Label className="text-xs mb-1 block">Catégorie</Label>
              <div className="flex flex-wrap gap-1.5">
                {isOut
                  ? OUT_CATEGORIES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setOutCat(t.id)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs border transition",
                          outCat === t.id
                            ? "border-red-500 bg-red-500/10 text-red-700 font-semibold"
                            : "border-border text-muted-foreground hover:bg-accent",
                          t.temp && outCat !== t.id && "border-dashed",
                        )}
                        title={t.hint}
                      >
                        {t.label}
                        <span className="ml-1 text-[10px] opacity-70">· {t.hint}</span>
                      </button>
                    ))
                  : IN_CATEGORIES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setInCat(t.id)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs border transition",
                          inCat === t.id
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 font-semibold"
                            : "border-border text-muted-foreground hover:bg-accent",
                        )}
                        title={t.hint}
                      >
                        {t.label}
                      </button>
                    ))}
              </div>
            </div>

            {/* Second-tier: OUT of Facility purpose */}
            {isOut && outCat === "facility" && (
              <div>
                <Label className="text-xs mb-1 block">Motif</Label>
                <div className="flex flex-wrap gap-1.5">
                  {FACILITY_PURPOSES.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setFacilityPurpose(p.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs border transition",
                        facilityPurpose === p.id
                          ? "border-red-500 bg-red-500/10 text-red-700 font-semibold"
                          : "border-border text-muted-foreground hover:bg-accent",
                      )}
                      title={p.hint}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Second-tier: IN Cultivation qualification */}
            {!isOut && inCat === "cultivation" && (
              <div>
                <Label className="text-xs mb-1 block">Qualification (Comment #2)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {CULTIVATION_QUALIFS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setCultivationQualif(q)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs border transition",
                        cultivationQualif === q
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 font-semibold"
                          : "border-border text-muted-foreground hover:bg-accent",
                      )}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Conditional fields driven by sub-type (province / packaged batch / recipient) */}
        {!isEditing && (() => {
          const showProvince =
            (isOut && outCat === "facility" && (facilityPurpose === "messager" || facilityPurpose === "b2b_sale"));
          const showPackagedBatch =
            (isOut && outCat === "packaging") ||
            (!isOut && (inCat === "back_pack" || inCat === "standby"));
          const showRecipient =
            (isOut && outCat === "facility" && facilityPurpose !== "other" && facilityPurpose !== "messager") ||
            (!isOut && inCat === "external");
          if (!showProvince && !showPackagedBatch && !showRecipient) return null;
          return (
            <div className="grid grid-cols-3 gap-2 rounded-md border bg-muted/30 p-2">
              {showProvince && (
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground">Province / Distributeur</Label>
                  <Select value={province || "__none__"} onValueChange={(v) => setProvince(v === "__none__" ? "" : v)}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {PROVINCES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {showPackagedBatch && (
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground">
                    {isOut ? "Batch packagé cible" : inCat === "standby" ? "Batch packagé produit" : "Batch packagé source"}
                  </Label>
                  <Input
                    value={packagedBatch}
                    onChange={(e) => setPackagedBatch(e.target.value)}
                    placeholder="ex : ONO-0120-03"
                    className="h-8 font-mono text-xs"
                  />
                </div>
              )}
              {showRecipient && (
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground">Destinataire</Label>
                  <Input
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder={isOut ? "PPB Labs, Nuance MJ…" : "Client externe…"}
                    className="h-8 text-xs"
                  />
                </div>
              )}
            </div>
          );
        })()}


        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Date</Label>
            <Input type="date" value={form.event_date} onChange={(e) => set("event_date", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Requester Initials</Label>
            <Input value={form.initials} onChange={(e) => set("initials", e.target.value.toUpperCase().slice(0, 4))} className="uppercase font-mono" />
          </div>

          <div>
            <Label className="text-xs">Strain</Label>
            <ComboCreate
              value={form.strain}
              onChange={onStrainChange}
              options={strainOptions}
              placeholder="Sélectionner ou créer…"
              createLabel="Créer la strain"
              onClear={() => set("strain", "")}
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
              onClear={() => set("batch_id", "")}
              mono
            />
          </div>

          {/* ============= OUT: Bag picker ============= */}
          {showBagPicker && (
            <div className="col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-1">
                  <PackageOpen className="h-3.5 w-3.5" /> Sélection de sacs disponibles
                </Label>
                <div className="text-xs text-muted-foreground">
                  {selectedUnits} sac{selectedUnits > 1 ? "s" : ""} · <span className="font-mono font-semibold text-foreground">{selectedTotalG.toFixed(2)} g</span>
                </div>
              </div>
              {!form.batch_id ? (
                <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                  Sélectionne d'abord une strain et un batch.
                </div>
              ) : availableBags.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                  Aucun sac "In from Cultivation" trouvé pour ce lot.
                </div>
              ) : (
                <div className="rounded-md border max-h-72 overflow-y-auto divide-y">
                  {QUALIFICATIONS.filter((q) => bagsByQualif.has(q)).map((q) => {
                    const bags = bagsByQualif.get(q)!;
                    const net = netByQualif.get(q) ?? 0;
                    return (
                      <div key={q} className="p-2">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="text-xs font-semibold">{q}</div>
                          <div className={cn(
                            "text-[11px] font-mono",
                            net < 0 ? "text-red-600" : "text-muted-foreground",
                          )}>
                            net stock : {net.toFixed(1)} g
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          {bags.map((b) => {
                            const checked = selectedBagKeys.has(b.key);
                            return (
                              <label
                                key={b.key}
                                className={cn(
                                  "flex items-center gap-2 rounded border px-2 py-1.5 text-xs cursor-pointer transition",
                                  checked ? "border-primary bg-primary/10" : "hover:bg-accent",
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleBag(b.key)}
                                  className="h-3.5 w-3.5 accent-primary"
                                />
                                <span className="font-mono font-semibold">{b.grams.toFixed(0)} g</span>
                                <span className="text-muted-foreground">
                                  {b.isFull ? `plein (${b.bagSize} g)` : "reste"}
                                </span>
                                <span className="ml-auto text-[10px] text-muted-foreground font-mono">
                                  {b.sourceDate}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {selectedTotalG > 0 && (
                <div className="text-[11px] text-muted-foreground">
                  Quantité et Units sont calculées automatiquement à partir de la sélection.
                </div>
              )}
            </div>
          )}

          {/* ============= IN: Return bag builder ============= */}
          {showReturnBuilder && (
            <div className="col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-1">
                  <PackageOpen className="h-3.5 w-3.5" /> Sacs retournés
                </Label>
                <div className="text-xs text-muted-foreground">
                  {returnUnits} sac{returnUnits > 1 ? "s" : ""} · <span className="font-mono font-semibold text-foreground">{returnTotalG.toFixed(2)} g</span>
                </div>
              </div>
              <div className="rounded-md border divide-y">
                {returnBags.map((b, i) => (
                  <div key={b.id} className="flex items-center gap-2 p-2">
                    <span className="text-[10px] text-muted-foreground font-mono w-6">#{i + 1}</span>
                    <Select
                      value={b.qualification || "__none__"}
                      onValueChange={(v) => updateReturnBag(b.id, { qualification: v === "__none__" ? "" : (v as Qualification) })}
                    >
                      <SelectTrigger className="h-8 flex-1 min-w-[180px]">
                        <SelectValue placeholder="Qualification…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        {QUALIFICATIONS.map((q) => (
                          <SelectItem key={q} value={q}>{q}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={b.grams || ""}
                      placeholder="grammes"
                      onChange={(e) => updateReturnBag(b.id, { grams: parseFloat(e.target.value) || 0 })}
                      className="h-8 w-28 font-mono"
                    />
                    <span className="text-xs text-muted-foreground">g</span>
                    <button
                      type="button"
                      onClick={() => removeReturnBag(b.id)}
                      className="h-8 w-8 inline-flex items-center justify-center text-muted-foreground hover:text-red-600"
                      title="Retirer ce sac"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addReturnBag}>
                <Plus className="h-4 w-4 mr-1" /> Ajouter un sac
              </Button>
              <div className="text-[11px] text-muted-foreground">
                Quantité et Units se calculent à partir des sacs. La qualification renseigne automatiquement Comment #2 si tous les sacs partagent la même.
              </div>
            </div>
          )}

          {/* ============= IN Cultivation: classic form ============= */}
          {!showBagPicker && !showReturnBuilder && (
            <>
              <div>
                <Label className="text-xs">Product Type</Label>
                <ComboCreate
                  value={form.product_type}
                  onChange={(v) => set("product_type", v)}
                  options={allProductTypes}
                  placeholder="Type…"
                  createLabel="Créer le type"
                  onClear={() => set("product_type", "")}
                />
              </div>
              <div>
                <Label className="text-xs">Product Format</Label>
                <div className="flex items-center gap-1">
                  <Select value={form.product_format} onValueChange={(v) => set("product_format", v)}>
                    <SelectTrigger><SelectValue placeholder="Format…" /></SelectTrigger>
                    <SelectContent>
                      {allFormats.map((f) => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.product_format && (
                    <ClearBtn onClick={() => set("product_format", "")} />
                  )}
                </div>
              </div>

              <div>
                <Label className="text-xs flex items-center gap-2">
                  Quantity (G)
                  {isPackaged && gPerUnit && <span className="text-[10px] text-primary">↔ auto ({gPerUnit}g/u)</span>}
                </Label>
                <Input type="number" step="0.01" min="0" value={form.quantity_g}
                  onChange={(e) => onQuantityChange(parseFloat(e.target.value) || 0)}
                  className="font-mono" />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-2">
                  Units
                  {isPackaged && gPerUnit && <span className="text-[10px] text-primary">↔ auto</span>}
                </Label>
                <Input type="number" min="0" value={form.units}
                  onChange={(e) => onUnitsChange(parseInt(e.target.value || "0", 10))}
                  className="font-mono" />
              </div>

              <div className="col-span-2">
                <Label className="text-xs">Destination / Raison (facultatif)</Label>
                <ComboCreate
                  value={form.destination}
                  onChange={(v) => set("destination", v)}
                  options={allDestinations}
                  placeholder="Destination…"
                  createLabel="Créer une destination"
                  onClear={() => set("destination", "")}
                />
              </div>
            </>
          )}

          <div className="col-span-2">
            <Label className="text-xs">Comment #1</Label>
            <Input value={form.comment1} onChange={(e) => set("comment1", e.target.value)} />
          </div>

          <div className="col-span-2 flex items-center justify-between rounded-md border p-3 bg-muted/30">
            <div>
              <div className="text-sm font-semibold">Adjustment Validation</div>
              <div className="text-xs text-muted-foreground">
                {form.adjustment_validation ? "Validé" : "Non validé"}
              </div>
            </div>
            <ColoredCheckbox
              checked={form.adjustment_validation}
              onChange={(v) => set("adjustment_validation", v)}
            />
          </div>

          <div className="col-span-2">
            <Label className="text-xs">
              Comment #2
              {showBagPicker && form.comment2 && (
                <span className="ml-2 text-[10px] text-primary">auto : qualification</span>
              )}
            </Label>
            <Input value={form.comment2} onChange={(e) => set("comment2", e.target.value)} />
          </div>

          {/* IN-only ancillary fields (units2, unit_indicator, stamps, SKU) */}
          {!showBagPicker && !showReturnBuilder && (
            <>
              <div>
                <Label className="text-xs">Units 2</Label>
                <Input type="number" min="0" step="0.01" value={form.units2}
                  onChange={(e) => set("units2", parseFloat(e.target.value) || 0)}
                  className="font-mono" />
              </div>
              <div>
                <Label className="text-xs">Unit Indicator</Label>
                <ComboCreate
                  value={form.unit_indicator}
                  onChange={(v) => set("unit_indicator", v)}
                  options={allIndicators}
                  placeholder="g / u / kg…"
                  createLabel="Créer l'indicateur"
                  onClear={() => set("unit_indicator", "")}
                />
              </div>

              <div>
                <Label className="text-xs">Timbre utilisé</Label>
                <ComboCreate
                  value={form.stamp_used}
                  onChange={(v) => set("stamp_used", v)}
                  options={allStamps}
                  placeholder="N° / réf. timbre…"
                  createLabel="Ajouter"
                  onClear={() => set("stamp_used", "")}
                  mono
                />
              </div>
              <div>
                <Label className="text-xs">Type de timbre</Label>
                <div className="flex items-center gap-1">
                  <Select value={form.stamp_type || "__none__"} onValueChange={(v) => set("stamp_type", v === "__none__" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Type…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {STAMP_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {form.stamp_type && <ClearBtn onClick={() => set("stamp_type", "")} />}
                </div>
              </div>

              <div className="col-span-2">
                <Label className="text-xs">SKU</Label>
                <Input value={form.sku} onChange={(e) => set("sku", e.target.value)} className="font-mono" />
              </div>
            </>
          )}

          <div className="col-span-2">
            <Label className="text-xs">Additional Comments</Label>
            <Textarea value={form.additional_comments} onChange={(e) => set("additional_comments", e.target.value)} rows={2} />
          </div>

          <div className="col-span-2 flex items-center justify-between rounded-md border p-3 bg-muted/30">
            <div>
              <div className="text-sm font-semibold">Elevated Update</div>
              <div className="text-xs text-muted-foreground">
                {form.elevated_update ? "Oui" : "Non"}
              </div>
            </div>
            <ColoredCheckbox
              checked={form.elevated_update}
              onChange={(v) => set("elevated_update", v)}
            />
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

function ClearBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-9 w-9 rounded-md border border-input bg-background hover:bg-accent inline-flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0"
      title="Réinitialiser"
    >
      <X className="h-4 w-4" />
    </button>
  );
}

function ComboCreate({
  value, onChange, options, placeholder, createLabel, mono, onClear,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  createLabel: string;
  mono?: boolean;
  onClear?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const canCreate = search.trim().length > 0 && !options.some((o) => o.toLowerCase() === search.trim().toLowerCase());
  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className={cn("w-full justify-between font-normal", mono && "font-mono", !value && "text-muted-foreground")}
          >
            <span className="truncate">{value || placeholder}</span>
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
      {value && onClear && <ClearBtn onClick={onClear} />}
    </div>
  );
}
