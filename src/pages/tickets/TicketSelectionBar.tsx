import { Flag, UserCheck, X } from "lucide-react";
import { SelectBox } from "../../components/ui/SelectBox";

interface TicketSelectionBarProps {
  count: number;
  pageState: boolean | "mixed";
  busy: boolean;
  isExiting?: boolean;
  onTogglePage: () => void;
  onClear: () => void;
  onAssign: () => void;
  onPriority: () => void;
}

const toolClass =
  "inline-flex h-7 items-center gap-1.5 rounded-edge px-2.5 font-heading text-[11px] font-semibold uppercase " +
  "tracking-[0.06em] text-brand-gray outline-none transition-colors hover:bg-white hover:text-ink " +
  "focus-visible:ring-3 focus-visible:ring-brand-red/20 disabled:cursor-not-allowed disabled:opacity-40";

/** Misma barra que la de correo: ocupa el sitio de los criterios mientras haya filas marcadas. */
export function TicketSelectionBar({
  count,
  pageState,
  busy,
  isExiting = false,
  onTogglePage,
  onClear,
  onAssign,
  onPriority,
}: TicketSelectionBarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Acciones sobre la selección"
      className={`${
        isExiting ? "animate-plf-selection-out pointer-events-none" : "animate-plf-selection-in"
      } flex h-9 w-full items-center gap-1.5 rounded-edge border border-brand-red/30
        bg-gradient-to-r from-brand-red/[0.07] via-brand-red/[0.04] to-brand-red/[0.07]
        shadow-[0_1px_4px_-1px_rgba(228,0,43,0.18)] pl-2.5 pr-1`}
    >
      <SelectBox
        checked={pageState}
        label={pageState === true ? "Quitar la selección de esta página" : "Seleccionar toda la página"}
        onToggle={onTogglePage}
      />

      <span aria-live="polite" className="ml-1 min-w-0 truncate text-[12px] font-semibold tabular-nums text-ink">
        {count} {count === 1 ? "seleccionado" : "seleccionados"}
      </span>

      <div className="ml-auto flex items-center gap-0.5">
        <button type="button" disabled={busy || isExiting} onClick={onAssign} className={toolClass}>
          <UserCheck aria-hidden className="h-4 w-4" />
          Asignar
        </button>
        <button type="button" disabled={busy || isExiting} onClick={onPriority} className={toolClass}>
          <Flag aria-hidden className="h-4 w-4" />
          Prioridad
        </button>
        <button
          type="button"
          disabled={isExiting}
          onClick={onClear}
          aria-label="Quitar la selección (Esc)"
          title="Quitar la selección (Esc)"
          className="ml-1 flex h-7 w-7 items-center justify-center rounded-edge text-subtle outline-none
            transition-colors hover:bg-white hover:text-ink focus-visible:ring-3 focus-visible:ring-brand-red/20"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
