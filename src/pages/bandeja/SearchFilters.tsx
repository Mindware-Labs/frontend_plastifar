import { Paperclip, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Button } from "../../components/ui/Button";
import { CheckboxField, TextField } from "../../components/ui/Field";
import { EMPTY_FILTERS, countActive, formatDay, type AdvancedFilters } from "./filterCriteria";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PANEL_WIDTH = 300;

interface FilterButtonProps {
  value: AdvancedFilters;
  onChange: (value: AdvancedFilters) => void;
}

/**
 * Boton con panel desplegable. Los criterios se aplican juntos, no a cada tecla.
 * El panel se dibuja en un portal: el listado vive dentro de un panel con scroll que lo recortaria.
 */
export function FilterButton({ value, onChange }: FilterButtonProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const [draft, setDraft] = useState<AdvancedFilters>(value);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLFormElement>(null);
  const panelId = useId();
  const active = countActive(value);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    // Reposicionar en cada scroll seria un baile: se cierra, como haria un menu nativo.
    function handleViewportChange() {
      setOpen(false);
    }

    panelRef.current?.querySelector<HTMLElement>("input")?.focus();

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
  }, [open]);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }

    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Alineado a la derecha del boton, sin salirse por la izquierda de la ventana.
    setAnchor({ top: rect.bottom + 6, left: Math.max(8, rect.right - PANEL_WIDTH) });
    // El borrador arranca de lo aplicado: lo que se descarto no reaparece.
    setDraft(value);
    setError(null);
    setOpen(true);
  }

  function apply(event: FormEvent) {
    event.preventDefault();

    const from = draft.from.trim();
    if (from && !EMAIL.test(from)) {
      setError("Escribe una dirección completa, como nombre@dominio.com.");
      return;
    }
    if (draft.since && draft.until && draft.until < draft.since) {
      setError("La fecha final no puede ser anterior a la inicial.");
      return;
    }

    onChange({ ...draft, from });
    setOpen(false);
  }

  function clear() {
    setDraft(EMPTY_FILTERS);
    setError(null);
    onChange(EMPTY_FILTERS);
    setOpen(false);
  }

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={active > 0 ? `Filtros (${active} activos)` : "Filtros"}
        title="Filtros avanzados"
        data-active={active > 0}
        className="relative flex h-8 w-8 items-center justify-center rounded-edge border border-line-strong
          bg-white text-brand-gray outline-none transition-colors hover:border-zinc-400 hover:text-ink
          focus-visible:border-brand-red focus-visible:ring-3 focus-visible:ring-brand-red/10
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
          style={{ position: "fixed", top: anchor.top, left: anchor.left, width: PANEL_WIDTH }}
          className="animate-plf-toast-in z-[60] flex flex-col gap-3.5 rounded-edge border border-line
            bg-white p-4 shadow-[0_4px_8px_rgba(27,27,29,0.04),0_24px_48px_-20px_rgba(27,27,29,0.28)]"
        >
          <p className="font-heading text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
            Filtros avanzados
          </p>

          <TextField
            label="Dirección"
            type="email"
            autoComplete="off"
            placeholder="nombre@dominio.com"
            value={draft.from}
            onChange={(event) => setDraft({ ...draft, from: event.target.value })}
            hint="Exacta. Vale como remitente o como destinatario en el hilo."
          />

          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Desde"
              type="date"
              value={draft.since}
              max={draft.until || undefined}
              onChange={(event) => setDraft({ ...draft, since: event.target.value })}
            />
            <TextField
              label="Hasta"
              type="date"
              value={draft.until}
              min={draft.since || undefined}
              onChange={(event) => setDraft({ ...draft, until: event.target.value })}
            />
          </div>

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

  return (
    <div className="flex flex-wrap gap-1.5">
      {value.from && <Chip label={value.from} onRemove={() => onChange({ ...value, from: "" })} />}
      {value.since && (
        <Chip label={`Desde ${formatDay(value.since)}`} onRemove={() => onChange({ ...value, since: "" })} />
      )}
      {value.until && (
        <Chip label={`Hasta ${formatDay(value.until)}`} onRemove={() => onChange({ ...value, until: "" })} />
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
