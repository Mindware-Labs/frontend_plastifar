import { Calendar, Paperclip, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
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
  const [isExiting, setIsExiting] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const [draft, setDraft] = useState<AdvancedFilters>(value);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLFormElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const panelId = useId();
  const active = countActive(value);

  const close = useCallback(() => {
    if (!open || isExiting) return;
    setIsExiting(true);
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
      setIsExiting(false);
    }, 160);
  }, [open, isExiting]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open || isExiting) return;

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
    // Reposicionar en cada scroll seria un baile: se cierra suavemente.
    function handleViewportChange() {
      close();
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
  }, [open, isExiting, close]);

  function toggle() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    if (open) {
      close();
      return;
    }

    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Alineado a la derecha del boton, sin salirse por la izquierda de la ventana.
    setAnchor({ top: rect.bottom + 6, left: Math.max(8, rect.right - PANEL_WIDTH) });
    // El borrador arranca de lo aplicado: lo que se descarto no reaparece.
    setDraft(value);
    setError(null);
    setIsExiting(false);
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
        aria-expanded={open && !isExiting}
        aria-controls={open ? panelId : undefined}
        aria-label={active > 0 ? `Filtros (${active} activos)` : "Filtros"}
        title="Filtros"
        data-active={active > 0}
        className="relative flex h-8 w-8 items-center justify-center rounded-edge border border-line-strong
          bg-white text-brand-gray outline-none transition-all duration-150 hover:border-zinc-400 hover:text-ink
          active:scale-95 focus-visible:border-brand-red focus-visible:ring-3 focus-visible:ring-brand-red/10
          data-[active=true]:border-brand-red/40 data-[active=true]:text-brand-red-dark
          aria-expanded:bg-fill aria-expanded:text-ink"
      >
        <SlidersHorizontal className="h-4 w-4" />
        {active > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full
              bg-brand-red px-1 font-heading text-[9.5px] font-bold text-white"
          >
            {active}
          </span>
        )}
      </button>

      {open &&
        anchor &&
        createPortal(
        <form
          ref={panelRef}
          id={panelId}
          onSubmit={apply}
          inert={isExiting ? true : undefined}
          style={{ position: "fixed", top: anchor.top, left: anchor.left, width: PANEL_WIDTH }}
          className={`${
            isExiting ? "animate-plf-popover-out pointer-events-none" : "animate-plf-popover-in"
          } z-[60] flex flex-col gap-3.5 origin-top-right rounded-edge border border-line/90
            bg-white/98 backdrop-blur-md p-4 shadow-[0_4px_16px_-2px_rgba(27,27,29,0.08),0_12px_32px_-4px_rgba(27,27,29,0.14)]`}
        >
          <p className="font-heading text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
            Filtros
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

          <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
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
      className="inline-flex h-6 max-w-full items-center gap-1 rounded-full border border-brand-red/25
        bg-brand-red/[0.05] pl-2 pr-0.5 text-[11.5px] font-medium text-brand-red-dark"
    >
      {Icon && <Icon className="h-3 w-3 shrink-0" />}
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Quitar el filtro ${label}`}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-brand-red-dark/70
          outline-none transition-colors hover:bg-brand-red/10 hover:text-brand-red-dark
          focus-visible:ring-3 focus-visible:ring-brand-red/20"
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
