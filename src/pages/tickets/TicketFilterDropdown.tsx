import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDisclosureMotion } from "../../hooks/useDisclosureMotion";

export interface TicketFilterOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

interface TicketFilterDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: TicketFilterOption[];
  title?: string;
  defaultIcon?: ReactNode;
  "aria-label"?: string;
  className?: string;
}

interface Anchor {
  top: number;
  left: number;
  width: number;
  /** Centro del disparador respecto al borde izquierdo del panel: de ahí brota el despliegue. */
  originX: number;
}

const PANEL_MIN_WIDTH = 210;
const VIEWPORT_GUTTER = 12;

export function TicketFilterDropdown({
  value,
  onChange,
  options,
  title,
  defaultIcon,
  "aria-label": ariaLabel,
  className = "",
}: TicketFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const { mounted, exiting, ref: panelRef, snap } = useDisclosureMotion<HTMLDivElement>(isOpen);

  const activeOption = options.find((opt) => opt.value === value) ?? options[0];

  function openDropdown() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const width = Math.max(rect.width, PANEL_MIN_WIDTH);
    const left = Math.max(
      VIEWPORT_GUTTER,
      Math.min(rect.left, window.innerWidth - width - VIEWPORT_GUTTER),
    );

    setAnchor({ top: rect.bottom + 6, left, width, originX: rect.left + rect.width / 2 - left });
    setIsOpen(true);
  }

  function closeDropdown(immediate = false) {
    setIsOpen(false);
    if (immediate) snap();
  }

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
  }, [isOpen]);

  return (
    <div className={`relative shrink-0 ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (isOpen ? closeDropdown() : openDropdown())}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={mounted ? panelId : undefined}
        aria-label={ariaLabel ?? activeOption?.label}
        data-open={isOpen}
        className={`group inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-medium shadow-2xs outline-none transition-colors duration-150 cursor-pointer select-none ${
          isOpen
            ? "border-zinc-300 bg-zinc-50/80 text-zinc-900"
            : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
        }`}
      >
        <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-zinc-500 group-hover:text-zinc-800">
          {activeOption?.icon ?? defaultIcon}
        </span>
        <span className="max-w-[240px] truncate whitespace-nowrap">{activeOption?.label}</span>
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
            role="listbox"
            aria-label={ariaLabel ?? title}
            aria-hidden={exiting}
            style={{
              position: "fixed",
              top: anchor.top,
              left: anchor.left,
              minWidth: anchor.width,
              transformOrigin: `${anchor.originX}px top`,
            }}
            className={`z-[85] flex flex-col gap-0.5 rounded-lg border border-zinc-200/90
              bg-white/95 backdrop-blur-xs p-1 shadow-[0_10px_28px_-6px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.04)] ${
                exiting ? "pointer-events-none" : ""
              }`}
          >
            {title && (
              <div
                data-motion-item
                className="select-none px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-zinc-400"
              >
                {title}
              </div>
            )}
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  data-motion-item
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.value);
                    closeDropdown();
                    triggerRef.current?.focus();
                  }}
                  className={`group flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[12.5px]
                    transition-colors duration-100 ease-out cursor-pointer select-none ${
                      isSelected
                        ? "bg-zinc-100 font-semibold text-zinc-900"
                        : "font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 active:bg-zinc-100/70"
                    }`}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center text-zinc-500 group-hover:text-zinc-900">
                    {option.icon ?? defaultIcon}
                  </span>
                  <span className="flex-1 truncate">{option.label}</span>
                  {isSelected && (
                    <Check aria-hidden className="h-3.5 w-3.5 shrink-0 text-brand-red" />
                  )}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
