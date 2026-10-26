import { Plus } from "lucide-react";
import type {
  Control,
  FieldArrayWithId,
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
} from "react-hook-form";
import { Button } from "../../../components/ui/Button";
import { TextAreaField } from "../../../components/ui/Field";
import { FormDivider } from "../../../components/ui/FormDivider";
import type { LoadDiscrepancy } from "../../../types/discrepancies";
import type { FormValues } from "./discrepancyForm";
import { DiscrepancyLineCard } from "./DiscrepancyLineCard";

interface DiscrepancyLinesStepProps {
  control: Control<FormValues>;
  register: UseFormRegister<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  errors: FieldErrors<FormValues>;
  fields: FieldArrayWithId<FormValues, "lines", "id">[];
  /** Ausente = alta. */
  discrepancy?: LoadDiscrepancy;
  effectiveTicketClientName: string | undefined;
  effectiveTicketClientId: number | undefined;
  ticketInheritedLabel: string;
  noteValue: string;
  remove: (index: number) => void;
  onAddLine: () => void;
}

/** Paso 2: Lineas en Discrepancia y Nota Operativa (Diseno en Fichas Estructuradas sin Scroll) */
export function DiscrepancyLinesStep({
  control,
  register,
  setValue,
  errors,
  fields,
  discrepancy,
  effectiveTicketClientName,
  effectiveTicketClientId,
  ticketInheritedLabel,
  noteValue,
  remove,
  onAddLine,
}: DiscrepancyLinesStepProps) {
  return (
    <div className="flex flex-col gap-4 animate-plf-fade">
      <div className="flex items-center justify-between">
        <FormDivider title="Líneas en discrepancia (Formato PF-FOR-291)" />
        <span className="text-xs font-medium text-zinc-400 select-none">
          {fields.length} {fields.length === 1 ? "línea registrada" : "líneas registradas"}
        </span>
      </div>

      {/* Lista de Fichas de Líneas - 100% visible sin scroll horizontal */}
      <div className="flex flex-col gap-3.5">
        {fields.map((field, index) => {
          const lineErrors = errors.lines?.[index];
          const existingLine = discrepancy?.lines?.[index];

          return (
            <DiscrepancyLineCard
              key={field.id}
              index={index}
              control={control}
              register={register}
              setValue={setValue}
              lineErrors={lineErrors}
              existingLine={existingLine}
              ticketClientName={effectiveTicketClientName}
              ticketClientId={effectiveTicketClientId}
              ticketInheritedLabel={ticketInheritedLabel}
              canRemove={fields.length > 1}
              onRemove={() => remove(index)}
            />
          );
        })}
      </div>

      {/* Pie con botón agregar línea */}
      <div className="flex items-center justify-between pt-1">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={onAddLine}
        >
          <Plus className="h-3.5 w-3.5 text-zinc-500" />
          <span>Agregar otra línea</span>
        </Button>
      </div>

      {/* SECCIÓN DE LA NOTA (según PF-FOR-291) */}
      <div className="mt-2 flex flex-col gap-1.5">
        <FormDivider title="Uso interno" />
        <TextAreaField
          id="discrepancy-notes"
          label="Notas operativas"
          rows={3}
          className="text-[12.5px] py-2"
          placeholder="Observaciones de entrega, horarios de recepción, particularidades de la carga, precinto o contenedor…"
          hint={
            <span className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>Contexto de la carga, contenedor o precinto</span>
              <span
                className={`tabular-nums ${
                  noteValue.length > 3800 ? "text-brand-red font-medium" : ""
                }`}
              >
                {noteValue.length} / 4000
              </span>
            </span>
          }
          error={errors.note?.message}
          {...register("note")}
        />
      </div>
    </div>
  );
}
