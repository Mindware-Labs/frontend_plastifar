import { Calendar, ChevronDown, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDisclosureMotion } from "../../../hooks/useDisclosureMotion";
import {
  VIEWPORT_GUTTER,
  panelClasses,
  triggerClasses,
  type Anchor,
} from "./filterShared";

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-DO", { day: "numeric", month: "short" }).replace(".", "");
}

export interface DateRangeFilterDropdownProps {
  from: string;
  to: string;
  onFromChange: (from: string) => void;
  onToChange: (to: string) => void;
  placeholder?: string;
  title?: string;
  "aria-label"?: string;
  className?: string;
}

/**
 * Filtro desplegable de rango de fechas (`Desde` – `Hasta`) con la misma estética que `FilterDropdown`.
 */
export function DateRangeFilterDropdown({
  from,
  to,
  onFromChange,
  onToChange,
  placeholder = "Todas las fechas",
  title = "Filtrar por fecha",
  "aria-label": ariaLabel,
  className = "",
}: DateRangeFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const { mounted, exiting, ref: panelRef, snap } = useDisclosureMotion<HTMLDivElement>(isOpen);

  const displayLabel =
    from && to
      ? `${formatShortDate(from)} – ${formatShortDate(to)}`
      : from
        ? `Desde ${formatShortDate(from)}`
        : to
          ? `Hasta ${formatShortDate(to)}`
          : placeholder;

  function openDropdown() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const width = 240;
    const left = Math.max(
      VIEWPORT_GUTTER,
      Math.min(rect.left, window.innerWidth - width - VIEWPORT_GUTTER),
    );

    setAnchor({ top: rect.bottom + 6, left, width, originX: rect.left + rect.width / 2 - left });
    setIsOpen(true);
  }

  const closeDropdown = useCallback(
    (immediate = false) => {
      setIsOpen(false);
      if (immediate) snap();
    },
    [snap],
  );

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      closeDropdown();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeDropdown();
        triggerRef.current?.focus();
      }
    }

    function handleViewportChange() {
      closeDropdown(true);
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
  }, [isOpen, closeDropdown, panelRef]);

  return (
    <div className={`relative shrink-0 ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (isOpen ? closeDropdown() : openDropdown())}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={mounted ? panelId : undefined}
        aria-label={ariaLabel ?? displayLabel}
        data-open={isOpen}
        className={triggerClasses(isOpen)}
      >
        <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-zinc-500 group-hover:text-zinc-800">
          <Calendar className="h-3.5 w-3.5" />
        </span>
        <span className="max-w-[220px] truncate whitespace-nowrap">{displayLabel}</span>
        <ChevronDown
          aria-hidden
          className={`h-3 w-3 shrink-0 text-zinc-400 transition-transform duration-280 ease-plf-spring motion-reduce:transition-none ${
            isOpen ? "rotate-180 text-zinc-700" : "group-hover:text-zinc-600"
          }`}
        />
      </button>

      {mounted &&
        anchor &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label={ariaLabel ?? title}
            aria-hidden={exiting}
            style={{
              position: "fixed",
              top: anchor.top,
              left: anchor.left,
              width: anchor.width,
              transformOrigin: `${anchor.originX}px top`,
            }}
            className={`${panelClasses(exiting)} p-2.5 gap-2`}
          >
            <div className="select-none text-[11px] font-medium text-zinc-400">{title}</div>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-zinc-600">Desde</span>
              <input
                type="date"
                value={from}
                onChange={(event) => onFromChange(event.target.value)}
                className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-[12.5px] text-zinc-800 outline-none focus:border-zinc-400"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-zinc-600">Hasta</span>
              <input
                type="date"
                value={to}
                onChange={(event) => onToChange(event.target.value)}
                className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-[12.5px] text-zinc-800 outline-none focus:border-zinc-400"
              />
            </label>
            {(from || to) && (
              <button
                type="button"
                onClick={() => {
                  onFromChange("");
                  onToChange("");
                  closeDropdown();
                  triggerRef.current?.focus();
                }}
                className="mt-0.5 inline-flex h-7 w-full items-center justify-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 text-[12px] font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 cursor-pointer"
              >
                <X className="h-3 w-3" />
                <span>Limpiar fechas</span>
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
