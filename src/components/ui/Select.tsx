import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useDisclosureMotion } from "../../hooks/useDisclosureMotion";
import {
  controlSizes,
  type ControlSize,
  type FieldState,
} from "./fieldStyles";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  hidden?: boolean;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  options: SelectOption[];
  placeholder?: string;
  size?: ControlSize;
  variant?: "default" | "subtle";
  leftIcon?: React.ReactNode;
  state?: FieldState;
  disabled?: boolean;
  /** Por defecto aparece solo si hay bastantes opciones que filtrar. */
  searchable?: boolean;
  id?: string;
  className?: string;
  buttonClassName?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
}

const PANEL_MAX_HEIGHT = 264;

interface Anchor {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  /** Centro del disparador respecto al borde izquierdo del panel: de ahí brota el despliegue. */
  originX: number;
}

// Anchura mínima adaptada al contenido y marca de selección.
const PANEL_MIN_WIDTH = 96;

// En xs y en la variante discreta el disparador es una pastilla corta por diseño.
const PANEL_MIN_WIDTH_COMPACT_TRIGGER = 180;

// Por debajo de esto la lista se recorre de un vistazo y el buscador solo estorba.
const SEARCH_FROM = 9;

/** Desplegable accesible con navegación por teclado y portal para scroll. */
export function Select({
  value,
  onChange,
  onBlur,
  options,
  placeholder = "Selecciona una opción",
  size = "md",
  variant = "default",
  leftIcon,
  state = "idle",
  disabled,
  searchable,
  id,
  className = "",
  buttonClassName = "",
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: SelectProps) {
  const generated = useId();
  const listId = `${id ?? generated}-listbox`;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [query, setQuery] = useState("");
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropUp = anchor?.bottom !== undefined;
  const { mounted, exiting, ref: containerRef, snap } = useDisclosureMotion<HTMLDivElement>(open, {
    direction: dropUp ? "up" : "down",
  });

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const showSearch = searchable ?? options.filter((option) => !option.hidden).length >= SEARCH_FROM;

  /** Visible = no oculta y, si hay busqueda activa, su texto la contiene. */
  function isVisible(option: SelectOption) {
    if (option.hidden) return false;
    const q = query.trim().toLowerCase();
    return !q || option.label.toLowerCase().includes(q);
  }

  function measure() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const below = window.innerHeight - rect.bottom;
    const dropUp = below < PANEL_MAX_HEIGHT && rect.top > below;

    const width = Math.max(
      rect.width,
      size === "xs" || isSubtle ? PANEL_MIN_WIDTH_COMPACT_TRIGGER : PANEL_MIN_WIDTH,
    );

    // Un panel más ancho que su disparador no puede desbordar la ventana por la derecha.
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));

    setAnchor({
      left,
      width,
      top: dropUp ? undefined : rect.bottom + 4,
      bottom: dropUp ? window.innerHeight - rect.top + 4 : undefined,
      originX: rect.left + rect.width / 2 - left,
    });
  }

  function openList() {
    if (disabled) return;
    measure();
    setQuery("");
    const initialIndex =
      selectedIndex >= 0 && !options[selectedIndex]?.hidden
        ? selectedIndex
        : options.findIndex((o) => !o.disabled && !o.hidden);
    setActiveIndex(initialIndex >= 0 ? initialIndex : 0);
    setOpen(true);
  }

  const closeList = useCallback(
    (immediate = false) => {
      if (!open) return;
      setOpen(false);
      if (immediate) snap();
      onBlur?.();
    },
    [open, snap, onBlur],
  );

  function commit(index: number) {
    const option = options[index];
    if (!option || option.disabled || option.hidden) return;
    onChange(option.value);
    closeList();
    triggerRef.current?.focus();
  }

  /** Salta a la siguiente opcion utilizable (visible segun la busqueda) en la direccion dada. */
  function move(from: number, step: number) {
    for (let index = from + step; index >= 0 && index < options.length; index += step) {
      if (!options[index].disabled && isVisible(options[index])) return index;
    }
    return from;
  }

  function handleQueryChange(next: string) {
    setQuery(next);
    const q = next.trim().toLowerCase();
    const firstMatch = options.findIndex(
      (o) => !o.disabled && !o.hidden && (!q || o.label.toLowerCase().includes(q)),
    );
    setActiveIndex(firstMatch);
  }

  // Enfoque inicial al buscador o al primer elemento de la lista al abrir.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(
      () => (showSearch ? searchInputRef.current : listRef.current)?.focus(),
      0,
    );
    return () => window.clearTimeout(id);
  }, [open, showSearch]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent | MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || containerRef.current?.contains(target)) return;
      closeList();
    }

    // Cierre automático al detectar scroll exterior.
    function handleViewportChange(event: Event) {
      if (event.target instanceof Node && containerRef.current?.contains(event.target)) return;
      closeList(true);
    }

    function handleWindowBlur() {
      closeList(true);
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("mousedown", handlePointerDown, true);
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("mousedown", handlePointerDown, true);
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [open, closeList, containerRef]);

  // Mantiene visible la opción activa durante la navegación por teclado.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-option-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled || open) return;

    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      openList();
    }
  }

  /** Navegación del panel abierto; la usa el buscador o la lista, según cuál tenga el foco. */
  function handleNavKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) => move(index, 1));
        return;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((index) => move(index, -1));
        return;
      case "Home":
        event.preventDefault();
        setActiveIndex(move(-1, 1));
        return;
      case "End":
        event.preventDefault();
        setActiveIndex(move(options.length, -1));
        return;
      case "Enter":
        event.preventDefault();
        commit(activeIndex);
        return;
      case "Escape":
        event.preventDefault();
        closeList();
        triggerRef.current?.focus();
        return;
      case "Tab":
        closeList();
        return;
      default:
        return;
    }
  }

  const resolved: FieldState = state;
  const isSubtle = variant === "subtle";
  const sizeClass = controlSizes[size];
  const paddingClass =
    size === "xs"
      ? "px-2 py-0.5 gap-1.5"
      : size === "sm"
        ? "pl-2.5 pr-2 gap-2"
        : "pl-3 pr-2.5 gap-2";

  const subtleStateClasses: Record<FieldState, string> = {
    idle: "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 text-zinc-800 shadow-2xs focus:outline-none focus-visible:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-400/20",
    error: "border-brand-red bg-brand-red/[0.02] text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/12",
    valid: "border-brand-green/50 bg-brand-green/[0.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/10",
  };

  const defaultStateClasses: Record<FieldState, string> = {
    idle: "border-zinc-200 bg-white text-zinc-800 shadow-2xs hover:border-zinc-300 hover:bg-zinc-50 focus:outline-none focus-visible:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-400/20",
    error: "border-brand-red bg-brand-red/[0.02] text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/12",
    valid: "border-brand-green/50 bg-brand-green/[0.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/10",
  };

  const triggerVariantClass = open
    ? "border-zinc-300 bg-zinc-50/80 text-zinc-900 shadow-2xs"
    : isSubtle
      ? subtleStateClasses[resolved]
      : defaultStateClasses[resolved];

  const visibleCount = options.filter(isVisible).length;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={mounted ? listId : undefined}
        aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={resolved === "error"}
        disabled={disabled}
        onClick={() => (open ? closeList() : openList())}
        onKeyDown={handleKeyDown}
        className={`w-full rounded-lg border text-left outline-none transition-colors duration-150 cursor-pointer select-none
          disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400
          ${triggerVariantClass} ${sizeClass} ${paddingClass}
          flex items-center justify-between font-medium
          ${selected ? "text-zinc-900" : "text-zinc-400"} ${buttonClassName}`}
      >
        <div className="flex min-w-0 items-center gap-1.5 truncate">
          {leftIcon}
          <span className="truncate">{selected?.label ?? placeholder}</span>
        </div>
        <ChevronDown
          aria-hidden
          className={`${
            size === "xs" ? "h-3 w-3" : "h-4 w-4"
          } shrink-0 text-zinc-400 transition-transform duration-280 ease-plf-spring motion-reduce:transition-none ${
            open ? "rotate-180 text-zinc-700" : ""
          }`}
        />
      </button>

      {mounted &&
        anchor &&
        createPortal(
          <>
            {!exiting && (
              <div
                data-select-backdrop="true"
                className="fixed inset-0 z-[70]"
                aria-hidden="true"
                onPointerDown={() => closeList()}
              />
            )}
            <div
              ref={containerRef}
              data-select-portal="true"
              aria-hidden={exiting}
              style={{
                position: "fixed",
                left: anchor.left,
                top: anchor.top,
                bottom: anchor.bottom,
                width: anchor.width,
                maxHeight: PANEL_MAX_HEIGHT,
                transformOrigin: `${anchor.originX}px ${dropUp ? "bottom" : "top"}`,
              }}
              className={`z-[80] flex flex-col overflow-hidden rounded-lg border border-zinc-200/90
                bg-white/95 backdrop-blur-xs shadow-[0_10px_28px_-6px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.04)]
                ${exiting ? "pointer-events-none" : ""}`}
            >
              {showSearch && (
                <div data-motion-item className="relative shrink-0 border-b border-zinc-100 p-1.5">
                  <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={query}
                    onChange={(event) => handleQueryChange(event.target.value)}
                    onKeyDown={handleNavKeyDown}
                    placeholder="Buscar…"
                    aria-label="Buscar opciones"
                    aria-controls={listId}
                    className="w-full rounded-md border border-zinc-200 bg-zinc-50/60 py-1.5 pl-8 pr-2 text-[12px]
                      text-zinc-800 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400
                      focus:bg-white focus:ring-2 focus:ring-zinc-400/20"
                  />
                </div>
              )}

              <ul
                ref={listRef}
                id={listId}
                role="listbox"
                aria-label={ariaLabel}
                tabIndex={showSearch ? undefined : -1}
                onKeyDown={showSearch ? undefined : handleNavKeyDown}
                className="min-h-0 flex-1 overflow-y-auto p-1 outline-none"
              >
                {options.map((option, index) => {
                  if (!isVisible(option)) return null;
                  const isSelected = option.value === value;
                  const isActive = index === activeIndex;

                  return (
                    <li
                      key={option.value}
                      data-motion-item
                      id={`${listId}-${index}`}
                      data-option-index={index}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={option.disabled}
                      onMouseEnter={() => !option.disabled && setActiveIndex(index)}
                      onClick={() => commit(index)}
                      className={`flex cursor-pointer items-center justify-between gap-2 rounded-md transition-colors ${
                        size === "xs"
                          ? "px-2 py-1.5 text-[11.5px]"
                          : size === "sm"
                            ? "px-2 py-1.5 text-[12px]"
                            : "px-2.5 py-2 text-[13px]"
                      } ${
                        option.disabled
                          ? "cursor-not-allowed text-zinc-300"
                          : isActive
                            ? "bg-zinc-100 text-zinc-900 font-medium"
                            : "text-zinc-700 hover:bg-zinc-100/70"
                      } ${isSelected ? "font-semibold text-zinc-900" : ""}`}
                    >
                      <span className="truncate">{option.label}</span>
                      {isSelected && (
                        <Check
                          aria-hidden
                          className={`${
                            size === "xs" ? "h-3.5 w-3.5" : "h-4 w-4"
                          } shrink-0 text-brand-red`}
                        />
                      )}
                    </li>
                  );
                })}

                {visibleCount === 0 && (
                  <li className="px-2.5 py-3 text-center text-[12.5px] text-faint">
                    {query.trim() ? "Sin resultados" : "Sin opciones"}
                  </li>
                )}
              </ul>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
