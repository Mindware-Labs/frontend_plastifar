import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  controlBase,
  controlSizes,
  stateClasses,
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
  id?: string;
  className?: string;
  buttonClassName?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
}

const PANEL_MAX_HEIGHT = 264;

/**
 * Desplegable propio del panel, no el del sistema operativo: el nativo no acepta
 * tipografia, radio ni color, y en cada navegador se ve distinto.
 *
 * Se comporta como un combobox real: teclado completo (flechas, Inicio/Fin,
 * Enter, Escape), buscador propio para filtrar por texto, roles ARIA y foco
 * siempre gobernado (al disparador al cerrar, al buscador al abrir).
 * El panel se dibuja en un portal para que no lo recorte el scroll de un dialogo.
 */
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
  const [anchor, setAnchor] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

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

    setAnchor({
      left: rect.left,
      width: rect.width,
      top: dropUp ? undefined : rect.bottom + 4,
      bottom: dropUp ? window.innerHeight - rect.top + 4 : undefined,
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

  function closeList() {
    setOpen(false);
    onBlur?.();
  }

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

  // El buscador recibe el foco apenas se abre el panel: se escribe de inmediato.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => searchInputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent | MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || containerRef.current?.contains(target)) return;
      setOpen(false);
      onBlur?.();
    }

    // Reposicionar en cada scroll seria un baile: se cierra, como haria el nativo.
    // Pero el scroll del propio listado (cuando hay muchas opciones) no cuenta:
    // "scroll" no burbujea, mas igual llega aqui en la fase de captura.
    function handleViewportChange(event: Event) {
      if (event.target instanceof Node && containerRef.current?.contains(event.target)) return;
      setOpen(false);
    }

    function handleWindowBlur() {
      setOpen(false);
      onBlur?.();
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
  }, [open, onBlur]);

  // Mantiene visible la opcion activa cuando se navega con el teclado.
  // Se busca por data-option-index (no por posicion): la busqueda oculta opciones,
  // asi que el indice logico no coincide con el orden de los <li> montados.
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

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
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
    idle: "border-line bg-canvas/70 hover:bg-canvas hover:border-line-strong text-ink shadow-2xs focus:border-brand-red/60 focus:ring-2 focus:ring-brand-red/15",
    error: "border-brand-red/60 bg-brand-red/[0.04] text-ink focus:ring-2 focus:ring-brand-red/15",
    valid: "border-brand-green/60 bg-brand-green/[0.03] focus:ring-2 focus:ring-brand-green/15",
  };

  const triggerVariantClass = isSubtle
    ? subtleStateClasses[resolved]
    : `${controlBase} ${stateClasses[resolved]}`;

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
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={resolved === "error"}
        disabled={disabled}
        onClick={() => (open ? closeList() : openList())}
        onKeyDown={handleKeyDown}
        className={`${
          isSubtle
            ? "w-full rounded-edge border text-left outline-none transition-all disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted"
            : ""
        } ${triggerVariantClass} ${sizeClass} ${paddingClass}
          flex items-center justify-between font-medium
          ${selected ? "text-ink" : "text-zinc-400"} ${buttonClassName}`}
      >
        <div className="flex min-w-0 items-center gap-1.5 truncate">
          {leftIcon}
          <span className="truncate">{selected?.label ?? placeholder}</span>
        </div>
        <ChevronDown
          aria-hidden
          className={`${
            size === "xs" ? "h-3 w-3" : "h-4 w-4"
          } shrink-0 text-faint transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open &&
        anchor &&
        createPortal(
          <>
            <div
              data-select-backdrop="true"
              className="fixed inset-0 z-[70]"
              aria-hidden="true"
              onPointerDown={() => {
                setOpen(false);
                onBlur?.();
              }}
            />
            <div
              ref={containerRef}
              data-select-portal="true"
              style={{
                position: "fixed",
                left: anchor.left,
                top: anchor.top,
                bottom: anchor.bottom,
                width: Math.max(anchor.width, size === "xs" || isSubtle ? 180 : anchor.width),
                maxHeight: PANEL_MAX_HEIGHT,
              }}
              className="animate-plf-toast-in z-[80] flex flex-col overflow-hidden rounded-edge border border-line
                bg-white shadow-[0_4px_8px_rgba(27,27,29,0.04),0_24px_48px_-20px_rgba(27,27,29,0.28)]"
            >
              <div className="relative shrink-0 border-b border-line p-1.5">
                <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(event) => handleQueryChange(event.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Buscar…"
                  aria-label="Buscar opciones"
                  aria-controls={listId}
                  className="w-full rounded-edge border border-line bg-canvas/60 py-1.5 pl-8 pr-2 text-[12px]
                    text-ink outline-none transition-colors placeholder:text-faint focus:border-brand-red/40
                    focus:bg-white focus:ring-2 focus:ring-brand-red/10"
                />
              </div>

              <ul
                ref={listRef}
                id={listId}
                role="listbox"
                aria-label={ariaLabel}
                className="min-h-0 flex-1 overflow-y-auto p-1"
              >
                {options.map((option, index) => {
                  if (!isVisible(option)) return null;
                  const isSelected = option.value === value;
                  const isActive = index === activeIndex;

                  return (
                    <li
                      key={option.value}
                      id={`${listId}-${index}`}
                      data-option-index={index}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={option.disabled}
                      onMouseEnter={() => !option.disabled && setActiveIndex(index)}
                      onClick={() => commit(index)}
                      className={`flex cursor-pointer items-center justify-between gap-2 rounded-edge transition-colors ${
                        size === "xs"
                          ? "px-2 py-1.5 text-[11.5px]"
                          : size === "sm"
                            ? "px-2 py-1.5 text-[12px]"
                            : "px-2.5 py-2 text-[13px]"
                      } ${
                        option.disabled
                          ? "cursor-not-allowed text-zinc-300"
                          : isActive
                            ? "bg-fill text-ink"
                            : "text-brand-gray"
                      } ${isSelected ? "font-semibold text-ink" : ""}`}
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
