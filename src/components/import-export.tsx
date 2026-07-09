import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Upload, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listMovements } from "@/lib/movements";
import { parseWorkbook, exportMovements, type ParsedImport } from "@/lib/xlsx-io";
import type { MovementInput } from "@/lib/types";

async function bulkInsert(rows: MovementInput[]) {
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from("movements").insert(rows.slice(i, i + CHUNK));
    if (error) throw error;
  }
}

async function deleteAllMovements() {
  const { error } = await supabase
    .from("movements")
    .delete()
    .gte("event_date", "1900-01-01");
  if (error) throw error;
}

export function ImportExportButtons() {
  const qc = useQueryClient();
  const { data: movements = [] } = useQuery({ queryKey: ["movements"], queryFn: listMovements });

  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [mode, setMode] = useState<"replace" | "append">("replace");

  const importMut = useMutation({
    mutationFn: async () => {
      if (!parsed) return;
      if (mode === "replace") await deleteAllMovements();
      await bulkInsert(parsed.rows);
    },
    onSuccess: () => {
      toast.success(`Import réussi — ${parsed?.rows.length ?? 0} lignes.`);
      qc.invalidateQueries({ queryKey: ["movements"] });
      setOpen(false);
      setParsed(null);
      setFileName("");
    },
    onError: (e: unknown) => {
      toast.error(`Import échoué: ${(e as Error).message}`);
    },
  });

  const handleFile = async (f: File) => {
    setFileName(f.name);
    try {
      const buf = await f.arrayBuffer();
      const res = parseWorkbook(buf);
      setParsed(res);
      setOpen(true);
    } catch (e) {
      toast.error(`Lecture impossible: ${(e as Error).message}`);
    }
  };

  const handleExport = () => {
    if (movements.length === 0) {
      toast.warning("Aucun mouvement à exporter.");
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    exportMovements(movements, `log-2026-${stamp}.xlsx`);
    toast.success(`Export généré (${movements.length} lignes).`);
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
        <Upload className="h-4 w-4 mr-1" /> Importer Excel
      </Button>
      <Button variant="outline" size="sm" onClick={handleExport}>
        <Download className="h-4 w-4 mr-1" /> Exporter Excel
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Log 2026</DialogTitle>
            <DialogDescription>
              Fichier : <span className="font-mono">{fileName}</span>
            </DialogDescription>
          </DialogHeader>

          {parsed && (
            <div className="space-y-4">
              <div className="rounded-md border p-3 text-sm bg-muted/30">
                <div><span className="font-semibold">{parsed.rows.length}</span> lignes valides détectées</div>
                {parsed.skipped > 0 && (
                  <div className="text-muted-foreground">{parsed.skipped} lignes ignorées (vides)</div>
                )}
                <div className="text-muted-foreground">
                  Base actuelle : {movements.length} mouvements
                </div>
              </div>

              <RadioGroup value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="replace" id="mode-replace" />
                  <div>
                    <Label htmlFor="mode-replace" className="font-medium">Remplacer tout</Label>
                    <p className="text-xs text-muted-foreground">
                      Supprime les {movements.length} mouvements existants avant l'import. Recommandé pour re-synchroniser depuis le fichier maître.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="append" id="mode-append" />
                  <div>
                    <Label htmlFor="mode-append" className="font-medium">Ajouter</Label>
                    <p className="text-xs text-muted-foreground">
                      Ajoute les nouvelles lignes sans toucher aux données existantes (peut créer des doublons).
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={importMut.isPending}>
              Annuler
            </Button>
            <Button onClick={() => importMut.mutate()} disabled={!parsed || importMut.isPending}>
              {importMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Confirmer l'import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
