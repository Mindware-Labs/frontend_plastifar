import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { claimsApi } from "../../api/claims";
import { ApiError } from "../../api/client";
import { fetchAllPages } from "../../api/paging";
import { settingsApi } from "../../api/settings";
import { LineItemCard } from "../../components/app/LineItemCard";
import { ProductLookupField } from "../../components/app/ProductLookupField";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { CheckboxField, SelectField, TextAreaField, TextField, type FieldState } from "../../components/ui/Field";
import { FormModalFooter } from "../../components/ui/FormModalFooter";
import { FormSection } from "../../components/ui/FormSection";
import { Modal } from "../../components/ui/Modal";
import { computeLine, computeTotal } from "../../lib/claims";
import { formatAmount, toNumberOrNull } from "../../lib/numbers";
import { today } from "../../lib/quality";
import { hasAtMostDecimals } from "../../lib/validation";
import {
  CLAIM_AREAS,
  CLAIM_CURRENCIES,
  CLAIM_DEFECT_MOMENTS,
  CLAIM_REASONS,
  type ClaimAffectedArea,
  type ClaimDefectFoundDuring,
  type ClaimDetail,
  type ClaimReason,
  type CustomerClaim,
} from "../../types/claims";
import type { Plant } from "../../types/settings";

/** Número opcional: vacío vale, pero lo escrito tiene que ser un número de cero en adelante. */
const quantity = (decimals: number, what: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || (!Number.isNaN(Number(value)) && Number(value) >= 0), `${what}: número de cero en adelante`)
    .refine(hasAtMostDecimals(decimals), `${what}: hasta ${decimals} decimales`);

// Espejo de ClaimRules.Validate en el servidor (docs/plan/03, sección 13).
const schema = z
  .object({
    claimDate: z
      .string()
      .min(1, "Indica la fecha de la reclamación")
      .refine((value) => value <= today(), "La fecha no puede ser posterior a hoy"),
    country: z.string().trim().max(80, "Máximo 80 caracteres"),
    reason: z.string().min(1, "Elige el motivo del reclamo"),
    reasonOther: z.string().trim().max(200, "Máximo 200 caracteres"),
    affectedAreas: z.array(z.string()).min(1, "Marca al menos un área afectada"),
    plantIds: z.array(z.string()).min(1, "Marca al menos una planta involucrada"),
    productionLot: z.string().trim().max(80, "Máximo 80 caracteres"),
    invoiceRef: z.string().trim().max(40, "Máximo 40 caracteres"),
    poNumber: z.string().trim().max(40, "Máximo 40 caracteres"),
    unitsToReturn: quantity(2, "Unidades a retornar"),
    defectFoundDuring: z.string(),
    currency: z.string(),
    description: z
      .string()
      .trim()
      .min(20, "Describe la reclamación: al menos 20 caracteres")
      .max(4000, "Máximo 4000 caracteres"),
    comments: z.string().trim().max(4000, "Máximo 4000 caracteres"),
    receivedAt: z.string(),
    firstCustomerContactAt: z.string(),
    lines: z
      .array(
        z.object({
          productId: z.string().min(1, "Elige el producto"),
          unitsPurchased: quantity(2, "Compradas"),
          defectiveQuantity: quantity(2, "Defectuosas"),
          invoicedQuantity: quantity(2, "Facturados"),
          receivedQuantity: quantity(2, "Recibidos"),
          unitPrice: quantity(4, "Precio"),
        }),
      )
      .min(1, "Agrega al menos un producto reclamado"),
  })
  .superRefine((values, ctx) => {
    if (values.reason === "Otros" && values.reasonOther.length < 3) {
      ctx.addIssue({ code: "custom", path: ["reasonOther"], message: "Especifica el motivo: entre 3 y 200 caracteres" });
    }
    if (values.firstCustomerContactAt !== "" && values.firstCustomerContactAt < values.claimDate) {
      ctx.addIssue({
        code: "custom",
        path: ["firstCustomerContactAt"],
        message: "El primer contacto no puede ser anterior a la reclamación",
      });
    }
    const seen = new Set<string>();
    values.lines.forEach((line, index) => {
      if (line.productId !== "" && !seen.add(line.productId)) {
        ctx.addIssue({ code: "custom", path: ["lines", index, "productId"], message: "Este producto ya está en otra línea" });
      }
    });
    if (values.lines.some((line) => line.unitPrice !== "") && values.currency === "") {
      ctx.addIssue({ code: "custom", path: ["currency"], message: "Indica la moneda: alguna línea lleva precio" });
    }
  });

type FormValues = z.infer<typeof schema>;

const emptyLine = (): FormValues["lines"][number] => ({
  productId: "",
  unitsPurchased: "",
  defectiveQuantity: "",
  invoicedQuantity: "",
  receivedQuantity: "",
  unitPrice: "",
});

interface ClaimFormModalProps {
  /** Ticket al que se liga la reclamación (alta). */
  ticketId: number;
  ticketNumber: string;
  clientName: string;
  /** Ausente = alta. */
  claim?: CustomerClaim;
  initialData?: {
    invoiceRef?: string;
    description?: string;
    lines?: Array<{
      productId: string;
      unitsPurchased?: string;
      defectiveQuantity?: string;
      invoicedQuantity?: string;
      receivedQuantity?: string;
      unitPrice?: string;
    }>;
  };
  onClose: () => void;
  onSaved: (detail: ClaimDetail) => void;
}

const numberOrEmpty = (value: number | null) => (value === null ? "" : String(value));

/**
 * RF-R1, RF-R2 y RF-R3: las secciones I a III del PF-FOR-034, con las líneas
 * de producto y el cálculo en vivo de diferencia y total. El valor que se
 * guarda es el que calcula el servidor; lo de aquí es para ver mientras se
 * escribe (regla 6).
 */
export function ClaimFormModal({
  ticketId,
  ticketNumber,
  clientName,
  claim,
  initialData,
  onClose,
  onSaved,
}: ClaimFormModalProps) {
  const isEdit = claim !== undefined;
  const [formError, setFormError] = useState<string | null>(null);
  const [plants, setPlants] = useState<Plant[] | null>(null);

  // Las plantas son catálogo acotado (16 en la fuente): se recorren enteras.
  // Una planta desactivada después de marcarla sigue ofreciéndose en edición.
  useEffect(() => {
    fetchAllPages<Plant>((page, pageSize) => settingsApi.plants.list({ page, pageSize }))
      .then(setPlants)
      .catch(() => setPlants([]));
  }, []);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      claimDate: claim?.claimDate ?? today(),
      country: claim?.country ?? "",
      reason: claim?.reason ?? "",
      reasonOther: claim?.reasonOther ?? "",
      affectedAreas: claim?.affectedAreas ?? [],
      plantIds: claim?.plants.map((plant) => String(plant.id)) ?? [],
      productionLot: claim?.productionLot ?? "",
      invoiceRef: claim?.invoiceRef ?? initialData?.invoiceRef ?? "",
      poNumber: claim?.poNumber ?? "",
      unitsToReturn: numberOrEmpty(claim?.unitsToReturn ?? null),
      defectFoundDuring: claim?.defectFoundDuring ?? "",
      currency: claim?.currency ?? "DOP",
      description: claim?.description ?? initialData?.description ?? "",
      comments: claim?.comments ?? "",
      receivedAt: claim?.receivedAt ?? today(),
      firstCustomerContactAt: claim?.firstCustomerContactAt ?? "",
      lines: claim
        ? claim.lines.map((line) => ({
            productId: String(line.productId),
            unitsPurchased: numberOrEmpty(line.unitsPurchased),
            defectiveQuantity: numberOrEmpty(line.defectiveQuantity),
            invoicedQuantity: numberOrEmpty(line.invoicedQuantity),
            receivedQuantity: numberOrEmpty(line.receivedQuantity),
            unitPrice: numberOrEmpty(line.unitPrice),
          }))
        : initialData?.lines && initialData.lines.length > 0
        ? initialData.lines.map((line: any) => ({
            productId: String(line.productId),
            unitsPurchased: line.unitsPurchased ?? "",
            defectiveQuantity: line.defectiveQuantity ?? "",
            invoicedQuantity: line.invoicedQuantity ?? "",
            receivedQuantity: line.receivedQuantity ?? "",
            unitPrice: line.unitPrice ?? "",
          }))
        : [emptyLine()],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

  const reason = useWatch({ control, name: "reason" });
  const currency = useWatch({ control, name: "currency" });
  const lines = useWatch({ control, name: "lines" });

  /** Diferencia y total por línea mientras se escribe, con la misma fórmula del servidor. */
  const figures = useMemo(
    () =>
      (lines ?? []).map((line) =>
        computeLine(
          toNumberOrNull(line.invoicedQuantity),
          toNumberOrNull(line.receivedQuantity),
          toNumberOrNull(line.unitPrice),
        ),
      ),
    [lines],
  );
  const total = computeTotal(figures);
  const anyPrice = (lines ?? []).some((line) => line.unitPrice.trim() !== "");

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const blank = (value: string) => (value.trim() === "" ? null : value.trim());

    const request = {
      claimDate: values.claimDate,
      country: blank(values.country),
      reason: values.reason as ClaimReason,
      reasonOther: values.reason === "Otros" ? blank(values.reasonOther) : null,
      affectedAreas: values.affectedAreas as ClaimAffectedArea[],
      plantIds: values.plantIds.map(Number),
      productionLot: blank(values.productionLot),
      invoiceRef: blank(values.invoiceRef),
      poNumber: blank(values.poNumber),
      unitsToReturn: toNumberOrNull(values.unitsToReturn),
      defectFoundDuring: values.defectFoundDuring === "" ? null : (values.defectFoundDuring as ClaimDefectFoundDuring),
      currency: anyPrice || values.currency !== "" ? values.currency : null,
      description: values.description.trim(),
      comments: blank(values.comments),
      receivedAt: values.receivedAt === "" ? null : values.receivedAt,
      firstCustomerContactAt: values.firstCustomerContactAt === "" ? null : values.firstCustomerContactAt,
      lines: values.lines.map((line) => ({
        productId: Number(line.productId),
        unitsPurchased: toNumberOrNull(line.unitsPurchased),
        defectiveQuantity: toNumberOrNull(line.defectiveQuantity),
        invoicedQuantity: toNumberOrNull(line.invoicedQuantity),
        receivedQuantity: toNumberOrNull(line.receivedQuantity),
        unitPrice: toNumberOrNull(line.unitPrice),
      })),
    };

    try {
      const saved = isEdit
        ? await claimsApi.update(claim.id, request)
        : await claimsApi.create(ticketId, request);
      onSaved(saved);
      onClose();
    } catch (err) {
      const fallback = isEdit ? "No se pudo guardar la reclamación" : "No se pudo registrar la reclamación";
      setFormError(err instanceof ApiError ? err.message : fallback);
    }
  }

  const lineErrors = errors.lines;

  return (
    <Modal
      title={isEdit ? `Editar reclamación de ${ticketNumber}` : `Registrar reclamación de ${ticketNumber}`}
      description={
        isEdit
          ? "PF-FOR-034 · Secciones I a III. El tratamiento de Calidad se edita aparte, desde la ficha."
          : `PF-FOR-034 · Para ${clientName}. Empresa, contacto y teléfonos se toman del ticket; aquí va lo que el ticket no tiene: productos, lote, cantidades y monto.`
      }
      onClose={onClose}
      size="2xl"
      footer={
        <FormModalFooter
          formId="claim-form"
          isEdit={isEdit}
          createLabel="Registrar reclamación"
          isSubmitting={isSubmitting}
          onCancel={onClose}
        />
      }
    >
      <form id="claim-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        {formError && <Alert variant="error">{formError}</Alert>}

        <FormSection title="I. Información general" hint="Cuándo y desde dónde reclama el cliente.">
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Fecha de la reclamación"
              type="date"
              required
              max={today()}
              state={stateOf("claimDate")}
              error={errors.claimDate?.message}
              {...register("claimDate")}
            />
            <TextField
              label="País"
              placeholder="Opcional"
              state={stateOf("country")}
              error={errors.country?.message}
              {...register("country")}
            />
          </div>
        </FormSection>

        <FormSection title="II. Sobre la reclamación">
          <div className="grid grid-cols-2 gap-3">
            <Controller
              name="reason"
              control={control}
              render={({ field }) => (
                <SelectField
                  label="Motivo del reclamo"
                  required
                  name={field.name}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="Elige uno"
                  options={CLAIM_REASONS.map((value) => ({ value, label: value }))}
                  state={stateOf("reason")}
                  error={errors.reason?.message}
                />
              )}
            />
            {reason === "Otros" ? (
              <TextField
                label="Otros (especifique)"
                required
                placeholder="Qué se reclama"
                state={stateOf("reasonOther")}
                error={errors.reasonOther?.message}
                {...register("reasonOther")}
              />
            ) : (
              <Controller
                name="defectFoundDuring"
                control={control}
                render={({ field }) => (
                  <SelectField
                    label="Defecto identificado durante"
                    name={field.name}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="Sin indicar"
                    options={CLAIM_DEFECT_MOMENTS.map((value) => ({ value, label: value }))}
                    error={errors.defectFoundDuring?.message}
                  />
                )}
              />
            )}
          </div>

          {reason === "Otros" && (
            <Controller
              name="defectFoundDuring"
              control={control}
              render={({ field }) => (
                <SelectField
                  label="Defecto identificado durante"
                  name={field.name}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="Sin indicar"
                  options={CLAIM_DEFECT_MOMENTS.map((value) => ({ value, label: value }))}
                  error={errors.defectFoundDuring?.message}
                />
              )}
            />
          )}

          <Controller
            name="plantIds"
            control={control}
            render={({ field }) => (
              <fieldset>
                <legend className="mb-1.5 font-heading text-[10.5px] font-medium uppercase tracking-[0.06em] text-faint">
                  Planta involucrada <span className="text-brand-red">*</span>
                </legend>
                {plants === null ? (
                  <p className="text-[12.5px] text-faint">Cargando plantas…</p>
                ) : plants.length === 0 ? (
                  <p className="text-[12.5px] text-warn">
                    No hay plantas en el catálogo. Cárgalas en Configuración › Plantas antes de registrar la reclamación.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {plants
                      .filter((plant) => plant.isActive || field.value.includes(String(plant.id)))
                      .map((plant) => {
                        const id = String(plant.id);
                        const checked = field.value.includes(id);
                        return (
                          <CheckboxField
                            key={plant.id}
                            label={plant.name}
                            description={plant.country}
                            checked={checked}
                            onBlur={field.onBlur}
                            onChange={() =>
                              field.onChange(
                                checked ? field.value.filter((value) => value !== id) : [...field.value, id],
                              )
                            }
                          />
                        );
                      })}
                  </div>
                )}
                {errors.plantIds && <p className="mt-1.5 text-[12px] text-brand-red">{errors.plantIds.message}</p>}
              </fieldset>
            )}
          />

          <Controller
            name="affectedAreas"
            control={control}
            render={({ field }) => (
              <fieldset>
                <legend className="mb-1.5 font-heading text-[10.5px] font-medium uppercase tracking-[0.06em] text-faint">
                  Área afectada <span className="text-brand-red">*</span>
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  {CLAIM_AREAS.map((area) => {
                    const checked = field.value.includes(area);
                    return (
                      <CheckboxField
                        key={area}
                        label={area}
                        checked={checked}
                        onBlur={field.onBlur}
                        onChange={() =>
                          field.onChange(
                            checked ? field.value.filter((value) => value !== area) : [...field.value, area],
                          )
                        }
                      />
                    );
                  })}
                </div>
                {errors.affectedAreas && (
                  <p className="mt-1.5 text-[12px] text-brand-red">{errors.affectedAreas.message}</p>
                )}
              </fieldset>
            )}
          />

          <div className="grid grid-cols-3 gap-3">
            <TextField
              label="Fecha de producción (# lote)"
              placeholder="Como viene en el empaque"
              state={stateOf("productionLot")}
              error={errors.productionLot?.message}
              {...register("productionLot")}
            />
            <TextField
              label="Factura"
              placeholder="Ej. B0100004471"
              state={stateOf("invoiceRef")}
              error={errors.invoiceRef?.message}
              {...register("invoiceRef")}
            />
            <TextField
              label="Número de PO"
              placeholder="Orden de compra"
              state={stateOf("poNumber")}
              error={errors.poNumber?.message}
              {...register("poNumber")}
            />
          </div>

          {/* Líneas de producto: el papel trae tres renglones y admite ampliarlos (regla 7). */}
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="font-heading text-[10.5px] font-medium uppercase tracking-[0.06em] text-faint">
                Productos reclamados <span className="text-brand-red">*</span>
              </span>
              <span className="text-[11.5px] text-faint">Diferencia = facturados − recibidos · Total = diferencia × precio</span>
            </div>

            {typeof lineErrors?.message === "string" && (
              <p className="text-[12px] text-brand-red">{lineErrors.message}</p>
            )}

            <div className="flex flex-col gap-3">
              {fields.map((field, index) => {
                const lineError = lineErrors?.[index];
                const figure = figures[index] ?? { difference: 0, lineTotal: 0 };
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
                            onChange={(value) => productField.onChange(value)}
                            onBlur={productField.onBlur}
                            error={lineError?.productId?.message}
                          />
                        )}
                      />
                    }
                  >
                    <div className="mt-2 grid grid-cols-5 gap-2">
                      <TextField
                        label="Compradas"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        error={lineError?.unitsPurchased?.message}
                        {...register(`lines.${index}.unitsPurchased`)}
                      />
                      <TextField
                        label="Defectuosas"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        error={lineError?.defectiveQuantity?.message}
                        {...register(`lines.${index}.defectiveQuantity`)}
                      />
                      <TextField
                        label="Facturados"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        error={lineError?.invoicedQuantity?.message}
                        {...register(`lines.${index}.invoicedQuantity`)}
                      />
                      <TextField
                        label="Recibidos"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        error={lineError?.receivedQuantity?.message}
                        {...register(`lines.${index}.receivedQuantity`)}
                      />
                      <TextField
                        label="Precio"
                        type="number"
                        min="0"
                        step="0.0001"
                        inputMode="decimal"
                        error={lineError?.unitPrice?.message}
                        {...register(`lines.${index}.unitPrice`)}
                      />
                    </div>

                    <div className="mt-2 flex items-center justify-end gap-5 text-[12px] tabular-nums text-brand-gray">
                      <span>
                        Dif. <strong className="font-semibold text-ink">{figure.difference}</strong>
                      </span>
                      <span>
                        Total{" "}
                        <strong className="font-semibold text-ink">
                          {currency ? formatAmount(figure.lineTotal, currency) : figure.lineTotal}
                        </strong>
                      </span>
                    </div>
                  </LineItemCard>
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <Button type="button" size="sm" variant="secondary" onClick={() => append(emptyLine())}>
                <Plus className="h-[14px] w-[14px]" />
                Otro producto
              </Button>
              <span className="text-[13px] text-brand-gray">
                Total de la reclamación{" "}
                <strong className="font-heading text-[14px] font-bold tabular-nums text-ink">
                  {currency ? formatAmount(total, currency) : total}
                </strong>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Cantidad de unidades a retornar"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="Opcional"
              state={stateOf("unitsToReturn")}
              error={errors.unitsToReturn?.message}
              {...register("unitsToReturn")}
            />
            <Controller
              name="currency"
              control={control}
              render={({ field }) => (
                <SelectField
                  label="Moneda"
                  required={anyPrice}
                  name={field.name}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  options={CLAIM_CURRENCIES.map((value) => ({ value, label: value }))}
                  error={errors.currency?.message}
                  hint={anyPrice ? undefined : "Solo cuenta si alguna línea lleva precio."}
                />
              )}
            />
          </div>
        </FormSection>

        <FormSection title="III. Descripción de la reclamación">
          <TextAreaField
            label="Descripción"
            required
            rows={4}
            placeholder="Qué recibió el cliente, qué esperaba y qué pide"
            error={errors.description?.message}
            {...register("description")}
          />
          <TextAreaField
            label="Comentarios"
            rows={2}
            placeholder="Opcional"
            error={errors.comments?.message}
            {...register("comments")}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Fecha de quien recibe"
              type="date"
              max={today()}
              hint="En blanco: hoy."
              error={errors.receivedAt?.message}
              {...register("receivedAt")}
            />
            <TextField
              label="Primer contacto con el cliente"
              type="date"
              hint="Opcional. No anterior a la reclamación."
              error={errors.firstCustomerContactAt?.message}
              {...register("firstCustomerContactAt")}
            />
          </div>
        </FormSection>
      </form>
    </Modal>
  );
}
