import { Check, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import {
  controlBase,
  controlSizes,
  stateClasses,
  type ControlSize,
  type FieldState,
} from "./fieldStyles";

export interface LookupOption {
  value: string;
  label: string;
  /** Segunda linea de la opcion: codigo, correo, territorio… */
  hint?: string;
}

/** Lo que devuelve una busqueda contra el servidor. */
export interface LookupResult {
  options: LookupOption[];
  /**
   * El servidor tiene mas coincidencias de las que caben en esta consulta. Se
   * dice en la lista: una lista corta que aparenta ser completa es justo el
   * fallo que este control existe para no repetir.
   */
  hasMore: boolean;
}

export interface LookupSelectProps {
  value: string;
  onChange: (value: string, option: LookupOption | null) => void;
  /** Se avisa al cerrar el panel, como en `Select`: react-hook-form lo necesita. */
  onBlur?: () => void;
  /** Consulta al servidor. `term` ya viene con retardo y recortado. */
  search: (term: string) => Promise<LookupResult>;
  /**
   * Etiqueta del valor ya elegido. Con paginacion en servidor lo seleccionado
   * casi nunca esta en la pagina de resultados, asi que sin esto un cliente ya
   * guardado se pintaba como si no hubiera nada elegido.
   */
  selectedLabel?: string | null;
  /**
   * Alternativa a `selectedLabel` cuando quien llama solo tiene el id: se
   * resuelve una vez por valor. Si falla, el control se queda con el id crudo
   * en vez de fingir que no hay nada seleccionado.
   */
  resolveSelectedLabel?: (value: string) => Promise<string | null>;
  placeholder?: string;
  searchPlaceholder?: string;
  /** Texto de la opcion que vacia la seleccion. Sin esto no se ofrece. */
  clearLabel?: string;
  size?: ControlSize;
  state?: FieldState;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

const PANEL_MAX_HEIGHT = 300;
const LIST_MAX_HEIGHT = 232;

/**
 * Desplegable de busqueda para catalogos que no tienen tope: clientes y
 * personal. Un `Select` normal necesita el catalogo entero en memoria, y esos
 * dos crecen sin limite: la version anterior pedia las primeras cien filas y a
 * partir de ahi el registro simplemente no existia para quien buscaba.
 *
 * Misma gramatica visual que `Select` --disparador identico, panel en portal,
 * radio de 2 px, foco en rojo 185 C-- con un campo de texto arriba que consulta
 * al SERVIDOR con retardo. La lista dice siempre en que estado esta: cargando,
 * vacia, o incompleta con la invitacion a seguir escribiendo.
 */
export function LookupSelect({
  value,
  onChange,
  onBlur,
  search,
  selectedLabel,
  resolveSelectedLabel,
  placeholder = "Selecciona una opción",
  searchPlaceholder = "Escribe para buscar…",
  clearLabel,
  size = "md",
  state = "idle",
  disabled,
  id,
  className = "",
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: LookupSelectProps) {
  const generated = useId();
  const listId = `${id ?? generated}-listbox`;
  const statusId = `${id ?? generated}-status`;

  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [anchor, setAnchor] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
  } | null>(null);

  const [result, setResult] = useState<LookupResult>({ options: [], hasMore: false });
  const [isLoading, setIsLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  /**
   * Etiqueta de lo que se eligio en esta sesion del control. Se recuerda para
   * que cerrar el panel --lo que descarta los resultados-- no borre el nombre
   * de lo que se acaba de elegir.
   */
  const [picked, setPicked] = useState<LookupOption | null>(null);
  /** Etiqueta traida por `resolveSelectedLabel`, por valor. */
  const [resolved, setResolved] = useState<Record<string, string>>({});

  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const debouncedTerm = useDebouncedValue(term).trim();

  // El nombre de lo elegido, por orden de fiabilidad: lo que quien llama sabe,
  // lo que se acaba de elegir, lo que se resolvio por id.
  const currentLabel =
    value === ""
      ? null
      : (selectedLabel ??
        (picked?.value === value ? picked.label : null) ??
        resolved[value] ??
        null);

  // Resolucion perezosa del valor inicial: solo cuando nadie dio la etiqueta.
  useEffect(() => {
    if (value === "" || !resolveSelectedLabel) return;
    if (selectedLabel != null || picked?.value === value || resolved[value] !== undefined) return;

    let cancelled = false;
    resolveSelectedLabel(value)
      .then((label) => {
        if (cancelled || label === null) return;
        setResolved((current) => ({ ...current, [value]: label }));
      })
      .catch(() => {
        // Sin nombre se muestra el id: decir «sin selección» seria falso.
      });

    return () => {
      cancelled = true;
    };
    // `picked`/`resolved` se leen dentro de la guarda; reejecutar por ellos
    // volveria a pedir lo que se acaba de resolver.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, selectedLabel, resolveSelectedLabel]);

  // La consulta solo vive mientras el panel esta abierto: cerrado no hay lista
  // que llenar y cada pulsacion seria una peticion tirada a la basura.
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setIsLoading(true);
    setFailed(false);

    search(debouncedTerm)
      .then((next) => {
        if (cancelled) return;
        setResult(next);
        setActiveIndex(next.options.length > 0 ? 0 : -1);
      })
      .catch(() => {
        if (cancelled) return;
        setResult({ options: [], hasMore: false });
        setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // `search` se recrea en cada render de quien llama; depender de ella
    // dispararia una consulta por render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, debouncedTerm]);

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
    setTerm("");
    setActiveIndex(-1);
    setOpen(true);
  }

  function closeList() {
    setOpen(false);
    onBlur?.();
  }

  const options = result.options;

  function commit(index: number) {
    const option = options[index];
    if (!option) return;
    setPicked(option);
    onChange(option.value, option);
    closeList();
    triggerRef.current?.focus();
  }

  function clear() {
    setPicked(null);
    onChange("", null);
    closeList();
    triggerRef.current?.focus();
  }

  // El foco entra al campo de texto en cuanto abre: el proposito del control es
  // escribir, y obligar a un Tab extra lo convertiria en un desplegable normal.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
      onBlur?.();
    }

    // Igual que en Select: el scroll de la pagina cierra, pero el del propio
    // panel no --si no, la lista se cerraba sola al llevar la opcion a la vista.
    function handleViewportChange(event: Event) {
      const target = event.target;
      if (target instanceof Node && panelRef.current?.contains(target)) return;
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

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current?.children[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function move(from: number, step: number) {
    if (options.length === 0) return -1;
    const next = from + step;
    if (next < 0) return 0;
    if (next >= options.length) return options.length - 1;
    return next;
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
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
        setActiveIndex(options.length > 0 ? 0 : -1);
        return;
      case "End":
        event.preventDefault();
        setActiveIndex(options.length - 1);
        return;
      case "Enter":
        event.preventDefault();
        commit(activeIndex);
        return;
      case "Escape":
        event.preventDefault();
        // Sin detenerlo, el mismo Escape llega al listener de Modal y descarta
        // el formulario entero en vez de cerrar solo la lista.
        event.stopPropagation();
        closeList();
        triggerRef.current?.focus();
        return;
      case "Tab":
        closeList();
        return;
      default:
        break;
    }
  }

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled || open) return;
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      openList();
    }
  }

  const resolvedState: FieldState = state;

  /** Un unico renglon de estado bajo la lista; nunca hay dos verdades a la vez. */
  const status = failed
    ? "No se pudo buscar. Escribe de nuevo para reintentar."
    : isLoading
      ? "Buscando…"
      : options.length === 0
        ? debouncedTerm === ""
          ? "Escribe para buscar."
          : "Ningún resultado coincide."
        : result.hasMore
          ? "Hay más coincidencias. Seguí escribiendo para acotar la búsqueda."
          : null;

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
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid ?? resolvedState === "error"}
        disabled={disabled}
        onClick={() => (open ? closeList() : openList())}
        onKeyDown={handleTriggerKeyDown}
        className={`${controlBase} ${stateClasses[resolvedState]} ${controlSizes[size]}
          flex items-center justify-between gap-2 pl-3 pr-2.5 font-medium
          focus-visible:ring-3 focus-visible:ring-brand-red/25
          ${currentLabel !== null ? "text-ink" : "text-faint"}`}
      >
        <span className="truncate">{currentLabel ?? (value === "" ? placeholder : value)}</span>
        <ChevronDown
          aria-hidden
          className={`h-4 w-4 shrink-0 text-faint transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open &&
        anchor &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              left: anchor.left,
              top: anchor.top,
              bottom: anchor.bottom,
              width: anchor.width,
            }}
            className="animate-plf-toast-in z-[60] rounded-edge border border-line bg-white shadow-panel"
          >
            <div className="relative border-b border-line p-1.5">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint"
              />
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-expanded
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
                aria-label={ariaLabel ?? searchPlaceholder}
                aria-describedby={statusId}
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder={searchPlaceholder}
                className="h-8 w-full rounded-edge border border-transparent bg-transparent pl-7 pr-2
                  text-[13px] text-ink outline-none placeholder:text-faint
                  focus:border-line-strong"
              />
            </div>

            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={ariaLabel}
              style={{ maxHeight: LIST_MAX_HEIGHT }}
              className="overflow-y-auto p-1"
            >
              {clearLabel !== undefined && value !== "" && (
                <li
                  role="option"
                  aria-selected={false}
                  onClick={clear}
                  className="flex cursor-pointer items-center gap-2 rounded-edge px-2.5 py-2 text-[13px]
                    text-brand-gray transition-colors hover:bg-fill"
                >
                  <X aria-hidden className="h-3.5 w-3.5 shrink-0 text-faint" />
                  <span className="truncate">{clearLabel}</span>
                </li>
              )}

              {options.map((option, index) => {
                const isSelected = option.value === value;
                const isActive = index === activeIndex;

                return (
                  <li
                    key={option.value}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => commit(index)}
                    className={`flex cursor-pointer items-center justify-between gap-2 rounded-edge px-2.5 py-2
                      text-[13px] transition-colors
                      ${isActive ? "bg-fill text-ink" : "text-brand-gray"}
                      ${isSelected ? "font-semibold text-ink" : ""}`}
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate leading-tight">{option.label}</span>
                      {option.hint !== undefined && (
                        <span className="truncate text-[11px] leading-tight text-faint">
                          {option.hint}
                        </span>
                      )}
                    </span>
                    {isSelected && <Check aria-hidden className="h-4 w-4 shrink-0 text-brand-red" />}
                  </li>
                );
              })}
            </ul>

            {status !== null && (
              <p
                id={statusId}
                role="status"
                className={`border-t border-line px-2.5 py-2 text-[12px] leading-snug ${
                  failed ? "text-brand-red-dark" : "text-faint"
                }`}
              >
                {status}
              </p>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
