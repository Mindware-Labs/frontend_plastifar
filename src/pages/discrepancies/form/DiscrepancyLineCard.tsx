import { Trash2 } from "lucide-react";
import {
  Controller,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from "react-hook-form";
import { LookupField, SelectField, TextField } from "../../../components/ui/Field";
import { resolveClientLabel, resolveProductLabel, searchClients, searchProducts } from "../../../lib/lookups";
import {
  DISCREPANCY_TYPE_OPTIONS,
  QUALIFIES_OPTIONS,
  type FormValues,
  type LineValues,
} from "./discrepancyForm";

/** Ficha estructurada de línea en discrepancia con 2 filas organizadas (CERO SCROLL HORIZONTAL) */
interface DiscrepancyLineCardProps {
  index: number;
  control: Control<FormValues>;
  register: UseFormRegister<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  lineErrors: FieldErrors<LineValues> | undefined;
  existingLine?: any;
  ticketClientName?: string;
  ticketClientId?: number;
  ticketInheritedLabel: string;
  canRemove: boolean;
  onRemove: () => void;
}

export function DiscrepancyLineCard({
  index,
  control,
  register,
  setValue,
  lineErrors,
  existingLine,
  ticketClientName,
  ticketClientId,
  ticketInheritedLabel,
  canRemove,
  onRemove,
}: DiscrepancyLineCardProps) {
  const discrepancyType = useWatch({ control, name: `lines.${index}.discrepancyType` }) ?? "faltante";
  const quantityValue = useWatch({ control, name: `lines.${index}.quantity` }) ?? "";
  const qtyNum = Number(quantityValue) || 0;

  return (
    <div className="rounded-xl border border-zinc-200/90 bg-white shadow-2xs overflow-hidden transition-all hover:border-zinc-300">
      {/* Cabecera de la línea con número, estado de balance y acción quitar */}
      <div className="border-b border-zinc-100 bg-zinc-50/70 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex size-5.5 items-center justify-center rounded-md bg-zinc-200/80 text-zinc-700 font-heading text-xs font-bold">
            {index + 1}
          </span>
          <span className="font-heading text-xs font-bold text-zinc-800">
            Línea #{index + 1}
          </span>
          {qtyNum > 0 ? (
            discrepancyType === "sobrante" ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                Sobrante: {qtyNum} und
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200/80 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                Faltante: {qtyNum} und
              </span>
            )
          ) : (
            <span className="text-[11px] text-zinc-400">
              (Indica la cantidad de {discrepancyType})
            </span>
          )}
        </div>

        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 text-[11.5px] font-medium text-zinc-400 hover:text-brand-red px-2 py-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
            title={`Quitar línea ${index + 1}`}
          >
            <Trash2 className="size-3.5" />
            <span>Quitar línea</span>
          </button>
        )}
      </div>

      {/* Cuerpo en 2 sub-filas 100% responsivas sin scroll */}
      <div className="p-3.5 sm:p-4 flex flex-col gap-3">
        {/* Fila 1: Documentos & Producto (12 columnas) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-start">
          {/* 1. # Reclamo */}
          <div className="lg:col-span-2">
            <TextField
              size="sm"
              label="# Reclamo"
              placeholder="El del ticket"
              error={lineErrors?.claimRef?.message}
              {...register(`lines.${index}.claimRef`)}
            />
          </div>

          {/* 2. Factura * */}
          <div className="lg:col-span-2">
            <TextField
              size="sm"
              label="Factura"
              required
              placeholder="B1500000123"
              error={lineErrors?.invoiceRef?.message}
              {...register(`lines.${index}.invoiceRef`)}
            />
          </div>

          {/* 3. Cliente */}
          <div className="lg:col-span-3">
            <Controller
              name={`lines.${index}.clientId`}
              control={control}
              render={({ field: clientField }) => {
                const isTicketClient =
                  clientField.value === "" ||
                  (ticketClientId !== undefined && clientField.value === String(ticketClientId));

                const selectedLabel = isTicketClient
                  ? ticketClientName || undefined
                  : existingLine?.clientName && clientField.value === String(existingLine.clientId)
                  ? existingLine.clientName
                  : undefined;

                return (
                  <LookupField
                    size="sm"
                    label="Cliente"
                    name={clientField.name}
                    value={clientField.value}
                    selectedLabel={selectedLabel}
                    onChange={(value) => clientField.onChange(value)}
                    onBlur={clientField.onBlur}
                    placeholder={ticketInheritedLabel}
                    searchPlaceholder="Buscar cliente…"
                    clearLabel={ticketInheritedLabel}
                    search={searchClients}
                    resolveSelectedLabel={resolveClientLabel}
                    error={lineErrors?.clientId?.message}
                  />
                );
              }}
            />
          </div>

          {/* 4. Producto * */}
          <div className="lg:col-span-5">
            <Controller
              name={`lines.${index}.productId`}
              control={control}
              render={({ field: productField }) => (
                <LookupField
                  size="sm"
                  label="Producto"
                  required
                  name={productField.name}
                  value={productField.value}
                  onChange={(value) => productField.onChange(value)}
                  onBlur={productField.onBlur}
                  placeholder="Buscar producto…"
                  searchPlaceholder="Código o descripción…"
                  search={searchProducts}
                  resolveSelectedLabel={resolveProductLabel}
                  error={lineErrors?.productId?.message}
                />
              )}
            />
          </div>
        </div>

        {/* Fila 2: Problemática, Cantidad, Nota de Crédito y Personal (12 columnas) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-12 gap-3 items-start pt-2 border-t border-zinc-100/90">
          {/* 5. Problemática (Faltante / Sobrante) */}
          <div className="lg:col-span-2">
            <Controller
              name={`lines.${index}.discrepancyType`}
              control={control}
              render={({ field }) => (
                <SelectField
                  size="sm"
                  label="Problemática"
                  required
                  name={field.name}
                  value={field.value}
                  onChange={(val) => {
                    field.onChange(val);
                    if (val === "sobrante") {
                      setValue(`lines.${index}.qualifies`, "no");
                      setValue(`lines.${index}.creditNoteNumber`, "");
                    }
                  }}
                  onBlur={field.onBlur}
                  options={DISCREPANCY_TYPE_OPTIONS}
                  error={lineErrors?.discrepancyType?.message}
                />
              )}
            />
          </div>

          {/* 6. Cantidad */}
          <div className="lg:col-span-2">
            <TextField
              size="sm"
              label="Cantidad"
              required
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              className="text-center font-mono"
              placeholder="0"
              error={lineErrors?.quantity?.message}
              {...register(`lines.${index}.quantity`)}
            />
          </div>

          {/* 7. ¿Cumple para N/C? */}
          <div className="lg:col-span-2">
            <Controller
              name={`lines.${index}.qualifies`}
              control={control}
              render={({ field: qualifiesField }) => (
                <SelectField
                  size="sm"
                  label="¿Cumple N/C?"
                  name={qualifiesField.name}
                  value={qualifiesField.value}
                  onChange={(val) => {
                    qualifiesField.onChange(val);
                    if (val !== "si") {
                      setValue(`lines.${index}.creditNoteNumber`, "");
                    }
                  }}
                  onBlur={qualifiesField.onBlur}
                  options={QUALIFIES_OPTIONS}
                  error={lineErrors?.qualifies?.message}
                />
              )}
            />
          </div>

          {/* 8. # N/C */}
          <div className="lg:col-span-2">
            <Controller
              name={`lines.${index}.qualifies`}
              control={control}
              render={({ field: qualifiesField }) => {
                const isQualifies = qualifiesField.value === "si";
                return (
                  <TextField
                    size="sm"
                    label="# N/C"
                    disabled={!isQualifies}
                    placeholder={isQualifies ? "NC-00124" : "Si cumple N/C"}
                    error={lineErrors?.creditNoteNumber?.message}
                    {...register(`lines.${index}.creditNoteNumber`)}
                  />
                );
              }}
            />
          </div>

          {/* 9. Despachador * */}
          <div className="lg:col-span-2">
            <TextField
              size="sm"
              label="Despachador"
              required
              placeholder="Nombre despachador"
              error={lineErrors?.dispatcherName?.message}
              {...register(`lines.${index}.dispatcherName`)}
            />
          </div>

          {/* 10. Supervisor */}
          <div className="lg:col-span-2">
            <TextField
              size="sm"
              label="Supervisor"
              placeholder="Supervisor (opcional)"
              error={lineErrors?.supervisorName?.message}
              {...register(`lines.${index}.supervisorName`)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
