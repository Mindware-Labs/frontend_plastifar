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

const actionButtonClass =
  "inline-flex h-6.5 items-center gap-1.5 rounded-edge border border-line-strong bg-white px-2.5 " +
  "font-heading text-[11px] font-semibold uppercase tracking-[0.05em] text-brand-gray shadow-2xs outline-none " +
  "transition-all hover:border-zinc-400 hover:bg-canvas hover:text-ink active:scale-[0.98] " +
  "focus-visible:ring-3 focus-visible:ring-brand-red/20 disabled:cursor-not-allowed disabled:opacity-40";

/** Barra de selección de tickets: bandeja neutra sobria con pastilla de conteo y acciones táctiles. */
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
      } flex h-8 w-full items-center rounded-edge border border-line-strong bg-fill/60 shadow-2xs pl-2.5 pr-1`}
    >
      <SelectBox
        checked={pageState}
        label={pageState === true ? "Quitar la selección de esta página" : "Seleccionar toda la página"}
        onToggle={onTogglePage}
      />

      <div className="ml-2 flex items-center gap-1.5">
        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-red px-1.5 font-heading text-[10.5px] font-bold text-white shadow-2xs">
          {count}
        </span>
        <span className="font-heading text-[12px] font-semibold text-ink">
          {count === 1 ? "seleccionado" : "seleccionados"}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          disabled={busy || isExiting}
          onClick={onAssign}
          className={actionButtonClass}
        >
          <UserCheck aria-hidden className="h-3.5 w-3.5 text-brand-gray" />
          Asignar
        </button>

        <button
          type="button"
          disabled={busy || isExiting}
          onClick={onPriority}
          className={actionButtonClass}
        >
          <Flag aria-hidden className="h-3.5 w-3.5 text-brand-gray" />
          Prioridad
        </button>

        <div className="mx-0.5 h-3.5 w-px bg-line-strong" />

        <button
          type="button"
          disabled={isExiting}
          onClick={onClear}
          aria-label="Quitar la selección (Esc)"
          title="Quitar la selección (Esc)"
          className="flex h-6.5 w-6.5 items-center justify-center rounded-edge text-subtle outline-none transition-colors hover:bg-line hover:text-ink focus-visible:ring-3 focus-visible:ring-brand-red/20"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
