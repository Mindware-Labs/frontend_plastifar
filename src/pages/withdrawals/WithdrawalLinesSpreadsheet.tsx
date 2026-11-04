import { Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { prefersReducedMotion } from "../../hooks/motion";
import {
  ticketProductLabelMap,
  ticketProductsToLookupOptions,
} from "../../lib/ticketProducts";
import { resolveProductLabel, searchProducts } from "../../lib/lookups";
import { formatAmountOrPlain } from "../../lib/numbers";
import { computeLineValue } from "../../lib/withdrawals";
import type { TicketProductResponse } from "../../types/api";
import { Button } from "../../components/ui/Button";
import { DataTable, HeadRow, Td, Th } from "../../components/ui/DataTable";
import { LookupSelect } from "../../components/ui/LookupSelect";
import { controlBaseUnsized } from "../../components/ui/fieldStyles";

export interface WithdrawalLineDraft {
  key: number;
  productId: string;
  productLabel?: string;
  quantity: string;
  quantityUnit: string;
  packDetail: string;
  unitPrice: string;
}

export interface WithdrawalLineFieldErrors {
  productId?: string;
  quantity?: string;
  quantityUnit?: string;
  packDetail?: string;
  unitPrice?: string;
}

interface WithdrawalLinesSpreadsheetProps {
  lines: WithdrawalLineDraft[];
  currency: string;
  ticketProducts?: TicketProductResponse[];
  linesError?: string;
  byLine: Record<number, WithdrawalLineFieldErrors>;
  totalValue: number;
  highlightLineKey?: number | null;
  rowRef?: (key: number, el: HTMLTableRowElement | null) => void;
  onPatch: (key: number, patch: Partial<WithdrawalLineDraft>) => void;
  onAddLine: () => void;
  onRemoveLine: (key: number) => void;
}

function parsePositiveDecimal(raw: string): number | null {
  const clean = raw.trim().replace(",", ".");
  if (!clean) return null;
  const num = Number(clean);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

function parseOptionalPrice(raw: string): number | null {
  const clean = raw.trim().replace(",", ".");
  if (!clean) return null;
  const num = Number(clean);
  if (!Number.isFinite(num) || num < 0) return null;
  return num;
}

/** Acotaciones visuales PF-FOR-068 (celdas estrechas tipo planilla). */
const QTY_UNIT_SUFFIX_MAX = 5;
const UNIT_PRICE_CHARS_MAX = 6;
const QTY_NUM_WIDTH = "3.25rem";
const QTY_SUFFIX_WIDTH = "2.65rem";
/** Número + sufijo + gap-1; celda Cant. sin padding lateral. */
const QTY_COL_WIDTH = "6.15rem";

const qtyColTightStyle = {
  width: QTY_COL_WIDTH,
  maxWidth: QTY_COL_WIDTH,
  paddingLeft: 0,
  paddingRight: 0,
} as const;

function cellInputClass(hasError: boolean, compact?: boolean, centered?: boolean) {
  return `${controlBaseUnsized} h-8 min-w-0 tabular-nums ${
    compact ? "px-1.5 text-[11px]" : "w-full px-2 text-[12px]"
  } ${centered ? "text-center" : ""} ${
    hasError
      ? "border-brand-red/70 bg-brand-red/[0.02] focus:border-brand-red focus:ring-2 focus:ring-brand-red/12"
      : "border-line focus:border-brand-red focus:ring-2 focus:ring-brand-red/10"
  }`;
}

function clampUnitPrice(raw: string): string {
  // Solo dígitos y un único separador decimal (la coma se convierte en punto).
  const cleaned = raw.replace(",", ".").replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  const normalized = (
    firstDot === -1
      ? cleaned
      : cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "")
  ).slice(0, UNIT_PRICE_CHARS_MAX);
  return normalized;
}

/** Deben coincidir con plf-apple-row-in / plf-apple-row-out en index.css. */
const ROW_ENTER_MS = 480;
const ROW_EXIT_MS = 320;

type RowPhase = "idle" | "from" | "hold" | "in" | "arm" | "out";

function MotionCell({
  phase,
  className = "",
  innerClassName = "",
  style,
  children,
}: {
  phase: RowPhase;
  className?: string;
  innerClassName?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const collapsed = phase === "from" || phase === "hold" || phase === "out";
  const ready = phase === "hold" || phase === "in" || phase === "arm" || phase === "out";
  const motion = phase === "out" || phase === "arm" ? "out" : phase === "idle" ? "idle" : "in";
  return (
    <Td style={style} className={`!py-0 ${className}`}>
      <div
        className="plf-apple-row-shell"
        data-collapsed={collapsed ? "true" : "false"}
        data-ready={ready ? "true" : "false"}
        data-motion={motion}
      >
        <div className="plf-apple-row-clip">
          <div
            className={`${innerClassName} ${
              phase === "in"
                ? "animate-plf-apple-row-in"
                : phase === "out"
                  ? "animate-plf-apple-row-out"
                  : phase === "from" || phase === "hold"
                    ? "opacity-0"
                    : ""
            }`}
          >
            {children}
          </div>
        </div>
      </div>
    </Td>
  );
}

export function WithdrawalLinesSpreadsheet({
  lines,
  currency,
  ticketProducts = [],
  linesError,
  byLine,
  totalValue,
  highlightLineKey,
  rowRef,
  onPatch,
  onAddLine,
  onRemoveLine,
}: WithdrawalLinesSpreadsheetProps) {
  const baseId = useId();
  const [prevLineKeys, setPrevLineKeys] = useState<number[]>(() => lines.map((line) => line.key));
  const [enterKeys, setEnterKeys] = useState<Set<number>>(() => new Set());
  const [enterArmed, setEnterArmed] = useState<Set<number>>(() => new Set());
  const [openKeys, setOpenKeys] = useState<Set<number>>(() => new Set());
  const [exitKeys, setExitKeys] = useState<Set<number>>(() => new Set());
  const [exitArmed, setExitArmed] = useState<Set<number>>(() => new Set());
  const [indexByKey, setIndexByKey] = useState<Map<number, number>>(
    () => new Map(lines.map((line, index) => [line.key, index])),
  );
  const [bumpedKeys, setBumpedKeys] = useState<Set<number>>(() => new Set());
  const rowEls = useRef(new Map<number, HTMLTableRowElement>());
  const exitTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const enterTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const lineKeys = lines.map((line) => line.key);
  const lineKeySignature = lineKeys.join(",");
  const prevKeySignature = prevLineKeys.join(",");
  if (lineKeySignature !== prevKeySignature) {
    const prev = new Set(prevLineKeys);
    const added = lineKeys.filter((key) => !prev.has(key));
    const moved = new Set<number>();
    lines.forEach((line, index) => {
      const previousIndex = indexByKey.get(line.key);
      if (previousIndex !== undefined && previousIndex !== index) moved.add(line.key);
    });
    setPrevLineKeys(lineKeys);
    setIndexByKey(new Map(lines.map((line, index) => [line.key, index])));
    if (moved.size > 0) setBumpedKeys(moved);
    setEnterKeys((current) => {
      const next = new Set(current);
      let changed = false;
      if (added.length === 1 && !next.has(added[0]) && !prefersReducedMotion()) {
        next.add(added[0]);
        changed = true;
      }
      for (const key of current) {
        if (!lineKeys.includes(key)) {
          next.delete(key);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }

  useLayoutEffect(() => {
    const pending = [...enterKeys].filter((key) => !enterArmed.has(key) && !exitKeys.has(key));
    if (pending.length === 0) return;
    const frame = requestAnimationFrame(() => {
      setEnterArmed((current) => {
        const next = new Set(current);
        for (const key of pending) next.add(key);
        return next;
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [enterKeys, enterArmed, exitKeys]);

  useLayoutEffect(() => {
    const pending = [...enterKeys].filter(
      (key) => enterArmed.has(key) && !openKeys.has(key) && !exitKeys.has(key),
    );
    if (pending.length === 0) return;
    const frame = requestAnimationFrame(() => {
      setOpenKeys((current) => {
        const next = new Set(current);
        for (const key of pending) next.add(key);
        return next;
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [enterKeys, enterArmed, openKeys, exitKeys]);

  useEffect(() => {
    for (const key of openKeys) {
      if (!enterKeys.has(key) || enterTimers.current.has(key)) continue;
      const timer = setTimeout(() => {
        enterTimers.current.delete(key);
        setEnterKeys((current) => {
          if (!current.has(key)) return current;
          const next = new Set(current);
          next.delete(key);
          return next;
        });
        setOpenKeys((current) => {
          if (!current.has(key)) return current;
          const next = new Set(current);
          next.delete(key);
          return next;
        });
        setEnterArmed((current) => {
          if (!current.has(key)) return current;
          const next = new Set(current);
          next.delete(key);
          return next;
        });
        rowEls.current.get(key)?.scrollIntoView({ block: "nearest", behavior: "auto" });
      }, ROW_ENTER_MS);
      enterTimers.current.set(key, timer);
    }
  }, [openKeys, enterKeys]);

  useEffect(() => {
    if (bumpedKeys.size === 0) return;
    const timer = setTimeout(() => setBumpedKeys(new Set()), 320);
    return () => clearTimeout(timer);
  }, [bumpedKeys]);

  const scrolledEnter = useRef(new Set<number>());
  useEffect(() => {
    for (const key of openKeys) {
      if (!enterKeys.has(key) || scrolledEnter.current.has(key)) continue;
      scrolledEnter.current.add(key);
      rowEls.current.get(key)?.scrollIntoView({
        block: "nearest",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    }
  }, [openKeys, enterKeys]);

  const onRemoveRef = useRef(onRemoveLine);
  onRemoveRef.current = onRemoveLine;
  const exitKeysRef = useRef(exitKeys);
  exitKeysRef.current = exitKeys;

  useEffect(() => {
    const enterTimerMap = enterTimers.current;
    const exitTimerMap = exitTimers.current;
    return () => {
      for (const timer of enterTimerMap.values()) clearTimeout(timer);
      enterTimerMap.clear();
      for (const timer of exitTimerMap.values()) clearTimeout(timer);
      exitTimerMap.clear();
      for (const key of exitKeysRef.current) onRemoveRef.current(key);
    };
  }, []);

  function requestRemove(key: number) {
    if (exitKeys.has(key) || exitArmed.has(key)) return;
    const survivors = lines.filter((line) => line.key !== key && !exitKeys.has(line.key)).length;
    if (survivors < 1) return;
    if (prefersReducedMotion()) {
      onRemoveLine(key);
      return;
    }
    setExitKeys((current) => new Set(current).add(key));
  }

  useLayoutEffect(() => {
    const pending = [...exitKeys].filter((key) => !exitArmed.has(key));
    if (pending.length === 0) return;
    const frame = requestAnimationFrame(() => {
      setExitArmed((current) => {
        const next = new Set(current);
        for (const key of pending) next.add(key);
        return next;
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [exitKeys, exitArmed]);

  useEffect(() => {
    for (const key of exitArmed) {
      if (exitTimers.current.has(key)) continue;
      const timer = setTimeout(() => {
        exitTimers.current.delete(key);
        onRemoveRef.current(key);
        setExitKeys((current) => {
          if (!current.has(key)) return current;
          const next = new Set(current);
          next.delete(key);
          return next;
        });
        setExitArmed((current) => {
          if (!current.has(key)) return current;
          const next = new Set(current);
          next.delete(key);
          return next;
        });
      }, ROW_EXIT_MS);
      exitTimers.current.set(key, timer);
    }
  }, [exitArmed]);

  function phaseFor(key: number): RowPhase {
    if (exitKeys.has(key)) return exitArmed.has(key) ? "out" : "arm";
    if (!enterKeys.has(key)) return "idle";
    if (!enterArmed.has(key)) return "from";
    return openKeys.has(key) ? "in" : "hold";
  }

  const liveCount = lines.filter((line) => !exitKeys.has(line.key)).length;

  const recommendedOptions = useMemo(
    () => ticketProductsToLookupOptions(ticketProducts),
    [ticketProducts],
  );
  const ticketLabels = useMemo(() => ticketProductLabelMap(ticketProducts), [ticketProducts]);

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="overflow-hidden rounded-xl border border-line bg-white shadow-2xs">
        <DataTable fixed bare className="overflow-x-auto">
          <colgroup>
            <col className="w-10" />
            <col style={{ width: "42%" }} />
            <col style={{ width: QTY_COL_WIDTH, maxWidth: QTY_COL_WIDTH }} />
            <col className="w-[5.25rem]" />
            <col className="w-[4.35rem]" />
            <col className="w-[8.75rem]" />
            <col className="w-11" />
          </colgroup>
          <thead>
            <HeadRow>
              <Th className="border-r border-line-soft bg-zinc-50/90 text-center">#</Th>
              <Th className="border-r border-line-soft bg-zinc-50/90">Producto</Th>
              <Th
                style={qtyColTightStyle}
                className="border-r border-line-soft bg-zinc-50/90 !px-0 text-center"
              >
                Cant.
              </Th>
              <Th className="border-r border-line-soft bg-zinc-50/90 text-center">Unid.</Th>
              <Th className="border-r border-line-soft bg-zinc-50/90 text-center">P. unit.</Th>
              <Th className="border-r border-line-soft bg-zinc-50/90 text-center">Valor</Th>
              <Th className="bg-zinc-50/90 sr-only">Acciones</Th>
            </HeadRow>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const lineErrors = byLine[line.key] ?? {};
              const qty = parsePositiveDecimal(line.quantity);
              const price = parseOptionalPrice(line.unitPrice);
              const lineValue = computeLineValue(qty, price);
              const highlighted = highlightLineKey === line.key;
              const selectedLabel =
                line.productLabel ?? (line.productId ? ticketLabels.get(line.productId) : undefined);
              const phase = phaseFor(line.key);
              const exiting = phase === "out" || phase === "arm";

              return (
                <tr
                  key={line.key}
                  ref={(el) => {
                    if (el) rowEls.current.set(line.key, el);
                    else rowEls.current.delete(line.key);
                    rowRef?.(line.key, el);
                  }}
                  aria-hidden={exiting || undefined}
                  className={`group border-b border-line-soft transition-colors duration-150 last:border-0 hover:bg-fill/80 motion-reduce:transition-none ${
                    phase === "in" && !highlighted ? "animate-plf-apple-row-wash" : ""
                  } ${highlighted ? "bg-brand-red/[0.03]" : ""} ${exiting ? "pointer-events-none" : ""}`}
                >
                  <MotionCell
                    phase={phase}
                    innerClassName="py-2"
                    className="border-r border-line-soft bg-zinc-50/40 text-center font-heading text-[11px] font-bold tabular-nums text-zinc-500"
                  >
                    <span className={bumpedKeys.has(line.key) ? "inline-block animate-plf-header-fade" : "inline-block"}>
                      {index + 1}
                    </span>
                  </MotionCell>
                  <MotionCell phase={phase} innerClassName="py-1.5" className="max-w-0 border-r border-line-soft">
                    <LookupSelect
                      id={`${baseId}-product-${line.key}`}
                      size="sm"
                      className="min-w-0 max-w-full"
                      value={line.productId}
                      selectedLabel={selectedLabel}
                      placeholder="Buscar código o descripción…"
                      searchPlaceholder="Código o descripción…"
                      recommendedOptions={
                        recommendedOptions.length > 0 ? recommendedOptions : undefined
                      }
                      search={searchProducts}
                      resolveSelectedLabel={resolveProductLabel}
                      onChange={(val) =>
                        onPatch(line.key, { productId: val, productLabel: undefined })
                      }
                      state={lineErrors.productId ? "error" : "idle"}
                      aria-label={`Producto fila ${index + 1}`}
                    />
                    {lineErrors.productId ? (
                      <p className="mt-1 truncate text-[10px] font-medium text-brand-red">
                        {lineErrors.productId}
                      </p>
                    ) : null}
                  </MotionCell>
                  <MotionCell
                    phase={phase}
                    style={qtyColTightStyle}
                    innerClassName="py-1.5"
                    className="border-r border-line-soft !px-0 text-center"
                  >
                    <div
                      className="mx-auto flex items-center justify-center gap-1"
                      style={{ width: QTY_COL_WIDTH }}
                    >
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0"
                        aria-label={`Cantidad fila ${index + 1}`}
                        value={line.quantity}
                        onChange={(e) => {
                          const next = e.target.value.replace(",", ".");
                          if (next !== "" && !/^\d*\.?\d*$/.test(next)) return;
                          onPatch(line.key, { quantity: next });
                        }}
                        style={{ width: QTY_NUM_WIDTH }}
                        className={`${cellInputClass(Boolean(lineErrors.quantity), true, true)} shrink-0`}
                      />
                      <input
                        type="text"
                        maxLength={QTY_UNIT_SUFFIX_MAX}
                        placeholder="CAJ"
                        aria-label={`Unidad de cantidad fila ${index + 1}`}
                        value={line.quantityUnit}
                        onChange={(e) =>
                          onPatch(line.key, {
                            quantityUnit: e.target.value.toUpperCase().slice(0, QTY_UNIT_SUFFIX_MAX),
                          })
                        }
                        style={{ width: QTY_SUFFIX_WIDTH }}
                        className={`${cellInputClass(Boolean(lineErrors.quantityUnit), true, true)} shrink-0 uppercase`}
                      />
                    </div>
                  </MotionCell>
                  <MotionCell
                    phase={phase}
                    innerClassName="py-1.5"
                    className="border-r border-line-soft px-1.5 text-center"
                  >
                    <input
                      type="text"
                      maxLength={60}
                      placeholder="14PAQ"
                      aria-label={`Empaque fila ${index + 1}`}
                      value={line.packDetail}
                      onChange={(e) =>
                        onPatch(line.key, { packDetail: e.target.value.toUpperCase() })
                      }
                      className={`${cellInputClass(Boolean(lineErrors.packDetail), true, true)} w-full uppercase font-mono`}
                    />
                  </MotionCell>
                  <MotionCell
                    phase={phase}
                    innerClassName="py-1.5"
                    className="border-r border-line-soft px-1 text-center"
                  >
                    <input
                      type="text"
                      inputMode="decimal"
                      maxLength={UNIT_PRICE_CHARS_MAX}
                      placeholder="0.00"
                      aria-label={`Precio unitario fila ${index + 1}`}
                      value={line.unitPrice}
                      onChange={(e) =>
                        onPatch(line.key, { unitPrice: clampUnitPrice(e.target.value) })
                      }
                      className={`${cellInputClass(Boolean(lineErrors.unitPrice), true, true)} mx-auto w-[2.65rem]`}
                    />
                  </MotionCell>
                  <MotionCell
                    phase={phase}
                    innerClassName="py-1.5"
                    className="border-r border-line-soft text-center"
                  >
                    <span className="block px-1 font-medium tabular-nums text-[12px] text-zinc-800">
                      {lineValue === null
                        ? "—"
                        : formatAmountOrPlain(lineValue, currency || null)}
                    </span>
                  </MotionCell>
                  <MotionCell phase={phase} innerClassName="py-1.5" className="text-center">
                    <button
                      type="button"
                      title={`Quitar fila ${index + 1}`}
                      aria-label={`Quitar fila ${index + 1}`}
                      disabled={liveCount <= 1 || exiting}
                      onClick={() => requestRemove(line.key)}
                      className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-zinc-400 transition-[color,background-color,transform] duration-150 ease-plf-spring hover:bg-zinc-100 hover:text-brand-red active:scale-[0.92] disabled:cursor-not-allowed disabled:opacity-30 motion-reduce:transition-none motion-reduce:active:scale-100"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </MotionCell>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-line bg-zinc-50/80">
              <Td colSpan={5} className="border-r border-line-soft py-2.5 text-right font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-500">
                Total ({currency})
              </Td>
              <Td className="border-r border-line-soft py-2.5 text-center font-semibold tabular-nums text-[13px] text-zinc-900">
                {totalValue > 0 || lines.some((l) => parseOptionalPrice(l.unitPrice) !== null)
                  ? formatAmountOrPlain(totalValue, currency || null)
                  : "—"}
              </Td>
              <Td />
            </tr>
          </tfoot>
        </DataTable>
      </div>

      {linesError ? <p className="text-[12px] font-medium text-brand-red">{linesError}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11.5px] leading-relaxed text-zinc-500">
          Renglones del PF-FOR-068 · «Cant.» incluye unidad (p. ej. 3 + CAJ); «Unid.» es el empaque (p. ej. 14PAQ).
        </p>
        <Button type="button" size="sm" variant="secondary" onClick={onAddLine}>
          <Plus className="size-3.5" />
          <span>Agregar fila</span>
        </Button>
      </div>
    </div>
  );
}
