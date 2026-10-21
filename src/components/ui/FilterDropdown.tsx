import { Calendar, Check, ChevronDown, Search, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useDisclosureMotion } from "../../hooks/useDisclosureMotion";
import type { LookupOption, LookupResult } from "./LookupSelect";

export interface FilterOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

interface FilterDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  title?: string;
  defaultIcon?: ReactNode;
  "aria-label"?: string;
  className?: string;
}

interface Anchor {
  top: number;
  left: number;
  width: number;
  originX: number;
}

const PANEL_MIN_WIDTH = 210;
const VIEWPORT_GUTTER = 12;

const triggerClasses = (isOpen: boolean) =>
  `group inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-medium shadow-2xs outline-none transition-colors duration-150 cursor-pointer select-none ${
    isOpen
      ? "border-zinc-300 bg-zinc-50/80 text-zinc-900"
      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
  }`;

const panelClasses = (exiting: boolean) =>
  `z-[85] flex flex-col gap-0.5 rounded-lg border border-zinc-200/90
  bg-white/95 backdrop-blur-xs p-1 shadow-[0_10px_28px_-6px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.04)] ${
    exiting ? "pointer-events-none" : ""
  }`;

// Menú desplegable flotante con iconos y animación suave para filtros de barra de herramientas.
export function FilterDropdown({
  value,
  onChange,
  options,
  title,
  defaultIcon,
  "aria-label": ariaLabel,
  className = "",
}: FilterDropdownProps) {
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

  const closeDropdown = useCallback(
    (immediate = false) => {
      setIsOpen(false);
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
            <div className="max-h-[280px] overflow-y-auto flex flex-col gap-0.5">
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
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export interface LookupFilterDropdownProps {
  value: string;
  onChange: (value: string) => void;
  search: (term: string) => Promise<LookupResult>;
  selectedLabel?: string | null;
  resolveSelectedLabel?: (value: string) => Promise<string | null>;
  placeholder: string;
  searchPlaceholder?: string;
  title?: string;
  defaultIcon?: ReactNode;
  "aria-label"?: string;
  className?: string;
}

/**
 * Filtro desplegable con búsqueda asíncrona en servidor (clientes, vendedores, responsables, productos)
 * con la misma estética de botón compacto que `FilterDropdown`.
 */
export function LookupFilterDropdown({
  value,
  onChange,
  search,
  selectedLabel,
  resolveSelectedLabel,
  placeholder,
  searchPlaceholder = "Escribe para buscar…",
  title,
  defaultIcon,
  "aria-label": ariaLabel,
  className = "",
}: LookupFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [term, setTerm] = useState("");
  const [result, setResult] = useState<LookupResult>({ options: [], hasMore: false });
  const [isLoading, setIsLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<LookupOption | null>(null);
  const [resolved, setResolved] = useState<Record<string, string>>({});

  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelId = useId();
  const { mounted, exiting, ref: panelRef, snap } = useDisclosureMotion<HTMLDivElement>(isOpen);
  const debouncedTerm = useDebouncedValue(term).trim();

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
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, selectedLabel, resolveSelectedLabel]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setIsLoading(true);
    setFailed(false);

    search(debouncedTerm)
      .then((next) => {
        if (cancelled) return;
        setResult(next);
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
  }, [isOpen, debouncedTerm]);

  function openDropdown() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const width = Math.max(rect.width, 250);
    const left = Math.max(
      VIEWPORT_GUTTER,
      Math.min(rect.left, window.innerWidth - width - VIEWPORT_GUTTER),
    );

    setAnchor({ top: rect.bottom + 6, left, width, originX: rect.left + rect.width / 2 - left });
    setTerm("");
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
      if (event.key === "Escape") {
        event.stopPropagation();
        closeDropdown();
        triggerRef.current?.focus();
      }
    }

    function handleViewportChange(event: Event) {
      const target = event.target;
      if (target instanceof Node && panelRef.current?.contains(target)) return;
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

  const displayLabel = currentLabel ?? placeholder;

  return (
    <div className={`relative shrink-0 ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (isOpen ? closeDropdown() : openDropdown())}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={mounted ? panelId : undefined}
        aria-label={ariaLabel ?? displayLabel}
        data-open={isOpen}
        className={triggerClasses(isOpen)}
      >
        <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-zinc-500 group-hover:text-zinc-800">
          {defaultIcon}
        </span>
        <span className="max-w-[220px] truncate whitespace-nowrap">{displayLabel}</span>
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
            aria-label={ariaLabel ?? title ?? placeholder}
            aria-hidden={exiting}
            style={{
              position: "fixed",
              top: anchor.top,
              left: anchor.left,
              width: anchor.width,
              transformOrigin: `${anchor.originX}px top`,
            }}
            className={panelClasses(exiting)}
          >
            {title && (
              <div
                data-motion-item
                className="select-none px-2.5 pt-1.5 pb-0.5 text-[11px] font-medium text-zinc-400"
              >
                {title}
              </div>
            )}

            <div className="relative border-b border-zinc-100 p-1">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
              />
              <input
                ref={inputRef}
                type="text"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="h-7 w-full rounded-md border border-transparent bg-zinc-50/80 pl-7 pr-2 text-[12.5px] text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-zinc-200 focus:bg-white"
              />
            </div>

            <div className="max-h-[230px] overflow-y-auto flex flex-col gap-0.5 pt-0.5">
              <button
                type="button"
                role="option"
                aria-selected={value === ""}
                onClick={() => {
                  setPicked(null);
                  onChange("");
                  closeDropdown();
                  triggerRef.current?.focus();
                }}
                className={`group flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[12.5px]
                  transition-colors duration-100 ease-out cursor-pointer select-none ${
                    value === ""
                      ? "bg-zinc-100 font-semibold text-zinc-900"
                      : "font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
                  }`}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center text-zinc-500 group-hover:text-zinc-900">
                  {defaultIcon}
                </span>
                <span className="flex-1 truncate">{placeholder}</span>
                {value === "" && (
                  <Check aria-hidden className="h-3.5 w-3.5 shrink-0 text-brand-red" />
                )}
              </button>

              {result.options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      setPicked(option);
                      onChange(option.value);
                      closeDropdown();
                      triggerRef.current?.focus();
                    }}
                    className={`group flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[12.5px]
                      transition-colors duration-100 ease-out cursor-pointer select-none ${
                        isSelected
                          ? "bg-zinc-100 font-semibold text-zinc-900"
                          : "font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
                      }`}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{option.label}</span>
                      {option.hint && (
                        <span className="truncate text-[11px] font-normal text-zinc-400">
                          {option.hint}
                        </span>
                      )}
                    </span>
                    {isSelected && (
                      <Check aria-hidden className="h-3.5 w-3.5 shrink-0 text-brand-red" />
                    )}
                  </button>
                );
              })}
            </div>

            {(failed || isLoading || result.options.length === 0 || result.hasMore) && (
              <div className="border-t border-zinc-100 px-2.5 py-1.5 text-[11px] text-zinc-400">
                {failed
                  ? "No se pudo buscar. Intenta de nuevo."
                  : isLoading
                    ? "Buscando…"
                    : result.options.length === 0
                      ? "Ningún resultado coincide."
                      : "Sigue escribiendo para acotar resultados."}
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-DO", { day: "numeric", month: "short" }).replace(".", "");
}

export interface DateRangeFilterDropdownProps {
  from: string;
  to: string;
  onFromChange: (from: string) => void;
  onToChange: (to: string) => void;
  placeholder?: string;
  title?: string;
  "aria-label"?: string;
  className?: string;
}

/**
 * Filtro desplegable de rango de fechas (`Desde` – `Hasta`) con la misma estética que `FilterDropdown`.
 */
export function DateRangeFilterDropdown({
  from,
  to,
  onFromChange,
  onToChange,
  placeholder = "Todas las fechas",
  title = "Filtrar por fecha",
  "aria-label": ariaLabel,
  className = "",
}: DateRangeFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const { mounted, exiting, ref: panelRef, snap } = useDisclosureMotion<HTMLDivElement>(isOpen);

  const displayLabel =
    from && to
      ? `${formatShortDate(from)} – ${formatShortDate(to)}`
      : from
        ? `Desde ${formatShortDate(from)}`
        : to
          ? `Hasta ${formatShortDate(to)}`
          : placeholder;

  function openDropdown() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const width = 240;
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
          <Calendar className="h-3.5 w-3.5" />
        </span>
        <span className="max-w-[220px] truncate whitespace-nowrap">{displayLabel}</span>
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
            aria-label={ariaLabel ?? title}
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
            <div className="select-none text-[11px] font-medium text-zinc-400">{title}</div>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-zinc-600">Desde</span>
              <input
                type="date"
                value={from}
                onChange={(event) => onFromChange(event.target.value)}
                className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-[12.5px] text-zinc-800 outline-none focus:border-zinc-400"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-zinc-600">Hasta</span>
              <input
                type="date"
                value={to}
                onChange={(event) => onToChange(event.target.value)}
                className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-[12.5px] text-zinc-800 outline-none focus:border-zinc-400"
              />
            </label>
            {(from || to) && (
              <button
                type="button"
                onClick={() => {
                  onFromChange("");
                  onToChange("");
                  closeDropdown();
                  triggerRef.current?.focus();
                }}
                className="mt-0.5 inline-flex h-7 w-full items-center justify-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 text-[12px] font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 cursor-pointer"
              >
                <X className="h-3 w-3" />
                <span>Limpiar fechas</span>
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

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

/** Botón compacto de barra de herramientas para limpiar búsqueda y filtros activos. */
export function ClearFiltersButton({
  onClick,
  title = "Limpiar filtros",
}: {
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-[12.5px] font-medium text-zinc-600 shadow-2xs hover:bg-zinc-50 hover:border-zinc-300 transition-all cursor-pointer active:scale-[0.98]"
    >
      <X className="h-3.5 w-3.5 text-zinc-400" />
      <span>Limpiar</span>
    </button>
  );
}
