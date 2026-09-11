import { Calendar, Paperclip, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useDisclosureMotion } from "../../hooks/useDisclosureMotion";
import { Button } from "../../components/ui/Button";
import { CheckboxField } from "../../components/ui/Field";
import { DateRangePicker } from "../../components/ui/DateRangePicker";
import { EMPTY_FILTERS, countActive, formatDay, type AdvancedFilters } from "./filterCriteria";

const PANEL_WIDTH = 310;

interface FilterButtonProps {
  value: AdvancedFilters;
  onChange: (value: AdvancedFilters) => void;
}

export function FilterButton({ value, onChange }: FilterButtonProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number; originX: number } | null>(null);
  const [draft, setDraft] = useState<AdvancedFilters>(value);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const active = countActive(value);
  const { mounted, exiting, ref: panelRef, snap } = useDisclosureMotion<HTMLFormElement>(open);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target) ||
        (target instanceof Element &&
          (target.closest("[data-select-portal]") !== null || target.closest("[data-select-backdrop]") !== null))
      ) {
        return;
      }
      close();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
        triggerRef.current?.focus();
      }
    }
    function handleViewportChange() {
      close();
      snap();
    }

    panelRef.current?.querySelector<HTMLElement>("button, input")?.focus();

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [open, close, snap]);

  function toggle() {
    if (open) {
      close();
      return;
    }

    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const left = Math.max(8, rect.right - PANEL_WIDTH);
    setAnchor({ top: rect.bottom + 6, left, originX: rect.left + rect.width / 2 - left });
    setDraft(value);
    setError(null);
    setOpen(true);
  }

  function apply(event: FormEvent) {
    event.preventDefault();

    if (draft.since && draft.until && draft.until < draft.since) {
      setError("La fecha final no puede ser anterior a la inicial.");
      return;
    }

    onChange(draft);
    close();
  }

  function clear() {
    setDraft(EMPTY_FILTERS);
    setError(null);
    onChange(EMPTY_FILTERS);
    close();
  }

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={mounted ? panelId : undefined}
        aria-label={active > 0 ? `Filtros (${active} activos)` : "Filtros"}
        title={active > 0 ? `Filtros avanzados (${active} activos)` : "Filtros avanzados"}
        data-active={active > 0}
        className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-2xs transition-all outline-none select-none cursor-pointer active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-red/20 ${
          active > 0
            ? "border border-zinc-300 bg-zinc-100 text-zinc-900 font-semibold"
            : "border border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
        }`}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        {active > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-red px-1 text-[9.5px] font-bold text-white shadow-2xs tabular-nums">
            {active}
          </span>
        )}
      </button>

      {mounted &&
        anchor &&
        createPortal(
        <form
          ref={panelRef}
          id={panelId}
          onSubmit={apply}
          inert={exiting ? true : undefined}
          style={{
            position: "fixed",
            top: anchor.top,
            left: anchor.left,
            width: PANEL_WIDTH,
            transformOrigin: `${anchor.originX}px top`,
          }}
          className={`${
            exiting ? "pointer-events-none" : ""
          } z-[60] flex flex-col gap-3.5 rounded-lg border border-zinc-200/90
            bg-white p-3.5 shadow-[0_10px_28px_-6px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.04)]`}
        >
          <p className="font-heading text-[11px] font-semibold uppercase tracking-wider text-zinc-400 select-none">
            Filtros avanzados
          </p>

          <DateRangePicker
            since={draft.since}
            until={draft.until}
            onChange={(since, until) => {
              setError(null);
              setDraft({ ...draft, since, until });
            }}
          />

          <CheckboxField
            label="Solo con adjuntos"
            description="Algún correo de la conversación trae archivos."
            checked={draft.hasAttachments}
            onChange={(event) => setDraft({ ...draft, hasAttachments: event.target.checked })}
          />

          {error && (
            <p role="alert" className="text-[11.5px] font-medium text-brand-red-dark">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-zinc-100 pt-3">
            <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={active === 0 && countActive(draft) === 0}>
              Limpiar
            </Button>
            <Button type="submit" size="sm">
              Aplicar
            </Button>
          </div>
        </form>,
        document.body,
      )}
    </div>
  );
}

interface ChipProps {
  label: string;
  onRemove: () => void;
  icon?: typeof Paperclip;
}

function Chip({ label, onRemove, icon: Icon }: ChipProps) {
  return (
    <span
      className="inline-flex h-6 max-w-full items-center gap-1 rounded-md border border-zinc-200
        bg-zinc-50 pl-2 pr-1 text-[11px] font-medium text-zinc-700 shadow-2xs"
    >
      {Icon && <Icon className="h-3 w-3 shrink-0 text-zinc-400" />}
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Quitar el filtro ${label}`}
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-zinc-400
          outline-none transition-colors hover:bg-zinc-200/70 hover:text-zinc-700
          focus-visible:ring-2 focus-visible:ring-brand-red/20"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

/** Los criterios aplicados, a la vista y con su propia aspa: se sabe por que la lista es corta. */
export function FilterChips({ value, onChange }: FilterButtonProps) {
  if (countActive(value) === 0) return null;

  const dateLabel =
    value.since && value.until
      ? value.since === value.until
        ? formatDay(value.since)
        : `${formatDay(value.since)} – ${formatDay(value.until)}`
      : value.since
        ? `Desde ${formatDay(value.since)}`
        : value.until
          ? `Hasta ${formatDay(value.until)}`
          : null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {dateLabel && (
        <Chip
          icon={Calendar}
          label={dateLabel}
          onRemove={() => onChange({ ...value, since: "", until: "" })}
        />
      )}
      {value.hasAttachments && (
        <Chip
          icon={Paperclip}
          label="Con adjuntos"
          onRemove={() => onChange({ ...value, hasAttachments: false })}
        />
      )}
    </div>
  );
}
