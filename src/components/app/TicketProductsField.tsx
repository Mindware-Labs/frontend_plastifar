import { Trash2, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { prefersReducedMotion } from "../../hooks/motion";
import { resolveProductLabel } from "../../lib/lookups";
import { ProductAddSearch } from "./ProductAddSearch";

/** Salida del chip: un poco más ágil que adjuntos (0.36s). */
const REMOVE_MS = 190;

export interface TicketProductDraft {
  productId: number;
  productCode: string;
  productName: string;
}

interface TicketProductsFieldProps {
  value: TicketProductDraft[];
  onChange: (value: TicketProductDraft[]) => void;
  disabled?: boolean;
  hint?: string;
  pickerLabel?: string;
}

/**
 * Selector de productos del catálogo para tickets:
 * buscador único + chips debajo con los artículos vinculados.
 */
export function TicketProductsField({
  value,
  onChange,
  disabled,
  hint,
  pickerLabel = "Agregar producto",
}: TicketProductsFieldProps) {
  const addFieldId = useId();
  const [addError, setAddError] = useState<string | null>(null);
  const [labels, setLabels] = useState<Record<number, string>>({});
  const [removingIds, setRemovingIds] = useState<Set<number>>(() => new Set());

  const removeTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    return () => {
      for (const timer of removeTimers.current.values()) clearTimeout(timer);
      removeTimers.current.clear();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const missing = value.filter(
      (row) => !row.productName && !labels[row.productId],
    );
    if (missing.length === 0) return;

    void (async () => {
      const entries = await Promise.all(
        missing.map(async (row) => {
          const resolved = await resolveProductLabel(String(row.productId));
          return [row.productId, resolved ?? `#${row.productId}`] as const;
        }),
      );
      if (cancelled) return;
      setLabels((prev) => {
        const next = { ...prev };
        for (const [id, text] of entries) next[id] = text;
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [value]);

  function handleRemove(productId: number) {
    if (removingIds.has(productId)) return;

    if (prefersReducedMotion()) {
      onChange(value.filter((row) => row.productId !== productId));
      return;
    }

    setRemovingIds((prev) => new Set(prev).add(productId));
    const timer = setTimeout(() => {
      onChange(valueRef.current.filter((row) => row.productId !== productId));
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
      removeTimers.current.delete(productId);
    }, REMOVE_MS);
    removeTimers.current.set(productId, timer);
  }

  function handleClearAll() {
    onChange([]);
  }

  function handlePick(option: { value: string; label: string; hint?: string }) {
    setAddError(null);
    const numericId = Number(option.value);
    if (value.some((row) => row.productId === numericId)) {
      setAddError("Ese producto ya está en el ticket.");
      return;
    }
    onChange([
      ...value,
      {
        productId: numericId,
        productCode: option.hint ?? "",
        productName: option.label,
      },
    ]);
  }

  function rowLabel(row: TicketProductDraft): string {
    if (row.productCode && row.productName)
      return `${row.productCode} · ${row.productName}`;
    if (row.productName) return row.productName;
    return labels[row.productId] ?? `#${row.productId}`;
  }

  return (
    <div className="flex flex-col gap-3">
      {hint ? (
        <p className="text-[11px] leading-snug text-zinc-400">{hint}</p>
      ) : null}

      {!disabled ? (
        <ProductAddSearch
          id={addFieldId}
          label={pickerLabel}
          disabled={disabled}
          selectedProducts={value}
          excludeProductIds={value.map((r) => r.productId)}
          onPick={handlePick}
          onRemove={handleRemove}
          onDuplicate={() =>
            setAddError("Ese producto ya está en el ticket.")
          }
        />
      ) : null}

      {value.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-lg border border-line-soft bg-zinc-50/40 p-2.5">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <span className="text-[11px] font-medium text-zinc-600">
              {value.length === 1
                ? "1 artículo vinculado"
                : `${value.length} artículos vinculados`}
            </span>
            {!disabled && value.length > 1 ? (
              <button
                type="button"
                onClick={handleClearAll}
                className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-zinc-400 transition-colors hover:text-brand-red cursor-pointer"
              >
                <Trash2 className="size-3" />
                Vaciar
              </button>
            ) : null}
          </div>

          <ul
            className="flex flex-wrap gap-1.5"
            aria-label="Productos seleccionados"
          >
            {value.map((row) => {
              const exiting = removingIds.has(row.productId);
              return (
                <li
                  key={row.productId}
                  className={`inline-flex max-w-full items-center gap-1 rounded-md border border-zinc-200/90 bg-white py-1 pl-2 pr-1 text-[11.5px] text-zinc-800 shadow-2xs transition-[border-color,opacity] hover:border-zinc-300 ${
                    exiting
                      ? "animate-plf-check-out [animation-duration:190ms]"
                      : "animate-plf-seal-pop"
                  }`}
                >
                  <span className="truncate font-medium" title={rowLabel(row)}>
                    {row.productCode ? (
                      <>
                        <span className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[10px] font-semibold text-zinc-600">
                          {row.productCode}
                        </span>
                        <span className="mx-1.5 text-zinc-300">·</span>
                        <span>{row.productName || labels[row.productId]}</span>
                      </>
                    ) : (
                      rowLabel(row)
                    )}
                  </span>
                  {!disabled && (
                    <button
                      type="button"
                      className="flex size-5 shrink-0 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer"
                      aria-label={`Quitar ${row.productName || row.productCode || row.productId}`}
                      disabled={exiting}
                      onClick={() => handleRemove(row.productId)}
                    >
                      <X className="size-3" strokeWidth={2.25} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {addError ? (
        <p className="animate-plf-shake text-[11px] font-medium text-brand-red">
          {addError}
        </p>
      ) : null}
    </div>
  );
}
