import { ChevronDown, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDisclosureMotion } from "../../../hooks/useDisclosureMotion";
import {
  VIEWPORT_GUTTER,
  panelClasses,
  triggerClasses,
  type Anchor,
} from "./filterShared";

export interface InputFilterDropdownProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputPlaceholder?: string;
  title?: string;
  type?: "text" | "number";
  min?: string;
  step?: string;
  inputMode?: "text" | "decimal" | "numeric";
  formatActiveLabel?: (value: string) => string;
  defaultIcon?: ReactNode;
  "aria-label"?: string;
  className?: string;
}

/**
 * Filtro desplegable con campo de texto o número (p. ej. despachador, monto mínimo)
 * con la misma estética que `FilterDropdown`.
 */
export function InputFilterDropdown({
  value,
  onChange,
  placeholder,
  inputPlaceholder = "Escribe un valor…",
  title,
  type = "text",
  min,
  step,
  inputMode,
  formatActiveLabel,
  defaultIcon,
  "aria-label": ariaLabel,
  className = "",
}: InputFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelId = useId();
  const { mounted, exiting, ref: panelRef, snap } = useDisclosureMotion<HTMLDivElement>(isOpen);

  const trimmed = value.trim();
  const displayLabel = trimmed
    ? formatActiveLabel
      ? formatActiveLabel(trimmed)
      : trimmed
    : placeholder;

  function openDropdown() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const width = Math.max(rect.width, 220);
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
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      closeDropdown();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" || event.key === "Enter") {
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
          {defaultIcon}
        </span>
        <span className="max-w-[200px] truncate whitespace-nowrap">{displayLabel}</span>
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
            aria-label={ariaLabel ?? title ?? placeholder}
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
            {title && (
              <div className="select-none text-[11px] font-medium text-zinc-400">{title}</div>
            )}
            <input
              ref={inputRef}
              type={type}
              min={min}
              step={step}
              inputMode={inputMode}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder={inputPlaceholder}
              aria-label={title ?? placeholder}
              className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-[12.5px] text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-zinc-400"
            />
            {trimmed && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  closeDropdown();
                  triggerRef.current?.focus();
                }}
                className="inline-flex h-7 w-full items-center justify-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 text-[12px] font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 cursor-pointer"
              >
                <X className="h-3 w-3" />
                <span> Restablecer</span>
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
