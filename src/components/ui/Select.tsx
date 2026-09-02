import { Check, ChevronDown } from "lucide-react";
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
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  options: SelectOption[];
  placeholder?: string;
  size?: ControlSize;
  state?: FieldState;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
}

const PANEL_MAX_HEIGHT = 264;

/**
 * Desplegable propio del panel, no el del sistema operativo: el nativo no acepta
 * tipografia, radio ni color, y en cada navegador se ve distinto.
 *
 * Se comporta como un combobox real: teclado completo (flechas, Inicio/Fin,
 * Enter, Escape y busqueda por letras), roles ARIA y foco siempre en el disparador.
 * El panel se dibuja en un portal para que no lo recorte el scroll de un dialogo.
 */
export function Select({
  value,
  onChange,
  onBlur,
  options,
  placeholder = "Selecciona una opción",
  size = "md",
  state = "idle",
  disabled,
  id,
  className = "",
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: SelectProps) {
  const generated = useId();
  const listId = `${id ?? generated}-listbox`;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [anchor, setAnchor] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ term: "", timer: 0 });

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

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
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }

  function closeList() {
    setOpen(false);
    onBlur?.();
  }

  function commit(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    closeList();
    triggerRef.current?.focus();
  }

  /** Salta a la siguiente opcion utilizable en la direccion dada. */
  function move(from: number, step: number) {
    for (let index = from + step; index >= 0 && index < options.length; index += step) {
      if (!options[index].disabled) return index;
    }
    return from;
  }

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
      onBlur?.();
    }

    // Reposicionar en cada scroll seria un baile: se cierra, como haria el nativo.
    function handleViewportChange() {
      setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [open, onBlur]);

  // Mantiene visible la opcion activa cuando se navega con el teclado.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    panelRef.current?.children[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;

    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }

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
      case " ":
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
        break;
    }

    // Busqueda por letras: "cal" salta a Calidad.
    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      window.clearTimeout(typeahead.current.timer);
      typeahead.current.term += event.key.toLowerCase();
      typeahead.current.timer = window.setTimeout(() => {
        typeahead.current.term = "";
      }, 600);

      const match = options.findIndex(
        (option) => !option.disabled && option.label.toLowerCase().startsWith(typeahead.current.term),
      );
      if (match >= 0) setActiveIndex(match);
    }
  }

  const resolved: FieldState = state;

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
        className={`${controlBase} ${stateClasses[resolved]} ${controlSizes[size]}
          flex items-center justify-between gap-2 pl-3 pr-2.5 font-medium
          ${selected ? "text-ink" : "text-zinc-400"}`}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown
          aria-hidden
          className={`h-4 w-4 shrink-0 text-faint transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open &&
        anchor &&
        createPortal(
          <ul
            ref={panelRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            style={{
              position: "fixed",
              left: anchor.left,
              top: anchor.top,
              bottom: anchor.bottom,
              width: anchor.width,
              maxHeight: PANEL_MAX_HEIGHT,
            }}
            className="animate-plf-toast-in z-[60] overflow-y-auto rounded-edge border border-line bg-white p-1
              shadow-[0_4px_8px_rgba(27,27,29,0.04),0_24px_48px_-20px_rgba(27,27,29,0.28)]"
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isActive = index === activeIndex;

              return (
                <li
                  key={option.value}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled}
                  onMouseEnter={() => !option.disabled && setActiveIndex(index)}
                  onClick={() => commit(index)}
                  className={`flex cursor-pointer items-center justify-between gap-2 rounded-edge px-2.5 py-2
                    text-[13px] transition-colors ${
                      option.disabled
                        ? "cursor-not-allowed text-zinc-300"
                        : isActive
                          ? "bg-fill text-ink"
                          : "text-brand-gray"
                    } ${isSelected ? "font-semibold text-ink" : ""}`}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && <Check aria-hidden className="h-4 w-4 shrink-0 text-brand-red" />}
                </li>
              );
            })}

            {options.length === 0 && (
              <li className="px-2.5 py-3 text-center text-[12.5px] text-faint">Sin opciones</li>
            )}
          </ul>,
          document.body,
        )}
    </div>
  );
}
