import { Building, Check, ChevronDown, Search, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDisclosureMotion } from "../../../hooks/useDisclosureMotion";
import {
  PANEL_MIN_WIDTH,
  VIEWPORT_GUTTER,
  panelClasses,
  triggerClasses,
  type Anchor,
} from "./filterShared";

export interface FilterOption {
  value: string;
  label: string;
  hint?: string;
  icon?: ReactNode;
}

export interface FilterDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  title?: string;
  defaultIcon?: ReactNode;
  "aria-label"?: string;
  className?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
}

// Menú desplegable flotante con iconos y animación suave para filtros de barra de herramientas.
export function FilterDropdown({
  value,
  onChange,
  options,
  title,
  defaultIcon,
  "aria-label": ariaLabel,
  className = "",
  searchable = false,
  searchPlaceholder = "Buscar…",
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const { mounted, exiting, ref: panelRef, snap } = useDisclosureMotion<HTMLDivElement>(isOpen);

  const activeOption = options.find((opt) => opt.value === value) ?? options[0];

  const filteredOptions =
    searchable && searchTerm.trim()
      ? options.filter((opt) => {
          const q = searchTerm.trim().toLowerCase();
          return opt.label.toLowerCase().includes(q) || (opt.hint ? opt.hint.toLowerCase().includes(q) : false);
        })
      : options;

  function openDropdown() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const hasHints = options.some((o) => !!o.hint);
    const width = Math.max(rect.width, hasHints ? 280 : (searchable ? 240 : PANEL_MIN_WIDTH));
    const left = Math.max(
      VIEWPORT_GUTTER,
      Math.min(rect.left, window.innerWidth - width - VIEWPORT_GUTTER),
    );

    setAnchor({ top: rect.bottom + 6, left, width, originX: rect.left + rect.width / 2 - left });
    setIsOpen(true);
    setSearchTerm("");
  }

  const closeDropdown = useCallback(
    (immediate = false) => {
      setIsOpen(false);
      setSearchTerm("");
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

    function handleViewportChange(event: Event) {
      const target = event.target;
      if (target instanceof Node && panelRef.current?.contains(target)) return;
      if (
        target instanceof Element &&
        (target.closest("[role='dialog']") !== null || target.closest("[data-dropdown-portal]") !== null)
      ) {
        return;
      }
      if (
        target !== document &&
        target !== document.documentElement &&
        target !== document.body &&
        target !== window
      ) {
        return;
      }
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
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={mounted ? panelId : undefined}
        aria-label={ariaLabel ?? activeOption?.label}
        data-open={isOpen}
        className={triggerClasses(isOpen)}
      >
        <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-zinc-500 group-hover:text-zinc-800">
          {activeOption?.icon ?? defaultIcon}
        </span>
        <span className="max-w-[240px] truncate whitespace-nowrap">{activeOption?.label}</span>
        {activeOption?.hint && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-[5px] bg-zinc-100 px-1.5 py-0.5 font-heading text-[10px] font-semibold uppercase tracking-wider text-zinc-600 border border-zinc-200/80">
            <Building className="h-2.5 w-2.5 text-zinc-400" />
            {activeOption.hint}
          </span>
        )}
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
            data-dropdown-portal="true"
            aria-label={ariaLabel ?? title}
            aria-hidden={exiting}
            style={{
              position: "fixed",
              top: anchor.top,
              left: anchor.left,
              minWidth: anchor.width,
              transformOrigin: `${anchor.originX}px top`,
            }}
            className={panelClasses(exiting)}
          >
            {title && (
              <div
                data-motion-item
                className="select-none px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-zinc-400"
              >
                {title}
              </div>
            )}
            {searchable && (
              <div className="border-b border-zinc-100 p-1 mb-0.5">
                <div className="relative flex items-center">
                  <Search className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-zinc-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full rounded-md border border-zinc-200 bg-zinc-50/70 py-1 pl-7 pr-6 text-[12px] text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-brand-red focus:bg-white focus:ring-1 focus:ring-brand-red/20 transition-all"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        closeDropdown();
                        triggerRef.current?.focus();
                      }
                      e.stopPropagation();
                    }}
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm("")}
                      className="absolute right-1.5 flex h-4 w-4 items-center justify-center rounded text-zinc-400 hover:text-zinc-600 cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            )}
            <div className="max-h-[280px] overflow-y-auto flex flex-col gap-0.5">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-3 text-center text-[12px] text-zinc-400">
                  No se encontraron resultados
                </div>
              ) : (
                filteredOptions.map((option) => {
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
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                        <span className="truncate">{option.label}</span>
                        {option.hint && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-[5px] bg-zinc-100/90 px-1.5 py-0.5 font-heading text-[10px] font-semibold uppercase tracking-wider text-zinc-500 border border-zinc-200/60">
                            <Building className="h-2.5 w-2.5 text-zinc-400" />
                            {option.hint}
                          </span>
                        )}
                      </div>
                      {isSelected && (
                        <Check aria-hidden className="h-3.5 w-3.5 shrink-0 text-brand-red ml-1" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
