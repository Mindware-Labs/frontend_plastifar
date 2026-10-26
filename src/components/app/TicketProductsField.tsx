import { X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { prefersReducedMotion } from "../../hooks/motion";
import { resolveProductLabel } from "../../lib/lookups";
import { ProductAddSearch } from "./ProductAddSearch";

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

const REMOVE_MS = 360;

/**
 * Selector de uno o varios productos del catálogo para un ticket. Opcional al
 * crear; se puede ampliar después en la ficha.
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
  const [pickerPulse, setPickerPulse] = useState(false);
  const removeTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
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
    const missing = value.filter((row) => !row.productName && !labels[row.productId]);
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
    if (!prefersReducedMotion()) {
      setPickerPulse(true);
      window.setTimeout(() => setPickerPulse(false), 450);
    }
  }

  function rowLabel(row: TicketProductDraft): string {
    if (row.productCode && row.productName) return `${row.productCode} · ${row.productName}`;
    if (row.productName) return row.productName;
    return labels[row.productId] ?? `#${row.productId}`;
  }

  return (
    <div className="flex flex-col gap-3">
      {hint ? <p className="text-[11px] leading-snug text-zinc-400">{hint}</p> : null}

      {!disabled && (
        <div
          className={`transition-[box-shadow] duration-300 ease-out ${pickerPulse ? "rounded-lg ring-2 ring-emerald-200/70" : ""}`}
        >
          <ProductAddSearch
            id={addFieldId}
            label={pickerLabel}
            disabled={disabled}
            excludeProductIds={value.map((r) => r.productId)}
            onPick={handlePick}
            onDuplicate={() => setAddError("Ese producto ya está en el ticket.")}
          />
        </div>
      )}

      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Productos seleccionados">
          {value.map((row) => {
            const exiting = removingIds.has(row.productId);
            return (
              <li
                key={row.productId}
                className={`inline-flex max-w-full items-center gap-0.5 rounded-md border border-zinc-200 bg-zinc-50 py-0.5 pl-2 pr-0.5 text-[11.5px] text-zinc-800 shadow-2xs ${
                  exiting ? "animate-plf-check-out" : "animate-plf-seal-pop"
                }`}
              >
                <span className="truncate font-medium" title={rowLabel(row)}>
                  {row.productCode ? (
                    <>
                      <span className="font-mono text-[10.5px] font-semibold text-zinc-500">{row.productCode}</span>
                      <span className="mx-1 text-zinc-300">·</span>
                      <span>{row.productName || labels[row.productId]}</span>
                    </>
                  ) : (
                    rowLabel(row)
                  )}
                </span>
                {!disabled && (
                  <button
                    type="button"
                    className="flex size-6 shrink-0 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-200/80 hover:text-zinc-700"
                    aria-label="Quitar producto"
                    disabled={exiting}
                    onClick={() => handleRemove(row.productId)}
                  >
                    <X className="size-3.5" strokeWidth={2.25} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      {addError ? <p className="animate-plf-shake text-[11px] text-brand-red">{addError}</p> : null}
    </div>
  );
}
