import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "../../lib/portal";
import { useDisclosureMotion } from "../../hooks/useDisclosureMotion";
import { useMenuKeyboard } from "../../hooks/useMenuKeyboard";

export interface ListSortOption {
  value: string;
  label: string;
}

const MENU_WIDTH = 248;

interface ListSortMenuProps {
  sortValue: string;
  sortOptions: ListSortOption[];
  onSortChange: (value: string) => void;
  menuAriaLabel?: string;
}

/** Menú de orden dinámico (actividad reciente, prioridad, etc.) como en Tickets. */
export function ListSortMenu({
  sortValue,
  sortOptions,
  onSortChange,
  menuAriaLabel = "Ordenar listado",
}: ListSortMenuProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number; originX: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const { mounted, exiting, ref: panelRef, snap } = useDisclosureMotion<HTMLDivElement>(open);
  const handleMenuKeyDown = useMenuKeyboard(panelRef, open);

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
    function handleViewportChange(event: Event) {
      const target = event.target;
      if (target instanceof Node && panelRef.current?.contains(target)) return;
      setOpen(false);
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
  }, [open, snap, panelRef]);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.max(8, rect.right - MENU_WIDTH);
    setAnchor({ top: rect.bottom + 6, left, originX: rect.left + rect.width / 2 - left });
    setOpen(true);
  }

  const activeSort = sortOptions.find((option) => option.value === sortValue);
  const menuLabel = activeSort?.label ?? "Ordenar por";

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={mounted ? panelId : undefined}
        aria-label={`Ordenar por (activo: ${menuLabel})`}
        title={`Orden: ${menuLabel}`}
        className={`inline-flex h-8 max-w-full shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] font-medium transition-colors duration-150 outline-none select-none cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-red/25 ${
          open
            ? "border-zinc-200 bg-white text-zinc-900 shadow-2xs"
            : "border-zinc-200/80 bg-white text-zinc-600 shadow-2xs hover:border-zinc-300 hover:text-zinc-900"
        }`}
      >
        <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
        <span className="whitespace-nowrap">{menuLabel}</span>
        <ChevronDown
          className={`ml-auto h-3 w-3 shrink-0 text-zinc-400 transition-transform duration-280 ease-plf-spring motion-reduce:transition-none ${open ? "rotate-180 text-zinc-700" : ""}`}
        />
      </button>

      {mounted &&
        anchor &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="menu"
            aria-label={menuAriaLabel}
            aria-hidden={exiting}
            onKeyDown={handleMenuKeyDown}
            style={{
              position: "fixed",
              top: anchor.top,
              left: anchor.left,
              width: MENU_WIDTH,
              transformOrigin: `${anchor.originX}px top`,
            }}
            className={`z-[60] flex flex-col gap-0.5 rounded-lg border border-zinc-200/90
              bg-white p-1 shadow-[0_10px_28px_-6px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.04)] ${
                exiting ? "pointer-events-none" : ""
              }`}
          >
            <div data-motion-item className="select-none px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-faint">
              Ordenar por
            </div>
            {sortOptions.map(({ value, label }) => {
              const isActive = value === sortValue;
              return (
                <button
                  key={value}
                  data-motion-item
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  onClick={() => {
                    onSortChange(value);
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                  className={`flex items-center justify-between gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand-red/25 ${
                    isActive
                      ? "bg-zinc-100 font-semibold text-zinc-900"
                      : "font-medium text-zinc-700 hover:bg-zinc-100/80 hover:text-zinc-900"
                  }`}
                >
                  <span>{label}</span>
                  {isActive ? <Check className="size-3.5 shrink-0 text-zinc-600" aria-hidden /> : null}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
