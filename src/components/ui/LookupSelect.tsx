import { Check, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
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
  /** Productos del ticket: abre el panel con pestañas ticket / catálogo completo. */
  recommendedOptions?: LookupOption[];
  size?: ControlSize;
  state?: FieldState;
  disabled?: boolean;
  id?: string;
  className?: string;
  /** Elemento o botón de acción integrado a la derecha dentro del control */
  rightAction?: ReactNode;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

const PANEL_MAX_HEIGHT = 300;
const LIST_MAX_HEIGHT = 232;

function filterOptions(options: LookupOption[], term: string): LookupOption[] {
  const q = term.trim().toLowerCase();
  if (!q) return options;
  return options.filter(
    (o) =>
      o.label.toLowerCase().includes(q) ||
      (o.hint !== undefined && o.hint.toLowerCase().includes(q)),
  );
}

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
  recommendedOptions,
  size = "md",
  state = "idle",
  disabled,
  id,
  className = "",
  rightAction,
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
  const [sourceTab, setSourceTab] = useState<"ticket" | "all">("ticket");
  const [anchor, setAnchor] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
  } | null>(null);

  const [result, setResult] = useState<LookupResult>({ options: [], hasMore: false });
  const [isLoading, setIsLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const [picked, setPicked] = useState<LookupOption | null>(null);
  const [resolved, setResolved] = useState<Record<string, string>>({});

  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const debouncedTerm = useDebouncedValue(term).trim();
  const recommended = recommendedOptions ?? [];
  const ticketTabEnabled = recommended.length > 0;
  const ticketTabLabel =
    recommended.length === 1 ? "Producto del ticket" : "Productos del ticket";

  const ticketOptions = useMemo(
    () => filterOptions(recommended, debouncedTerm),
    [recommended, debouncedTerm],
  );

  const onTicketTab = ticketTabEnabled && sourceTab === "ticket";
  const options = onTicketTab ? ticketOptions : result.options;

  const currentLabel =
    value === ""
      ? null
      : (selectedLabel ??
        (picked?.value === value ? picked.label : null) ??
        resolved[value] ??
        null);

  useEffect(() => {
    if (value === "" || !resolveSelectedLabel) return;
    if (selectedLabel != null || picked?.value === value || resolved[value] !== undefined) return;

    let cancelled = false;
    resolveSelectedLabel(value)
      .then((label) => {
        if (cancelled || label === null) return;
        setResolved((current) => ({ ...current, [value]: label }));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, selectedLabel, resolveSelectedLabel]);

  useEffect(() => {
    if (!open) return;
    if (onTicketTab) {
      setIsLoading(false);
      setFailed(false);
      setActiveIndex(ticketOptions.length > 0 ? 0 : -1);
      return;
    }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, debouncedTerm, sourceTab, ticketTabEnabled]);

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
    setSourceTab(ticketTabEnabled ? "ticket" : "all");
    setActiveIndex(-1);
    setOpen(true);
  }

  function closeList() {
    setOpen(false);
    onBlur?.();
  }

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

  const status = failed
    ? "No se pudo buscar. Escribe de nuevo para reintentar."
    : isLoading
      ? "Buscando…"
      : options.length === 0
        ? debouncedTerm === ""
          ? onTicketTab
            ? null
            : "Escribe para buscar."
          : onTicketTab
            ? "Ningún producto del ticket coincide."
            : "Ningún resultado coincide."
        : !onTicketTab && result.hasMore
          ? "Hay más coincidencias. Seguí escribiendo para acotar la búsqueda."
          : null;

  const panelSurface = ticketTabEnabled
    ? "animate-plf-popover-in z-[60] rounded-edge border border-line bg-white"
    : "animate-plf-popover-in z-[60] rounded-edge border border-line bg-white shadow-panel";

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
          flex items-center justify-between gap-2 pl-3 ${rightAction ? "pr-8" : "pr-2.5"} font-medium
          transition-[box-shadow,border-color,transform] duration-200 ease-out
          focus-visible:ring-3 focus-visible:ring-brand-red/25
          ${open ? "ring-3 ring-brand-red/15 border-line-strong" : ""}
          ${currentLabel !== null ? "text-ink" : "text-faint"}`}
      >
        <span className="truncate">{currentLabel ?? (value === "" ? placeholder : value)}</span>
        <ChevronDown
          aria-hidden
          className={`h-4 w-4 shrink-0 text-faint transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {rightAction && (
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 z-10 flex items-center">
          {rightAction}
        </div>
      )}

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
            className={panelSurface}
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

            {ticketTabEnabled && (
              <div
                className="flex gap-0.5 border-b border-line bg-zinc-50/80 p-1"
                role="tablist"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={sourceTab === "ticket"}
                  onClick={() => {
                    setSourceTab("ticket");
                    setActiveIndex(ticketOptions.length > 0 ? 0 : -1);
                  }}
                  className={`flex-1 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors duration-200 cursor-pointer ${
                    sourceTab === "ticket"
                      ? "bg-zinc-100 text-ink"
                      : "text-faint hover:bg-zinc-100/60 hover:text-brand-gray"
                  }`}
                >
                  {ticketTabLabel}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={sourceTab === "all"}
                  onClick={() => {
                    setSourceTab("all");
                    setActiveIndex(result.options.length > 0 ? 0 : -1);
                  }}
                  className={`flex-1 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors duration-200 cursor-pointer ${
                    sourceTab === "all"
                      ? "bg-zinc-100 text-ink"
                      : "text-faint hover:bg-zinc-100/60 hover:text-brand-gray"
                  }`}
                >
                  Todos los productos
                </button>
              </div>
            )}

            <ul
              key={ticketTabEnabled ? sourceTab : "catalog"}
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={ariaLabel}
              style={{ maxHeight: LIST_MAX_HEIGHT }}
              className={`overflow-y-auto p-1 ${ticketTabEnabled ? "animate-plf-apple-tab" : ""}`}
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
                    key={`${option.value}-${index}`}
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
