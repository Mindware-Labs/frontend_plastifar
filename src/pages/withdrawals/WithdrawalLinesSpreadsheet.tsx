import { Plus, Trash2 } from "lucide-react";
import { useId, useMemo } from "react";
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
  const normalized = raw.replace(",", ".").slice(0, UNIT_PRICE_CHARS_MAX);
  return normalized;
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

              return (
                <tr
                  key={line.key}
                  ref={(el) => rowRef?.(line.key, el)}
                  className={`group border-b border-line-soft transition-colors duration-150 last:border-0 hover:bg-fill/80 ${
                    highlighted ? "bg-brand-red/[0.03]" : ""
                  }`}
                >
                  <Td className="border-r border-line-soft bg-zinc-50/40 text-center font-heading text-[11px] font-bold tabular-nums text-zinc-500">
                    {index + 1}
                  </Td>
                  <Td className="max-w-0 border-r border-line-soft py-1.5">
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
                  </Td>
                  <Td
                    style={qtyColTightStyle}
                    className="border-r border-line-soft !px-0 py-1.5 text-center"
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
                  </Td>
                  <Td className="border-r border-line-soft px-1.5 py-1.5 text-center">
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
                  </Td>
                  <Td className="border-r border-line-soft px-1 py-1.5 text-center">
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
                  </Td>
                  <Td className="border-r border-line-soft py-1.5 text-center">
                    <span className="block px-1 font-medium tabular-nums text-[12px] text-zinc-800">
                      {lineValue === null
                        ? "—"
                        : formatAmountOrPlain(lineValue, currency || null)}
                    </span>
                  </Td>
                  <Td className="py-1.5 text-center">
                    <button
                      type="button"
                      title={`Quitar fila ${index + 1}`}
                      aria-label={`Quitar fila ${index + 1}`}
                      disabled={lines.length <= 1}
                      onClick={() => onRemoveLine(line.key)}
                      className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-brand-red disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </Td>
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
