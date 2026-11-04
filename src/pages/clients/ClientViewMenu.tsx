import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDisclosureMotion } from "../../hooks/useDisclosureMotion";
import { useMenuKeyboard } from "../../hooks/useMenuKeyboard";

export interface ClientViewOption {
  value: string;
  label: string;
}

const MENU_WIDTH = 272;

interface ClientViewMenuProps {
  sortValue: string;
  focusValue: string;
  sortOptions: ClientViewOption[];
  focusOptions: ClientViewOption[];
  onSortChange: (value: string) => void;
  onFocusChange: (value: string) => void;
}

/** Orden y enfoque del directorio (mismo patrón que la bandeja de tickets). */
export function ClientViewMenu({
  sortValue,
  focusValue,
  sortOptions,
  focusOptions,
  onSortChange,
  onFocusChange,
}: ClientViewMenuProps) {
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
    function handleViewportChange() {
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
  const activeFocus = focusOptions.find((option) => option.value === focusValue);
  const focusActive = focusValue !== "todos";
  const menuLabel = focusActive ? (activeFocus?.label ?? "Vista") : (activeSort?.label ?? "Ordenar vista");

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={mounted ? panelId : undefined}
        aria-label={`Vista del directorio (activo: ${menuLabel})`}
        title={`Vista: ${menuLabel}`}
        className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] font-medium transition-colors duration-150 outline-none select-none cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-red/25 ${
          open || focusActive
            ? "border-zinc-200 bg-white text-zinc-900 shadow-2xs"
            : "border-zinc-200/80 bg-white text-zinc-600 hover:border-zinc-200 hover:text-zinc-900"
        }`}
      >
        <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
        <span className="max-w-[11rem] truncate">{menuLabel}</span>
        {focusActive && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-red" title="Filtro de vista activo" />
        )}
        <ChevronDown
          className={`h-3 w-3 shrink-0 text-zinc-400 transition-transform duration-280 ease-plf-spring motion-reduce:transition-none ${open ? "rotate-180 text-zinc-700" : ""}`}
        />
      </button>

      {mounted &&
        anchor &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="menu"
            aria-label="Vista del directorio de clientes"
            aria-hidden={exiting}
            onKeyDown={handleMenuKeyDown}
            style={{
              position: "fixed",
              top: anchor.top,
              left: anchor.left,
              width: MENU_WIDTH,
              transformOrigin: `${anchor.originX}px top`,
            }}
            className={`z-[60] flex max-h-[min(24rem,calc(100vh-1rem))] flex-col gap-0.5 overflow-y-auto rounded-lg border border-zinc-200/90
              bg-white p-1 shadow-[0_10px_28px_-6px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.04)] ${
                exiting ? "pointer-events-none" : ""
              }`}
          >
            <div data-motion-item className="select-none px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-zinc-400">
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

            <div
              data-motion-item
              className="select-none border-t border-zinc-100 px-2.5 pt-2 pb-1 text-[11px] font-medium text-zinc-400"
            >
              Enfocar en
            </div>
            {focusOptions.map(({ value, label }) => {
              const isActive = value === focusValue;
              return (
                <button
                  key={value}
                  data-motion-item
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  onClick={() => {
                    onFocusChange(value);
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
