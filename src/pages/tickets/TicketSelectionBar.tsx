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
  "inline-flex h-6.5 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 " +
  "text-[12px] font-medium text-zinc-700 shadow-2xs outline-none " +
  "transition-all hover:border-zinc-300 hover:bg-zinc-50 active:scale-[0.98] " +
  "focus-visible:ring-2 focus-visible:ring-brand-red/20 disabled:cursor-not-allowed disabled:opacity-40";

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
      } flex h-8 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50/80 shadow-2xs pl-2.5 pr-1`}
    >
      <SelectBox
        checked={pageState}
        label={pageState === true ? "Quitar la selección de esta página" : "Seleccionar toda la página"}
        onToggle={onTogglePage}
      />

      <div className="ml-2.5 flex items-center gap-1.5">
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-red px-1.5 text-[11px] font-bold text-white tabular-nums leading-none tracking-tight">
          {count}
        </span>
        <span className="font-heading text-[12.5px] font-semibold text-zinc-800">
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
          <UserCheck aria-hidden className="h-3.5 w-3.5 text-zinc-500" />
          Asignar
        </button>

        <button
          type="button"
          disabled={busy || isExiting}
          onClick={onPriority}
          className={actionButtonClass}
        >
          <Flag aria-hidden className="h-3.5 w-3.5 text-zinc-500" />
          Prioridad
        </button>

        <div className="mx-0.5 h-3.5 w-px bg-zinc-200" />

        <button
          type="button"
          disabled={isExiting}
          onClick={onClear}
          aria-label="Quitar la selección (Esc)"
          title="Quitar la selección (Esc)"
          className="flex h-6.5 w-6.5 items-center justify-center rounded-md text-zinc-400 outline-none transition-colors hover:bg-zinc-200/60 hover:text-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-400/20"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
