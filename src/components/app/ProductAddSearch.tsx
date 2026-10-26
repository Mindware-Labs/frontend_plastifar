import { Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { searchProducts } from "../../lib/lookups";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import type { LookupOption } from "../ui/LookupSelect";
import { controlBase, controlSizes } from "../ui/fieldStyles";

const LIST_MAX = 220;

interface ProductAddSearchProps {
  id?: string;
  label: string;
  disabled?: boolean;
  excludeProductIds?: number[];
  onPick: (option: LookupOption) => void;
  onDuplicate?: () => void;
}

/**
 * Búsqueda de producto para agregar a una lista: un solo campo de texto, lista
 * anclada debajo. Pensado para el drawer de crear ticket (sin combobox vacío).
 */
export function ProductAddSearch({
  id,
  label,
  disabled,
  excludeProductIds = [],
  onPick,
  onDuplicate,
}: ProductAddSearchProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  const listId = `${fieldId}-listbox`;
  const statusId = `${fieldId}-status`;

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const panelWrapRef = useRef<HTMLDivElement>(null);

  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [options, setOptions] = useState<LookupOption[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [anchor, setAnchor] = useState<{ left: number; top: number; width: number } | null>(null);

  const debouncedTerm = useDebouncedValue(term).trim();
  const exclude = useRef(excludeProductIds);
  exclude.current = excludeProductIds;
  const excludeKey = excludeProductIds.join(",");

  function measure() {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAnchor({ left: rect.left, top: rect.bottom + 4, width: rect.width });
  }

  function openPanel() {
    if (disabled) return;
    measure();
    setOpen(true);
  }

  function closePanel() {
    setOpen(false);
    setActiveIndex(-1);
  }

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setIsLoading(true);
    setFailed(false);

    searchProducts(debouncedTerm)
      .then(({ options: raw, hasMore: more }) => {
        if (cancelled) return;
        const blocked = new Set(exclude.current.map(String));
        const filtered = raw.filter((o) => !blocked.has(o.value));
        setOptions(filtered);
        setHasMore(more);
        setActiveIndex(filtered.length > 0 ? 0 : -1);
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
  }, [open, debouncedTerm, excludeKey]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelWrapRef.current?.contains(target)) return;
      closePanel();
    }

    function onViewportChange() {
      measure();
    }

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", onViewportChange, true);
      window.removeEventListener("resize", onViewportChange);
    };
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    panelRef.current?.children[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function commit(index: number) {
    const option = options[index];
    if (!option) return;
    if (exclude.current.includes(Number(option.value))) {
      onDuplicate?.();
      return;
    }
    onPick(option);
    measure();
    setOpen(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      measure();
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
    ? "No se pudo buscar. Intenta de nuevo."
    : isLoading
      ? "Buscando…"
      : options.length === 0
        ? debouncedTerm === ""
          ? "Escribe para buscar o elige de la lista."
          : "Sin coincidencias."
        : hasMore
          ? "Hay más resultados; sigue escribiendo."
          : null;

  return (
    <div ref={rootRef} className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-[12.5px] font-medium text-zinc-700">
        {label}
      </label>

      <div className="relative">
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
          aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
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
              if (!open) openPanel();
              setActiveIndex((i) => move(i, 1));
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
                commit(activeIndex);
              }
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              closePanel();
            }
          }}
          className={`${controlBase} ${controlSizes.sm} pl-8 pr-3 font-medium text-ink placeholder:font-normal placeholder:text-zinc-400
            border-line-strong hover:border-hairline-hover focus:border-brand-red focus:ring-3 focus:ring-brand-red/10
            ${open ? "border-brand-red/40 ring-3 ring-brand-red/10" : ""}`}
        />
      </div>

      {open && anchor
        ? createPortal(
            <div
              ref={panelWrapRef}
              style={{
                position: "fixed",
                left: anchor.left,
                top: anchor.top,
                width: anchor.width,
                zIndex: 60,
              }}
              className="animate-plf-popover-in overflow-hidden rounded-edge border border-line bg-white shadow-panel"
            >
              <ul
                ref={panelRef}
                id={listId}
                role="listbox"
                aria-label={label}
                style={{ maxHeight: LIST_MAX }}
                className="overflow-y-auto p-1"
              >
                {options.map((option, index) => {
                  const active = index === activeIndex;
                  return (
                    <li
                      key={option.value}
                      id={`${listId}-${index}`}
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => commit(index)}
                      className={`flex cursor-pointer flex-col gap-0.5 rounded-edge px-2.5 py-2 text-left transition-colors
                        ${active ? "bg-fill text-ink" : "text-brand-gray hover:bg-fill/70"}`}
                    >
                      <span className="truncate text-[12.5px] font-medium leading-tight">{option.label}</span>
                      {option.hint ? (
                        <span className="truncate font-mono text-[10.5px] leading-tight text-faint">{option.hint}</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {status ? (
                <p
                  id={statusId}
                  role="status"
                  className={`border-t border-line px-2.5 py-2 text-[11px] leading-snug ${
                    failed ? "text-brand-red-dark" : "text-faint"
                  }`}
                >
                  {status}
                </p>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
