import { Check, Plus, Search, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDisclosureMotion } from "../../hooks/useDisclosureMotion";
import { searchProducts } from "../../lib/lookups";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import type { LookupOption } from "../ui/LookupSelect";
import { controlBase, controlSizes } from "../ui/fieldStyles";
import { Spinner } from "../ui/Spinner";
import type { TicketProductDraft } from "./TicketProductsField";

const LIST_MAX = 260;
const PANEL_MAX_HEIGHT = 320;

interface PanelAnchor {
  left: number;
  top?: number;
  bottom?: number;
  width: number;
  originX: number;
}

export interface ProductAddSearchProps {
  id?: string;
  label?: string;
  disabled?: boolean;
  selectedProducts?: TicketProductDraft[];
  excludeProductIds?: number[];
  onPick: (option: LookupOption) => void;
  onRemove?: (productId: number) => void;
  onDuplicate?: () => void;
}

/**
 * Buscador de catálogo para agregar productos a un ticket.
 * Lista en portal anclada al campo; marca los ya agregados sin cambiar de vista.
 */
export function ProductAddSearch({
  id,
  label,
  disabled,
  selectedProducts = [],
  excludeProductIds = [],
  onPick,
  onRemove,
  onDuplicate,
}: ProductAddSearchProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  const listId = `${fieldId}-listbox`;
  const statusId = `${fieldId}-status`;

  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);

  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [options, setOptions] = useState<LookupOption[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [anchor, setAnchor] = useState<PanelAnchor | null>(null);

  const dropUp = anchor?.bottom !== undefined;
  const { mounted, exiting, ref: containerRef, snap } = useDisclosureMotion<HTMLDivElement>(
    open,
    { direction: dropUp ? "up" : "down" },
  );

  const debouncedTerm = useDebouncedValue(term).trim();

  const selectedIds = new Set<number>(
    selectedProducts.length > 0
      ? selectedProducts.map((p) => p.productId)
      : excludeProductIds,
  );

  const selectedCount = selectedProducts.length;

  function measure() {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;

    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const opensUp = spaceBelow < PANEL_MAX_HEIGHT && spaceAbove > spaceBelow;

    const width = Math.min(Math.max(rect.width, 320), window.innerWidth - 32);
    const left = Math.min(
      Math.max(16, rect.left),
      window.innerWidth - width - 16,
    );

    setAnchor({
      left,
      width,
      originX: rect.left + rect.width / 2 - left,
      top: opensUp ? undefined : rect.bottom + 4,
      bottom: opensUp ? viewportHeight - rect.top + 4 : undefined,
    });
  }

  function openPanel() {
    if (disabled) return;
    measure();
    setOpen(true);
  }

  const closePanel = useCallback(
    (immediate = false) => {
      if (!open) return;
      setOpen(false);
      setActiveIndex(-1);
      if (immediate) snap();
    },
    [open, snap],
  );

  function clearSearch() {
    setTerm("");
    inputRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setIsLoading(true);
    setFailed(false);

    searchProducts(debouncedTerm)
      .then(({ options: raw, hasMore: more }) => {
        if (cancelled) return;
        setOptions(raw);
        setHasMore(more);
        setActiveIndex(raw.length > 0 ? 0 : -1);
      })
      .catch(() => {
        if (cancelled) return;
        setOptions([]);
        setHasMore(false);
        setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, debouncedTerm]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        anchorRef.current?.contains(target) ||
        containerRef.current?.contains(target)
      ) {
        return;
      }
      closePanel();
    }

    function onViewportChange(event: Event) {
      const target = event.target;
      if (target instanceof Node && containerRef.current?.contains(target)) {
        return;
      }
      if (event.type === "resize") {
        measure();
        return;
      }
      closePanel(true);
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onViewportChange, true);
      window.removeEventListener("resize", onViewportChange);
    };
  }, [open, closePanel, containerRef]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    panelRef.current?.children[activeIndex]?.scrollIntoView({
      block: "nearest",
    });
  }, [open, activeIndex]);

  function handleToggleProduct(option: LookupOption) {
    const numericId = Number(option.value);
    const isAlreadySelected = selectedIds.has(numericId);

    if (isAlreadySelected) {
      if (onRemove) {
        onRemove(numericId);
      } else {
        onDuplicate?.();
      }
    } else {
      onPick(option);
    }

    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }

  function move(from: number, step: number) {
    if (options.length === 0) return -1;
    const next = from + step;
    if (next < 0) return 0;
    if (next >= options.length) return options.length - 1;
    return next;
  }

  const status = failed
    ? "No se pudo buscar en el catálogo. Intenta de nuevo."
    : isLoading
      ? "Buscando productos…"
      : options.length === 0
        ? debouncedTerm === ""
          ? "Escribe para buscar o elige de la lista."
          : "Sin coincidencias en el catálogo."
        : hasMore
          ? "Hay más resultados; escribe para filtrar."
          : null;

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label
          htmlFor={fieldId}
          className="text-[12.5px] font-medium text-zinc-700"
        >
          {label}
        </label>
      ) : null}

      <div ref={anchorRef} className="relative flex items-center">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400"
        />

        <input
          ref={inputRef}
          id={fieldId}
          type="text"
          role="combobox"
          autoComplete="off"
          disabled={disabled}
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
          }
          aria-describedby={status ? statusId : undefined}
          value={term}
          placeholder="Buscar por código o descripción…"
          onFocus={openPanel}
          onChange={(event) => {
            setTerm(event.target.value);
            if (!open) openPanel();
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              if (!open) {
                openPanel();
              } else {
                setActiveIndex((i) => move(i, 1));
              }
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((i) => move(i, -1));
              return;
            }
            if (event.key === "Enter") {
              if (open && activeIndex >= 0) {
                event.preventDefault();
                const option = options[activeIndex];
                if (option) handleToggleProduct(option);
              }
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              closePanel();
            }
          }}
          className={`${controlBase} ${controlSizes.sm} pl-8 font-medium text-ink placeholder:font-normal placeholder:text-zinc-400
            border-line-strong hover:border-hairline-hover focus:border-brand-red focus:ring-3 focus:ring-brand-red/10
            ${open ? "border-zinc-300 bg-zinc-50/80 pr-[4.75rem] shadow-2xs" : term.length > 0 ? "pr-8" : "pr-3"}`}
        />

        <div
          className={`pointer-events-none absolute inset-y-0 right-1.5 flex items-center justify-end gap-0.5 ${
            open ? "w-[4.25rem]" : ""
          }`}
        >
          {term.length > 0 ? (
            <button
              type="button"
              aria-label="Limpiar búsqueda"
              title="Limpiar búsqueda"
              onClick={clearSearch}
              className="pointer-events-auto flex size-5.5 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors cursor-pointer"
            >
              <X className="size-3" strokeWidth={2.5} />
            </button>
          ) : open ? (
            <span className="size-5.5 shrink-0" aria-hidden />
          ) : null}

          {open ? (
            <button
              type="button"
              onClick={() => closePanel()}
              title="Cerrar lista (Esc)"
              className="pointer-events-auto inline-flex min-w-[2.75rem] items-center justify-center gap-0.5 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-200 cursor-pointer"
            >
              <Check className="size-2.5" strokeWidth={2.5} />
              Listo
            </button>
          ) : null}
        </div>
      </div>

      {mounted && anchor
        ? createPortal(
            <>
              {!exiting && (
                <div
                  className="fixed inset-0 z-[70]"
                  aria-hidden="true"
                  onPointerDown={() => closePanel()}
                />
              )}
              <div
                ref={containerRef}
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
              <ul
                ref={panelRef}
                id={listId}
                role="listbox"
                aria-label={label ?? "Catálogo de productos"}
                style={{ maxHeight: LIST_MAX }}
                className="min-h-0 flex-1 overflow-y-auto p-1"
              >
                {options.map((option, index) => {
                  const active = index === activeIndex;
                  const numericId = Number(option.value);
                  const isSelected = selectedIds.has(numericId);

                  return (
                    <li
                      key={option.value}
                      data-motion-item
                      id={`${listId}-${index}`}
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleToggleProduct(option)}
                      className={`group flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left transition-colors ${
                        isSelected
                          ? "bg-brand-green/[0.06] text-ink"
                          : active
                            ? "bg-fill text-ink"
                            : "text-zinc-700 hover:bg-fill/70"
                      }`}
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-[12.5px] font-medium leading-snug">
                          {option.label}
                        </span>
                        {option.hint ? (
                          <span className="truncate font-mono text-[10.5px] text-zinc-400 leading-tight">
                            {option.hint}
                          </span>
                        ) : null}
                      </div>

                      {isSelected ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-brand-green/10 px-2 py-0.5 text-[10.5px] font-semibold text-brand-green">
                          <Check
                            className="size-3"
                            strokeWidth={2.5}
                          />
                          Agregado
                        </span>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line bg-white px-2 py-0.5 text-[10.5px] font-medium text-zinc-600 shadow-2xs transition-colors group-hover:border-zinc-300 group-hover:text-zinc-900">
                          <Plus className="size-3 text-zinc-400 group-hover:text-zinc-600" />
                          Agregar
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>

              {isLoading && (
                <div
                  data-motion-item
                  className="flex shrink-0 items-center justify-center gap-2 border-t border-zinc-100 py-2.5 text-xs text-zinc-400"
                >
                  <Spinner size="sm" />
                  <span>Buscando…</span>
                </div>
              )}

              {!isLoading && options.length === 0 && (
                <div
                  data-motion-item
                  className="flex shrink-0 flex-col items-center justify-center border-t border-zinc-100 py-6 px-4 text-center"
                >
                  <p className="text-[12px] font-medium text-zinc-600">
                    {debouncedTerm === ""
                      ? "Escribe para buscar productos"
                      : "Sin coincidencias"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-400">
                    {debouncedTerm === ""
                      ? "Código o descripción en el buscador."
                      : `Nada coincide con «${debouncedTerm}».`}
                  </p>
                </div>
              )}

              {status && !isLoading && options.length > 0 ? (
                <p
                  data-motion-item
                  id={statusId}
                  role="status"
                  className={`shrink-0 border-t border-zinc-100 px-2.5 py-1.5 text-[10.5px] leading-snug ${
                    failed ? "font-medium text-brand-red" : "text-zinc-400"
                  }`}
                >
                  {status}
                </p>
              ) : null}

              <div
                data-motion-item
                className="flex shrink-0 items-center justify-between gap-2 border-t border-zinc-100 bg-zinc-50/80 px-2.5 py-2"
              >
                <p className="min-w-0 truncate text-[11px] text-zinc-500">
                  {selectedCount === 0
                    ? "Los agregados aparecen debajo del buscador"
                    : selectedCount === 1
                      ? "1 producto en el ticket"
                      : `${selectedCount} productos en el ticket`}
                </p>
                <button
                  type="button"
                  onClick={() => closePanel()}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-white shadow-2xs hover:bg-zinc-800 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Check className="size-3" strokeWidth={2.5} />
                  Listo
                </button>
              </div>
            </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}
