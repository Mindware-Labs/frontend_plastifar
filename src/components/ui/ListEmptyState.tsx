import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";

/** Mismo patrón que la bandeja de tickets: icono, título y ayuda opcional. */
export function ListEmptyState({
  icon: Icon,
  isFiltered,
  filteredTitle,
  onClearFilters,
  emptyTitle,
  emptyDescription,
  action,
}: {
  icon: LucideIcon;
  isFiltered: boolean;
  filteredTitle: string;
  onClearFilters?: () => void;
  emptyTitle: string;
  emptyDescription?: string;
  /** Salida del vacío real (p. ej. «Nuevo rol»). Opcional: sin permiso, no se pasa. */
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-14 text-center">
      <span
        aria-hidden
        className="flex size-9 items-center justify-center rounded-lg bg-brand-red/10 text-brand-red"
      >
        <Icon className="size-4" strokeWidth={2.25} />
      </span>
      {isFiltered ? (
        <>
          <p className="text-[13px] font-medium text-zinc-700">{filteredTitle}</p>
          {onClearFilters && (
            <Button variant="secondary" size="sm" onClick={onClearFilters}>
              Quitar filtros
            </Button>
          )}
        </>
      ) : (
        <>
          <p className="text-[13px] font-medium text-zinc-700">{emptyTitle}</p>
          {emptyDescription && (
            <p className="max-w-md text-[12px] leading-relaxed text-faint">{emptyDescription}</p>
          )}
          {action}
        </>
      )}
    </div>
  );
}
