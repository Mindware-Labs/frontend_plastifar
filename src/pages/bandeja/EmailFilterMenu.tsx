import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDisclosureMotion } from "../../hooks/useDisclosureMotion";
import { useMenuKeyboard } from "../../hooks/useMenuKeyboard";
import type { EmailListResponse } from "../../types/api";

export type TicketFilter = "todos" | "sin-ticket" | "sin-responder" | "mios";

/** Una vista de la bandeja con la clave de su contador. */
export interface EmailFilterOption {
  key: TicketFilter;
  label: string;
  countKey: keyof EmailListResponse["counts"];
}

const STATUS_MENU_WIDTH = 200;

interface EmailFilterMenuProps {
  options: EmailFilterOption[];
  activeKey: TicketFilter;
  counts?: EmailListResponse["counts"];
  assignedUnseen?: number;
  onSelect: (key: TicketFilter) => void;
  className?: string;
}

export function EmailFilterMenu({
  options,
  activeKey,
  counts,
  assignedUnseen,
  onSelect,
  className = "",
}: EmailFilterMenuProps) {
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
    const left = Math.max(8, rect.right - STATUS_MENU_WIDTH);
    setAnchor({ top: rect.bottom + 6, left, originX: rect.left + rect.width / 2 - left });
    setOpen(true);
  }

  const active = options.find((option) => option.key === activeKey);
  const activeCount = active && counts ? counts[active.countKey] : 0;
  const hasUnseen = Boolean(assignedUnseen && assignedUnseen > 0);

  return (
    <div className={`relative min-w-0 w-full ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={mounted ? panelId : undefined}
        aria-label={active ? `Más filtros (activo: ${active.label})` : "Más filtros"}
        title={active ? `Filtro activo: ${active.label}` : "Más filtros"}
        className={`inline-flex h-8 w-full min-w-0 items-center justify-center gap-1 rounded-lg px-1 text-[12px] shadow-2xs transition-all outline-none select-none cursor-pointer active:scale-[0.98] ${
          active
            ? "border border-zinc-300 bg-zinc-100 font-semibold text-zinc-900"
            : "border border-zinc-200 bg-white font-medium text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
        }`}
      >
        <span className="flex items-center gap-1 min-w-0 truncate">
          <span className="truncate">{active ? active.label : "Más"}</span>
          {active ? (
            <span className="rounded-full bg-zinc-200 px-1.5 py-0.2 text-[10px] font-bold text-zinc-800 tabular-nums">
              {activeCount}
            </span>
          ) : (
            hasUnseen && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-red" title="Tienes correos asignados sin ver" />
            )
          )}
        </span>
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
            aria-label="Más filtros de correo"
            aria-hidden={exiting}
            onKeyDown={handleMenuKeyDown}
            style={{
              position: "fixed",
              top: anchor.top,
              left: anchor.left,
              width: STATUS_MENU_WIDTH,
              transformOrigin: `${anchor.originX}px top`,
            }}
            className={`z-[60] flex flex-col gap-0.5 rounded-lg border border-zinc-200/90
              bg-white p-1 shadow-[0_10px_28px_-6px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.04)] ${
                exiting ? "pointer-events-none" : ""
              }`}
          >
            <div data-motion-item className="select-none px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-zinc-400">
              Vistas secundarias
            </div>
            {options.map(({ key, label, countKey }) => {
              const isActive = key === activeKey;
              const count = counts?.[countKey] ?? 0;
              const showDot = key === "mios" && hasUnseen;
              return (
                <button
                  key={key}
                  data-motion-item
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  onClick={() => {
                    onSelect(key);
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                  className={`flex items-center justify-between gap-2.5 rounded-lg px-2.5 py-1.5 text-left
                    text-[12.5px] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand-red/25 ${
                      isActive
                        ? "bg-zinc-100 font-semibold text-zinc-900"
                        : "font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
                    }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {showDot && (
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-red shadow-[0_0_6px_rgba(228,0,43,0.5)]" />
                    )}
                    <span>{label}</span>
                  </span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10.5px] font-bold tabular-nums ${
                      isActive ? "bg-zinc-200 text-zinc-800" : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
