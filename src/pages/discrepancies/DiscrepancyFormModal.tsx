import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { discrepanciesApi } from "../../api/discrepancies";
import { ProductLookupField } from "../../components/app/ProductLookupField";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { LookupField, SelectField, TextAreaField, TextField } from "../../components/ui/Field";
import { FormSection } from "../../components/ui/FormSection";
import { Modal } from "../../components/ui/Modal";
import { RowAction } from "../../components/ui/RowAction";
import { resolveTicketLabel, searchTickets, toNumber } from "../../lib/discrepancies";
import { resolveClientLabel, searchClients } from "../../lib/lookups";
import type { DiscrepancyDetail, LoadDiscrepancy } from "../../types/discrepancies";

const quantity = z
  .string()
  .trim()
  .refine((value) => value === "" || (!Number.isNaN(Number(value)) && Number(value) >= 0), "Número de cero en adelante")
  .refine((value) => value === "" || Number((Number(value) * 100).toFixed(6)) % 1 === 0, "Hasta dos decimales");

// Espejo de DiscrepancyRules.ValidateLines (docs/plan/06, sección 13).
const lineSchema = z
  .object({
    productId: z.string().min(1, "Elige el producto"),
    invoiceRef: z.string().trim().min(1, "Indica la factura").max(40, "Máximo 40 caracteres"),
    claimRef: z.string().trim().max(20, "Máximo 20 caracteres"),
    clientId: z.string(),
    surplusQuantity: quantity,
    shortageQuantity: quantity,
    qualifies: z.enum(["", "si", "no"]),
    creditNoteNumber: z.string().trim().max(20, "Máximo 20 caracteres"),
    dispatcherName: z.string().trim().min(3, "Escribe el despachador: al menos 3 caracteres").max(160, "Máximo 160 caracteres"),
    supervisorName: z.string().trim().max(160, "Máximo 160 caracteres"),
  })
  .superRefine((line, ctx) => {
    const surplus = toNumber(line.surplusQuantity);
    const shortage = toNumber(line.shortageQuantity);
    if (surplus > 0 && shortage > 0) {
      ctx.addIssue({ code: "custom", path: ["shortageQuantity"], message: "Sobrante o faltante, no ambos" });
    }
    if (surplus === 0 && shortage === 0) {
      ctx.addIssue({ code: "custom", path: ["surplusQuantity"], message: "Indica el sobrante o el faltante" });
    }
    if (line.creditNoteNumber !== "" && line.qualifies !== "si") {
      ctx.addIssue({ code: "custom", path: ["creditNoteNumber"], message: "Solo en una línea apta para nota de crédito" });
    }
  });

const schema = z.object({
  ticketId: z.string().min(1, "Elige el ticket"),
  note: z.string().trim().max(4000, "Máximo 4000 caracteres"),
  lines: z.array(lineSchema),
});

type FormValues = z.infer<typeof schema>;
type LineValues = FormValues["lines"][number];

const emptyLine = (): LineValues => ({
  productId: "",
  invoiceRef: "",
  claimRef: "",
  clientId: "",
  surplusQuantity: "",
  shortageQuantity: "",
  qualifies: "",
  creditNoteNumber: "",
  dispatcherName: "",
  supervisorName: "",
});

const QUALIFIES = [
  { value: "", label: "Sin decidir" },
  { value: "si", label: "Sí" },
  { value: "no", label: "No" },
];

interface DiscrepancyFormModalProps {
  /** Ausente = alta. */
  discrepancy?: LoadDiscrepancy;
  /** Ticket fijado de antemano (alta desde un ticket concreto). */
  ticketId?: number;
  initialData?: {
    note?: string;
    lines?: Array<{
      productId: string;
      invoiceRef?: string;
      clientId?: string;
      surplusQuantity?: string;
      shortageQuantity?: string;
    }>;
  };
  onClose: () => void;
  onSaved: (detail: DiscrepancyDetail) => void;
}

/**
 * RF-D1 y RF-D2: la investigación con sus líneas. Los puntos de seguridad se
 * responden en la ficha, no aquí: son nueve preguntas de una lista, no campos
 * de un formulario de alta.
 */
export function DiscrepancyFormModal({ discrepancy, ticketId, initialData, onClose, onSaved }: DiscrepancyFormModalProps) {
  const isEdit = discrepancy !== undefined;
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      ticketId: discrepancy ? String(discrepancy.ticketId) : ticketId ? String(ticketId) : "",
      note: discrepancy?.note ?? initialData?.note ?? "",
      lines: discrepancy && discrepancy.lines.length > 0
        ? discrepancy.lines.map((line) => ({
            productId: String(line.productId),
            invoiceRef: line.invoiceRef,
            claimRef: line.claimRef ?? "",
            clientId: String(line.clientId),
            surplusQuantity: line.surplusQuantity === 0 ? "" : String(line.surplusQuantity),
            shortageQuantity: line.shortageQuantity === 0 ? "" : String(line.shortageQuantity),
            qualifies: line.qualifiesForCreditNote === null ? "" : line.qualifiesForCreditNote ? "si" : "no",
            creditNoteNumber: line.creditNoteNumber ?? "",
            dispatcherName: line.dispatcherName,
            supervisorName: line.supervisorName ?? "",
          }))
        : initialData?.lines && initialData.lines.length > 0
        ? initialData.lines.map((l) => ({
            ...emptyLine(),
            productId: l.productId,
            invoiceRef: l.invoiceRef ?? "",
            clientId: l.clientId ?? "",
            surplusQuantity: l.surplusQuantity ?? "",
            shortageQuantity: l.shortageQuantity ?? "",
          }))
        : [emptyLine()],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const blank = (value: string) => (value.trim() === "" ? null : value.trim());

    const request = {
      note: blank(values.note),
      lines: values.lines.map((line) => ({
        productId: Number(line.productId),
        invoiceRef: line.invoiceRef.trim(),
        claimRef: blank(line.claimRef),
        clientId: line.clientId === "" ? null : Number(line.clientId),
        surplusQuantity: toNumber(line.surplusQuantity),
        shortageQuantity: toNumber(line.shortageQuantity),
        qualifiesForCreditNote: line.qualifies === "" ? null : line.qualifies === "si",
        creditNoteNumber: blank(line.creditNoteNumber),
        dispatcherName: line.dispatcherName.trim(),
        dispatcherStaffId: null,
        supervisorName: blank(line.supervisorName),
        supervisorStaffId: null,
      })),
      checks: null,
    };

    try {
      const saved = isEdit
        ? await discrepanciesApi.update(discrepancy.id, request)
        : await discrepanciesApi.create(Number(values.ticketId), request);
      onSaved(saved);
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : isEdit ? "No se pudo guardar la investigación" : "No se pudo crear la investigación");
    }
  }

  return (
    <Modal
      title={isEdit ? `Editar ${discrepancy.number}` : "Nueva investigación de discrepancia"}
      eyebrow="PF-FOR-291"
      description={
        isEdit
          ? "Líneas y nota. Los puntos de seguridad se responden en la ficha."
          : "Ligada a un ticket. Cliente y número de reclamo se toman del ticket cuando la línea no los trae."
      }
      onClose={onClose}
      maxWidth="max-w-3xl"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="discrepancy-form" isLoading={isSubmitting}>
            {isEdit ? "Guardar cambios" : "Crear investigación"}
          </Button>
        </>
      }
    >
      <form id="discrepancy-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        {formError && <Alert variant="error">{formError}</Alert>}

        <FormSection title="Origen">
          <Controller
            name="ticketId"
            control={control}
            render={({ field }) => (
              <LookupField
                label="Ticket"
                required
                name={field.name}
                value={field.value}
                onChange={(value) => field.onChange(value)}
                onBlur={field.onBlur}
                placeholder="Elige el ticket de la discrepancia"
                searchPlaceholder="Número, asunto o cliente…"
                search={searchTickets}
                resolveSelectedLabel={resolveTicketLabel}
                disabled={isEdit || ticketId !== undefined}
                error={errors.ticketId?.message}
              />
            )}
          />
          <TextAreaField
            label="Nota"
            rows={2}
            placeholder="Opcional: contexto de la carga, contenedor, fecha"
            error={errors.note?.message}
            {...register("note")}
          />
        </FormSection>

        <FormSection
          title="Líneas en discrepancia"
          hint="Una por producto. Sobrante o faltante, no ambos; el papel tiene seis renglones y aquí no hay tope."
        >
          <div className="flex flex-col gap-3">
            {fields.map((field, index) => {
              const lineError = errors.lines?.[index];
              return (
                <div key={field.id} className="rounded-edge border border-line bg-canvas/60 p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <Controller
                        name={`lines.${index}.productId`}
                        control={control}
                        render={({ field: productField }) => (
                          <ProductLookupField
                            label={`Producto ${index + 1}`}
                            required
                            name={productField.name}
                            value={productField.value}
                            onChange={(value) => productField.onChange(value)}
                            onBlur={productField.onBlur}
                            error={lineError?.productId?.message}
                          />
                        )}
                      />
                    </div>
                    {fields.length > 1 && (
                      <div className="pt-6">
                        <RowAction label={`Quitar la línea ${index + 1}`} icon={Trash2} danger onClick={() => remove(index)} />
                      </div>
                    )}
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <TextField
                      label="Factura"
                      required
                      error={lineError?.invoiceRef?.message}
                      {...register(`lines.${index}.invoiceRef`)}
                    />
                    <TextField
                      label="# Reclamo"
                      placeholder="El del ticket"
                      error={lineError?.claimRef?.message}
                      {...register(`lines.${index}.claimRef`)}
                    />
                    <Controller
                      name={`lines.${index}.clientId`}
                      control={control}
                      render={({ field: clientField }) => (
                        <LookupField
                          label="Cliente"
                          name={clientField.name}
                          value={clientField.value}
                          onChange={(value) => clientField.onChange(value)}
                          onBlur={clientField.onBlur}
                          placeholder="El del ticket"
                          searchPlaceholder="Buscar cliente…"
                          clearLabel="El del ticket"
                          search={searchClients}
                          resolveSelectedLabel={resolveClientLabel}
                        />
                      )}
                    />
                  </div>

                  <div className="mt-2 grid grid-cols-4 gap-2">
                    <TextField
                      label="Cantidad sobrante"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      error={lineError?.surplusQuantity?.message}
                      {...register(`lines.${index}.surplusQuantity`)}
                    />
                    <TextField
                      label="Cantidad faltante"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      error={lineError?.shortageQuantity?.message}
                      {...register(`lines.${index}.shortageQuantity`)}
                    />
                    <Controller
                      name={`lines.${index}.qualifies`}
                      control={control}
                      render={({ field: qualifiesField }) => (
                        <SelectField
                          label="¿Cumple para nota de crédito?"
                          name={qualifiesField.name}
                          value={qualifiesField.value}
                          onChange={qualifiesField.onChange}
                          onBlur={qualifiesField.onBlur}
                          options={QUALIFIES}
                        />
                      )}
                    />
                    <TextField
                      label="# N C"
                      placeholder="Nota emitida"
                      error={lineError?.creditNoteNumber?.message}
                      {...register(`lines.${index}.creditNoteNumber`)}
                    />
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <TextField
                      label="Despachador"
                      required
                      placeholder="Nombre de quien despachó"
                      error={lineError?.dispatcherName?.message}
                      {...register(`lines.${index}.dispatcherName`)}
                    />
                    <TextField
                      label="Supervisor"
                      placeholder="Opcional"
                      error={lineError?.supervisorName?.message}
                      {...register(`lines.${index}.supervisorName`)}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div>
            <Button type="button" size="sm" variant="secondary" onClick={() => append(emptyLine())}>
              <Plus className="h-[14px] w-[14px]" />
              Otra línea
            </Button>
          </div>
        </FormSection>
      </form>
    </Modal>
  );
}
