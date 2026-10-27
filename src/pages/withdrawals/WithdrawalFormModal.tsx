import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { withdrawalsApi } from "../../api/withdrawals";
import { LineItemCard } from "../../components/app/LineItemCard";
import { ProductLookupField } from "../../components/app/ProductLookupField";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { LookupField, SelectField, TextField } from "../../components/ui/Field";
import { FormModalFooter } from "../../components/ui/FormModalFooter";
import { FormSection } from "../../components/ui/FormSection";
import { Modal } from "../../components/ui/Modal";
import { resolveTicketLabel, searchTickets } from "../../lib/discrepancies";
import { formatAmountOrPlain, toNumberOrNull } from "../../lib/numbers";
import { today } from "../../lib/quality";
import { hasAtMostDecimals } from "../../lib/validation";
import { computeLineValue, computeTotal, MAX_LINE_INPUT, MAX_WITHDRAWAL_AMOUNT } from "../../lib/withdrawals";
import {
  WITHDRAWAL_CURRENCIES,
  WITHDRAWAL_ERROR_ORIGINS,
  WITHDRAWAL_REASONS,
  type MerchandiseWithdrawal,
  type WithdrawalDetail,
  type WithdrawalErrorOrigin,
  type WithdrawalReason,
} from "../../types/withdrawals";

// Espejo de WithdrawalRules.Validate (docs/plan/04, sección 13).
const lineSchema = z.object({
  productId: z.string().min(1, "Elige el producto"),
  quantity: z
    .string()
    .trim()
    .refine((value) => value !== "" && !Number.isNaN(Number(value)) && Number(value) > 0, "Mayor que cero")
    .refine((value) => !(Number(value) > MAX_LINE_INPUT), "Máximo mil millones")
    .refine(hasAtMostDecimals(2), "Hasta dos decimales"),
  quantityUnit: z.string().trim().min(1, "Indica la unidad").max(10, "Máximo 10 caracteres"),
  packDetail: z.string().trim().max(20, "Máximo 20 caracteres"),
  unitPrice: z
    .string()
    .trim()
    .refine((value) => value === "" || (!Number.isNaN(Number(value)) && Number(value) >= 0), "Número de cero en adelante")
    .refine((value) => value === "" || !(Number(value) > MAX_LINE_INPUT), "Máximo mil millones")
    .refine(hasAtMostDecimals(4), "Hasta cuatro decimales"),
});

const schema = z
  .object({
    ticketId: z.string().min(1, "Elige el ticket"),
    requestDate: z
      .string()
      .min(1, "Indica la fecha de la solicitud")
      .refine((value) => value <= today(), "La fecha no puede ser posterior a hoy"),
    reason: z.string().min(1, "Elige el motivo del retiro"),
    errorOrigin: z.string(),
    currency: z.string(),
    lines: z.array(lineSchema).min(1, "Agrega al menos un producto a retirar"),
  })
  .superRefine((values, ctx) => {
    const seen = new Set<string>();
    values.lines.forEach((line, index) => {
      if (line.productId === "") return;
      if (seen.has(line.productId)) {
        ctx.addIssue({ code: "custom", path: ["lines", index, "productId"], message: "Un producto no puede repetirse" });
      }
      seen.add(line.productId);
    });
    if (values.lines.some((line) => line.unitPrice.trim() !== "") && values.currency === "") {
      ctx.addIssue({ code: "custom", path: ["currency"], message: "Indica la moneda: alguna línea lleva precio" });
    }

    // Espejo de WithdrawalRules.MaxAmount: cantidad y precio caben por separado y su producto no.
    const lineValues = values.lines.map((line) =>
      computeLineValue(toNumberOrNull(line.quantity), toNumberOrNull(line.unitPrice)),
    );
    lineValues.forEach((value, index) => {
      if (value !== null && value > MAX_WITHDRAWAL_AMOUNT) {
        ctx.addIssue({
          code: "custom",
          path: ["lines", index, "unitPrice"],
          message: "El valor de la línea es demasiado grande: revisa la cantidad y el precio",
        });
      }
    });
    if (lineValues.every((value) => value === null || value <= MAX_WITHDRAWAL_AMOUNT) && computeTotal(lineValues) > MAX_WITHDRAWAL_AMOUNT) {
      ctx.addIssue({
        code: "custom",
        path: ["lines"],
        message: "El valor total de la solicitud es demasiado grande: revisa las cantidades y los precios",
      });
    }
  });

type FormValues = z.infer<typeof schema>;
type LineValues = FormValues["lines"][number];

const emptyLine = (): LineValues => ({ productId: "", quantity: "", quantityUnit: "", packDetail: "", unitPrice: "" });

const REASON_OPTIONS = WITHDRAWAL_REASONS.map((value) => ({ value, label: value }));
const ORIGIN_OPTIONS = [
  { value: "", label: "Sin error de origen" },
  ...WITHDRAWAL_ERROR_ORIGINS.map((value) => ({ value, label: `Error de ${value === "Vendedor" ? "vendedor" : "almacén"}` })),
];
const CURRENCY_OPTIONS = [{ value: "", label: "Sin precio" }, ...WITHDRAWAL_CURRENCIES.map((value) => ({ value, label: value }))];

interface WithdrawalFormModalProps {
  /** Ausente = alta. */
  withdrawal?: MerchandiseWithdrawal;
  fixedTicketId?: number;
  fixedTicketLabel?: string;
  initialLines?: Array<{
    productId: string;
    quantity: string;
    quantityUnit: string;
    packDetail: string;
    unitPrice: string;
  }>;
  onClose: () => void;
  onSaved: (detail: WithdrawalDetail) => void;
  /**
   * 409: la solicitud cambió en el servidor (otro la decidió, la retiró o la
   * canceló). Quien abre el modal recarga la ficha y muestra el mensaje.
   */
  onConflict?: (message: string) => void;
}

/**
 * RF-W2: la solicitud con sus líneas. Se crea desde el listado eligiendo el
 * ticket; hereda el cliente del ticket.
 *
 * Integración diferida (docs/plan/02, módulo de tickets y tareas): RF-W1 pide
 * este mismo formulario como paso adicional del alta del ticket cuando aplica
 * la regla de enrutamiento «al crear el ticket». Ese paso vive en
 * CreateTicketModal, que es del módulo de tickets. Hoy el modal no recibe el
 * ticket: en alta lo elige el usuario con el campo «Ticket». Integrarlo pide
 * añadir una prop que fije ese campo, en lugar de duplicar el formulario.
 */
export function WithdrawalFormModal({
  withdrawal,
  fixedTicketId,
  fixedTicketLabel,
  initialLines,
  onClose,
  onSaved,
  onConflict,
}: WithdrawalFormModalProps) {
  const isEdit = withdrawal !== undefined;
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
      ticketId: withdrawal ? String(withdrawal.ticketId) : fixedTicketId ? String(fixedTicketId) : "",
      requestDate: withdrawal?.requestDate ?? today(),
      reason: withdrawal?.reason ?? "",
      errorOrigin: withdrawal?.errorOrigin ?? "",
      currency: withdrawal?.currency ?? "",
      lines:
        withdrawal && withdrawal.lines.length > 0
          ? withdrawal.lines.map((line) => ({
              productId: String(line.productId),
              quantity: String(line.quantity),
              quantityUnit: line.quantityUnit,
              packDetail: line.packDetail ?? "",
              unitPrice: line.unitPrice === null ? "" : String(line.unitPrice),
            }))
          : initialLines && initialLines.length > 0
          ? initialLines
          : [emptyLine()],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const watchedLines = useWatch({ control, name: "lines" });
  const watchedCurrency = useWatch({ control, name: "currency" });

  const values = (watchedLines ?? []).map((line) => computeLineValue(toNumberOrNull(line.quantity), toNumberOrNull(line.unitPrice)));
  const total = computeTotal(values);
  const anyPrice = values.some((value) => value !== null);

  async function onSubmit(form: FormValues) {
    setFormError(null);
    const blank = (value: string) => (value.trim() === "" ? null : value.trim());

    const request = {
      requestDate: form.requestDate,
      reason: form.reason as WithdrawalReason,
      errorOrigin: form.errorOrigin === "" ? null : (form.errorOrigin as WithdrawalErrorOrigin),
      currency: blank(form.currency),
      lines: form.lines.map((line) => ({
        productId: Number(line.productId),
        quantity: Number(line.quantity),
        quantityUnit: line.quantityUnit.trim(),
        packDetail: blank(line.packDetail),
        unitPrice: toNumberOrNull(line.unitPrice),
      })),
    };

    try {
      const saved = isEdit
        ? await withdrawalsApi.update(withdrawal.id, request)
        : await withdrawalsApi.create(Number(form.ticketId), request);
      onSaved(saved);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && onConflict) {
        // El diálogo se cierra y la ficha se recarga: lo escrito se pierde, y
        // el aviso tiene que decirlo además del motivo del servidor.
        onConflict(`Tus cambios no se guardaron. ${err.message}`);
        onClose();
        return;
      }
      setFormError(err instanceof ApiError ? err.message : isEdit ? "No se pudo guardar la solicitud" : "No se pudo crear la solicitud");
    }
  }

  return (
    <Modal
      title={isEdit ? `Editar ${withdrawal.number}` : "Nueva solicitud de retiro"}
      description={
        isEdit
          ? "PF-FOR-068 · Solo se edita mientras está solicitada. Firmas como vendedor quien la creó."
          : "PF-FOR-068 · Ligada a un ticket con cliente: la empresa se toma del ticket. Firmas como vendedor."
      }
      onClose={onClose}
      size="2xl"
      footer={
        <FormModalFooter
          formId="withdrawal-form"
          isEdit={isEdit}
          createLabel="Crear solicitud"
          isSubmitting={isSubmitting}
          onCancel={onClose}
        />
      }
    >
      <form id="withdrawal-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        {formError && <Alert variant="error">{formError}</Alert>}

        <FormSection title="Solicitud">
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
                placeholder="Elige el ticket del retiro"
                searchPlaceholder="Número, asunto o cliente…"
                search={searchTickets}
                resolveSelectedLabel={fixedTicketLabel ? async () => fixedTicketLabel : resolveTicketLabel}
                disabled={isEdit || Boolean(fixedTicketId)}
                error={errors.ticketId?.message}
              />
            )}
          />
          <div className="grid grid-cols-3 gap-3">
            <TextField
              label="Fecha"
              type="date"
              required
              max={today()}
              error={errors.requestDate?.message}
              {...register("requestDate")}
            />
            <Controller
              name="reason"
              control={control}
              render={({ field }) => (
                <SelectField
                  label="Motivo"
                  required
                  name={field.name}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="Elige el motivo"
                  options={REASON_OPTIONS}
                  error={errors.reason?.message}
                />
              )}
            />
            <Controller
              name="errorOrigin"
              control={control}
              render={({ field }) => (
                <SelectField
                  label="Origen del error"
                  name={field.name}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  options={ORIGIN_OPTIONS}
                  hint="Con origen de error, la solicitud se aprueba antes del retiro."
                />
              )}
            />
          </div>
        </FormSection>

        <FormSection
          title="Productos a retirar"
          hint="Una línea por producto. El precio es opcional; sin precio la línea no suma al valor. El papel tiene 15 renglones y aquí no hay tope."
        >
          {errors.lines?.root?.message && <Alert variant="error">{errors.lines.root.message}</Alert>}
          {errors.lines?.message && <Alert variant="error">{errors.lines.message}</Alert>}
          <div className="flex flex-col gap-3">
            {fields.map((field, index) => {
              const lineError = errors.lines?.[index];
              const value = values[index] ?? null;
              return (
                <LineItemCard
                  key={field.id}
                  index={index}
                  canRemove={fields.length > 1}
                  onRemove={() => remove(index)}
                  product={
                    <Controller
                      name={`lines.${index}.productId`}
                      control={control}
                      render={({ field: productField }) => (
                        <ProductLookupField
                          label={`Producto ${index + 1}`}
                          required
                          name={productField.name}
                          value={productField.value}
                          onChange={(next) => productField.onChange(next)}
                          onBlur={productField.onBlur}
                          error={lineError?.productId?.message}
                        />
                      )}
                    />
                  }
                >
                  <div className="mt-2 grid grid-cols-5 gap-2">
                    <TextField
                      label="Cantidad"
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      error={lineError?.quantity?.message}
                      {...register(`lines.${index}.quantity`)}
                    />
                    <TextField
                      label="Unidad"
                      required
                      placeholder="CAJ"
                      error={lineError?.quantityUnit?.message}
                      {...register(`lines.${index}.quantityUnit`)}
                    />
                    <TextField
                      label="Empaque"
                      placeholder="14PAQ"
                      error={lineError?.packDetail?.message}
                      {...register(`lines.${index}.packDetail`)}
                    />
                    <TextField
                      label="Precio unitario"
                      type="number"
                      min="0"
                      step="0.0001"
                      inputMode="decimal"
                      placeholder="Opcional"
                      error={lineError?.unitPrice?.message}
                      {...register(`lines.${index}.unitPrice`)}
                    />
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[12.5px] font-medium text-ink">Valor</span>
                      <span className="flex h-9 items-center justify-end text-[13px] tabular-nums text-brand-gray">
                        {value === null ? "—" : formatAmountOrPlain(value, watchedCurrency)}
                      </span>
                    </div>
                  </div>
                </LineItemCard>
              );
            })}
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <Button type="button" size="sm" variant="secondary" onClick={() => append(emptyLine())}>
              <Plus className="h-[14px] w-[14px]" />
              Otra línea
            </Button>
            <div className="flex items-end gap-3">
              <div className="w-[140px]">
                <Controller
                  name="currency"
                  control={control}
                  render={({ field }) => (
                    <SelectField
                      label="Moneda"
                      required={anyPrice}
                      size="sm"
                      name={field.name}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      options={CURRENCY_OPTIONS}
                      error={errors.currency?.message}
                    />
                  )}
                />
              </div>
              <p className="pb-1.5 text-[13px] text-brand-gray">
                Total{" "}
                <span className="font-semibold tabular-nums text-ink">{anyPrice ? formatAmountOrPlain(total, watchedCurrency) : "—"}</span>
              </p>
            </div>
          </div>
        </FormSection>
      </form>
    </Modal>
  );
}
