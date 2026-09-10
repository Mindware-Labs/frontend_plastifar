import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

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

export function TicketFilterDropdown({
  value,
  onChange,
  options,
  title,
  defaultIcon,
  "aria-label": ariaLabel,
  className = "",
}: TicketFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const activeOption = options.find((opt) => opt.value === value) ?? options[0];

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
  }, [open]);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const estimatedWidth = Math.max(rect.width, 210);
    let left = rect.left;
    if (left + estimatedWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - estimatedWidth - 12);
    }

    setAnchor({
      top: rect.bottom + 6,
      left,
      width: estimatedWidth,
    });
    setOpen(true);
  }

  return (
    <div className={`relative shrink-0 ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={ariaLabel ?? activeOption?.label}
        data-open={open}
        className="group inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5
          text-[12.5px] font-medium text-zinc-700 shadow-2xs outline-none transition-all hover:border-zinc-300
          hover:bg-zinc-50 active:scale-[0.98] focus-visible:border-zinc-400 focus-visible:ring-2
          focus-visible:ring-zinc-400/20"
      >
        <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-zinc-500 group-hover:text-zinc-800">
          {activeOption?.icon ?? defaultIcon}
        </span>
        <span className="max-w-[240px] truncate whitespace-nowrap">{activeOption?.label}</span>
        <ChevronDown
          aria-hidden
          className={`h-3 w-3 shrink-0 text-zinc-400 transition-transform duration-150 ${
            open ? "rotate-180 text-zinc-700" : "group-hover:text-zinc-600"
          }`}
        />
      </button>

      {open &&
        anchor &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="listbox"
            aria-label={ariaLabel ?? title}
            style={{
              position: "fixed",
              top: anchor.top,
              left: anchor.left,
              minWidth: anchor.width,
            }}
            className="animate-plf-popover-in z-[85] flex flex-col gap-0.5 rounded-lg border border-zinc-200/90
              bg-white p-1 shadow-[0_10px_28px_-6px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.04)]"
          >
            {title && (
              <div className="select-none px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-zinc-400">
                {title}
              </div>
            )}
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                  className={`group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px]
                    transition-colors ${
                      isSelected
                        ? "bg-zinc-100 font-semibold text-ink"
                        : "font-medium text-zinc-700 hover:bg-zinc-100/80 hover:text-ink"
                    }`}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center text-zinc-500 group-hover:text-ink">
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
