import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  checked: boolean;
  onChange?: (v: boolean) => void;
  readOnly?: boolean;
  size?: "sm" | "md";
  label?: string;
  className?: string;
};

/**
 * Checkbox colorée :
 *  - Rouge avec ✕ quand non validé
 *  - Verte avec ✓ quand validé
 * Utilisée dans le tableau ET dans la modale.
 */
export function ColoredCheckbox({ checked, onChange, readOnly, size = "md", label, className }: Props) {
  const dim = size === "sm" ? "h-5 w-5" : "h-6 w-6";
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const box = (
    <span
      role={readOnly ? undefined : "checkbox"}
      aria-checked={checked}
      tabIndex={readOnly ? -1 : 0}
      onClick={(e) => {
        if (readOnly || !onChange) return;
        e.stopPropagation();
        onChange(!checked);
      }}
      onKeyDown={(e) => {
        if (readOnly || !onChange) return;
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); onChange(!checked); }
      }}
      className={cn(
        "inline-flex items-center justify-center rounded-[4px] border-2 shrink-0 transition-colors",
        dim,
        checked
          ? "bg-emerald-500 border-emerald-600 text-white shadow-sm"
          : "bg-red-500 border-red-600 text-white shadow-sm",
        !readOnly && "cursor-pointer hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary",
      )}
    >
      {checked ? <Check className={iconSize} strokeWidth={3.5} /> : <X className={iconSize} strokeWidth={3.5} />}
    </span>
  );
  if (!label) return <span className={className}>{box}</span>;
  return (
    <label className={cn("inline-flex items-center gap-2", !readOnly && "cursor-pointer", className)}>
      {box}
      <span className="text-sm select-none">{label}</span>
    </label>
  );
}
