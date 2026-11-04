import { Check, Search, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/** Altura aproximada de una tarjeta + separación (py-2.5, icono, gap-2). */
const TILE_ROW_PX = 62;
const TILE_GAP_PX = 8;

export interface ChoiceTileOption {
  value: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  /** Texto corto bajo el icono (p. ej. país). */
  meta?: string;
}

interface ChoiceTileGroupProps {
  legend: ReactNode;
  required?: boolean;
  options: ChoiceTileOption[];
  value: string[];
  onChange: (next: string[]) => void;
  onBlur?: () => void;
  error?: string;
  loading?: boolean;
  loadingLabel?: string;
  emptyLabel?: string;
  /** Resumen encima del grid cuando hay selección. */
  selectionNoun?: { one: string; other: string };
  columns?: "auto" | 1 | 2 | 3;
  /** Buscador a la derecha del título; filtra por etiqueta, meta y descripción. */
  searchPlaceholder?: string;
  /** Reserva el mismo hueco del buscador (para emparejar con otro selector). */
  reserveSearchSlot?: boolean;
  /** Altura fija del listado en filas visibles; scroll oculto si hay más. */
  listViewportItems?: number;
  emptySearchLabel?: string;
}

const columnClass = (columns: ChoiceTileGroupProps["columns"]) => {
  switch (columns) {
    case 1:
      return "grid-cols-1";
    case 2:
      return "grid-cols-1 sm:grid-cols-2";
    case 3:
      return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
    default:
      return "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3";
  }
};

/**
 * Selección múltiple como tarjetas: área de click amplia, estado seleccionado
 * evidente y checkbox nativo oculto para teclado y lectores de pantalla.
 */
export function ChoiceTileGroup({
  legend,
  required,
  options,
  value,
  onChange,
  onBlur,
  error,
  loading,
  loadingLabel = "Cargando…",
  emptyLabel,
  selectionNoun,
  columns = "auto",
  searchPlaceholder,
  reserveSearchSlot,
  listViewportItems,
  emptySearchLabel = "Ninguna opción coincide con la búsqueda.",
}: ChoiceTileGroupProps) {
  const hasError = Boolean(error);
  const selectedCount = value.length;
  const [search, setSearch] = useState("");
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const visibleOptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options;
    return options.filter((option) => {
      const selected = value.includes(option.value);
      if (selected) return true;
      const haystack = [option.label, option.meta, option.description].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(term);
    });
  }, [options, search, value]);

  const listViewportHeight =
    listViewportItems !== undefined && listViewportItems > 0
      ? listViewportItems * TILE_ROW_PX + Math.max(0, listViewportItems - 1) * TILE_GAP_PX
      : undefined;

  const showSearchControl =
    Boolean(searchPlaceholder) && !loading && options.length > 3;
  const reserveRightSlot =
    showSearchControl || Boolean(reserveSearchSlot) || Boolean(searchPlaceholder);

  useEffect(() => {
    if (!searchExpanded) return;
    searchInputRef.current?.focus();
  }, [searchExpanded]);

  useEffect(() => {
    if (!searchExpanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSearchExpanded(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [searchExpanded]);

  function toggle(optionValue: string) {
    const checked = value.includes(optionValue);
    onChange(checked ? value.filter((v) => v !== optionValue) : [...value, optionValue]);
  }

  const selectionHint =
    selectionNoun && selectedCount > 0
      ? selectedCount === 1
        ? `1 ${selectionNoun.one} seleccionada`
        : `${selectedCount} ${selectionNoun.other} seleccionadas`
      : null;

  const tileGrid = (
    <div className={`grid gap-2 ${columnClass(columns)}`} role="group" aria-invalid={hasError || undefined}>
      {visibleOptions.map((option) => {
            const checked = value.includes(option.value);
            const Icon = option.icon;
            return (
              <label
                key={option.value}
                className={`group/tile relative flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-left shadow-[0_1px_0_rgba(0,0,0,0.02)]
                  transition-[border-color,background-color,box-shadow,transform] duration-150 ease-out
                  outline-none active:scale-[0.995]
                  has-disabled:cursor-not-allowed has-disabled:opacity-55
                  ${
                    checked
                      ? "border-brand-red/40 bg-white hover:border-brand-red/55 hover:bg-zinc-50/80"
                      : "border-line bg-white/80 hover:border-zinc-300 hover:bg-white hover:shadow-sm"
                  }`}
              >
                <input
                  type="checkbox"
                  className="peer sr-only focus:outline-none"
                  checked={checked}
                  onBlur={onBlur}
                  onChange={() => toggle(option.value)}
                />
                {Icon && (
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors duration-150
                      ${
                        checked
                          ? "border-brand-red/25 bg-brand-red/[0.08] text-brand-red group-hover/tile:bg-brand-red/[0.11]"
                          : "border-line/90 bg-zinc-50 text-zinc-500 group-hover/tile:border-zinc-300 group-hover/tile:bg-zinc-100/80 group-hover/tile:text-zinc-600"
                      }`}
                    aria-hidden
                  >
                    <Icon className="h-[18px] w-[18px] stroke-[1.75]" />
                  </span>
                )}
                <span className="min-w-0 flex-1 pt-0.5">
                  <span className="block text-[13px] font-semibold leading-snug text-ink">{option.label}</span>
                  {(option.description || option.meta) && (
                    <span className="mt-0.5 block text-[11.5px] leading-relaxed text-faint">
                      {[option.description, option.meta].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-150
                    ${
                      checked
                        ? "scale-100 border-brand-red bg-brand-red text-white opacity-100"
                        : "scale-90 border-line-strong bg-white text-transparent opacity-80 group-hover/tile:border-zinc-400"
                    }`}
                  aria-hidden
                >
                  <Check className="h-3 w-3 stroke-[3]" />
                </span>
              </label>
            );
      })}
    </div>
  );

  const listBody =
    loading ? (
      <p className="py-2 text-[12.5px] text-faint">{loadingLabel}</p>
    ) : options.length === 0 ? (
      emptyLabel ? <p className="text-[12.5px] leading-relaxed text-warn">{emptyLabel}</p> : null
    ) : visibleOptions.length === 0 ? (
      <p className="py-2 text-[12.5px] text-faint">{emptySearchLabel}</p>
    ) : listViewportHeight !== undefined ? (
      <div
        className="no-scrollbar min-h-0 overflow-y-auto overscroll-contain"
        style={{ height: listViewportHeight }}
      >
        {tileGrid}
      </div>
    ) : (
      tileGrid
    );

  return (
    <fieldset
      className={`flex h-full min-h-0 w-full min-w-0 flex-col rounded-xl border bg-canvas/40 p-3 transition-colors sm:p-3.5 ${
        hasError ? "border-brand-red/45 bg-brand-red/[0.02]" : "border-line/80"
      }`}
    >
      <div className="relative mb-2.5 h-8 shrink-0 min-w-0">
        {searchExpanded && showSearchControl ? (
          <div
            key="search-expanded"
            className="absolute inset-0 z-10 flex items-center gap-1.5 rounded-lg bg-white/95 pr-0.5 shadow-[0_0_0_1px_rgba(0,0,0,0.04)] backdrop-blur-sm animate-plf-side-panel-in"
          >
            <div className="relative min-w-0 flex-1">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
              />
              <input
                ref={searchInputRef}
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="h-8 w-full rounded-lg border border-zinc-200 bg-white pl-8 pr-2 text-[12.5px] text-zinc-800
                  placeholder:text-zinc-400 shadow-2xs outline-none transition-colors
                  focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20 [&::-webkit-search-cancel-button]:hidden"
              />
            </div>
            <button
              type="button"
              aria-label="Cerrar búsqueda"
              onClick={() => setSearchExpanded(false)}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200/90 bg-white text-zinc-500 shadow-2xs transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-800"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div key="search-collapsed" className="flex h-8 min-w-0 items-center justify-between gap-2 animate-plf-header-fade">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <legend className="shrink-0 whitespace-nowrap font-heading text-[10.5px] font-semibold uppercase tracking-[0.06em] text-faint">
                {legend}
                {required && <span className="text-brand-red"> *</span>}
              </legend>
              {selectionHint && (
                <span className="truncate text-[11px] font-medium tabular-nums text-brand-red/90">{selectionHint}</span>
              )}
            </div>
            <div className="flex shrink-0 items-center">
              {showSearchControl ? (
                <button
                  type="button"
                  aria-label="Buscar plantas"
                  aria-expanded={searchExpanded}
                  onClick={() => setSearchExpanded(true)}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border bg-white text-zinc-500 shadow-2xs transition-all
                    hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-800
                    ${search.trim() ? "border-brand-red/35 text-brand-red ring-1 ring-brand-red/15" : "border-zinc-200/90"}`}
                >
                  <Search className="h-3.5 w-3.5" />
                </button>
              ) : reserveRightSlot ? (
                <span className="inline-block h-8 w-8 shrink-0" aria-hidden />
              ) : null}
            </div>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1">{listBody}</div>

      {error && <p className="mt-2 shrink-0 text-[12px] font-medium text-brand-red">{error}</p>}
    </fieldset>
  );
}
