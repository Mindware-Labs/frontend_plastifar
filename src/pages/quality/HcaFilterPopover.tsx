import { Building2, Calendar, SlidersHorizontal, UserCheck, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DateRangePicker } from "../../components/ui/DateRangePicker";
import { LookupFilterDropdown } from "../../components/ui/FilterDropdown";
import { useDisclosureMotion } from "../../hooks/useDisclosureMotion";
import {
  resolveClientLabel,
  resolveStaffLabel,
  searchActiveStaff,
  searchClients,
} from "../../lib/lookups";

const PANEL_WIDTH = 340;

interface HcaFilterPopoverProps {
  responsibleId: string;
  onResponsibleChange: (id: string) => void;
  clientId: string;
  onClientChange: (id: string) => void;
  from: string;
  to: string;
  onDateChange: (since: string, until: string) => void;
  onClear: () => void;
}

export function HcaFilterPopover({
  responsibleId,
  onResponsibleChange,
  clientId,
  onClientChange,
  from,
  to,
  onDateChange,
  onClear,
}: HcaFilterPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [anchor, setAnchor] = useState<{
    top: number;
    left: number;
    originX: number;
    maxHeight: number;
  } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const { mounted, exiting, ref: panelRef, snap } = useDisclosureMotion<HTMLDivElement>(isOpen);

  const activeCount =
    (responsibleId !== "todos" && responsibleId !== "" ? 1 : 0) +
    (clientId !== "todos" && clientId !== "" ? 1 : 0) +
    (from !== "" || to !== "" ? 1 : 0);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  function toggle() {
    if (isOpen) {
      close();
      return;
    }

    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const left = Math.max(8, Math.min(rect.right - PANEL_WIDTH, window.innerWidth - PANEL_WIDTH - 8));
    const top = rect.bottom + 6;

    setAnchor({
      top,
      left,
      originX: rect.left + rect.width / 2 - left,
      maxHeight: Math.max(260, window.innerHeight - top - 16),
    });
    setIsOpen(true);
  }

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      // Si el click fue dentro de un portal de select/lista/datepicker flotante, no cerrar el panel
      if (
        target instanceof Element &&
        (target.closest("[data-dropdown-portal]") !== null ||
          target.closest("[role='listbox']") !== null ||
          target.closest("[data-select-portal]") !== null)
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

    function handleViewportChange(event: Event) {
      const target = event.target;
      if (target instanceof Node && panelRef.current?.contains(target)) return;
      close();
      snap();
    }

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
  }, [isOpen, close, snap, panelRef]);

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls={mounted ? panelId : undefined}
        aria-label={activeCount > 0 ? `Más filtros (${activeCount} activos)` : "Más filtros"}
        title={activeCount > 0 ? `Filtros secundarios (${activeCount} activos)` : "Filtros secundarios"}
        data-active={activeCount > 0}
        className={`group inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-medium shadow-2xs outline-none transition-all duration-150 cursor-pointer select-none active:scale-[0.98] ${
          isOpen
            ? "border-brand-red bg-red-50/80 text-brand-red ring-2 ring-brand-red/20 shadow-xs font-semibold"
            : activeCount > 0
            ? "border-brand-red/50 bg-red-50/70 text-brand-red font-semibold shadow-2xs hover:bg-red-100 hover:border-brand-red"
            : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
        }`}
      >
        <SlidersHorizontal
          className={`h-3.5 w-3.5 transition-transform duration-150 ${
            activeCount > 0 || isOpen ? "text-brand-red" : "text-zinc-500 group-hover:text-zinc-800"
          }`}
        />
        <span>Filtros</span>
        {activeCount > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-red px-1 text-[9.5px] font-bold text-white shadow-2xs tabular-nums">
            {activeCount}
          </span>
        )}
      </button>

      {mounted &&
        anchor &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-modal="false"
            aria-label="Filtros adicionales"
            style={{
              position: "fixed",
              top: anchor.top,
              left: anchor.left,
              width: PANEL_WIDTH,
              maxHeight: anchor.maxHeight,
              transformOrigin: `${anchor.originX}px top`,
            }}
            className={`${
              exiting ? "pointer-events-none opacity-0 scale-95" : "opacity-100 scale-100"
            } z-[75] flex flex-col overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-[0_14px_36px_-6px_rgba(0,0,0,0.15),0_3px_12px_-2px_rgba(0,0,0,0.06)] transition-all duration-150`}
          >
            {/* Cabecera */}
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <span className="font-heading text-[10.5px] font-bold uppercase tracking-wider text-zinc-400 select-none">
                  Filtros adicionales
                </span>
                {activeCount > 0 && (
                  <span className="rounded-full bg-brand-red/10 px-2 py-0.5 text-[10.5px] font-bold tabular-nums text-brand-red">
                    {activeCount} {activeCount === 1 ? "activo" : "activos"}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Cerrar filtros"
                className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Controles scrollables */}
            <div className="flex flex-col gap-3.5 overflow-y-auto p-3.5 text-left">
              {/* 1. Responsable */}
              <div className="flex flex-col gap-1.5">
                <label className="font-heading text-[11px] font-semibold text-zinc-600 flex items-center gap-1.5 select-none">
                  <UserCheck className="h-3.5 w-3.5 text-zinc-400" />
                  Responsable
                </label>
                <LookupFilterDropdown
                  title="Seleccionar responsable"
                  aria-label="Filtrar por responsable"
                  placeholder="Todos los responsables"
                  searchPlaceholder="Buscar responsable…"
                  defaultIcon={<UserCheck className="h-3.5 w-3.5 text-zinc-500" />}
                  value={responsibleId === "todos" ? "" : responsibleId}
                  onChange={(value) => onResponsibleChange(value === "" ? "todos" : value)}
                  search={searchActiveStaff}
                  resolveSelectedLabel={resolveStaffLabel}
                  className="w-full [&>button]:w-full [&>button]:justify-between"
                />
              </div>

              {/* 2. Cliente */}
              <div className="flex flex-col gap-1.5">
                <label className="font-heading text-[11px] font-semibold text-zinc-600 flex items-center gap-1.5 select-none">
                  <Building2 className="h-3.5 w-3.5 text-zinc-400" />
                  Cliente
                </label>
                <LookupFilterDropdown
                  title="Seleccionar cliente"
                  aria-label="Filtrar por cliente"
                  placeholder="Todos los clientes"
                  searchPlaceholder="Buscar cliente…"
                  defaultIcon={<Building2 className="h-3.5 w-3.5 text-zinc-500" />}
                  value={clientId === "todos" ? "" : clientId}
                  onChange={(value) => onClientChange(value === "" ? "todos" : value)}
                  search={searchClients}
                  resolveSelectedLabel={resolveClientLabel}
                  className="w-full [&>button]:w-full [&>button]:justify-between"
                />
              </div>

              {/* 3. Fechas con DateRangePicker idéntico a correo */}
              <div className="flex flex-col gap-1.5 border-t border-zinc-100 pt-3">
                <label className="font-heading text-[11px] font-semibold text-zinc-600 flex items-center gap-1.5 select-none">
                  <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                  Fecha de detección
                </label>
                <DateRangePicker
                  since={from}
                  until={to}
                  onChange={onDateChange}
                />
              </div>
            </div>

            {/* Pie de acciones */}
            {activeCount > 0 && (
              <div className="flex shrink-0 items-center justify-between border-t border-zinc-100 bg-zinc-50/70 px-3.5 py-2">
                <button
                  type="button"
                  onClick={onClear}
                  className="text-[11.5px] font-medium text-brand-red hover:underline cursor-pointer"
                >
                  Limpiar estos filtros
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-md bg-zinc-900 px-3 py-1 text-[11.5px] font-medium text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Listo
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
