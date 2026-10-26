import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { claimsApi } from "../../api/claims";
import { ApiError } from "../../api/client";
import { fetchAllPages } from "../../api/paging";
import { settingsApi } from "../../api/settings";
import { ProductLookupField } from "../../components/app/ProductLookupField";
import { Logo } from "../../components/Logo";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import {
  CheckboxField,
  DateField,
  SelectField,
  TextAreaField,
  TextField,
  type FieldState,
} from "../../components/ui/Field";
import { FormSection } from "../../components/ui/FormSection";
import { Modal } from "../../components/ui/Modal";
import { RowAction } from "../../components/ui/RowAction";
import { CLAIM_FORM_CONTROL, computeLine, computeTotal } from "../../lib/claims";
import { formatPhoneNumber } from "../../lib/format";
import { formatAmount, toNumberOrNull } from "../../lib/numbers";
import { today } from "../../lib/quality";
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

const PHONE_CHARS_REGEX = /^[0-9+\s\-().extx]+$/i;

const optionalPhone = z
  .string()
  .trim()
  .max(30, "Máximo 30 caracteres")
  .refine((val) => {
    if (!val) return true;
    if (!PHONE_CHARS_REGEX.test(val)) return false;
    const digits = val.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15;
  }, "Teléfono inválido (mín. 10 dígitos)");

/** Número opcional: vacío vale, pero lo escrito tiene que ser un número de cero en adelante. */
const quantity = (decimals: number, what: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || (!Number.isNaN(Number(value)) && Number(value) >= 0), `${what}: número de cero en adelante`)
    .refine(
      (value) => value === "" || Number((Number(value) * 10 ** decimals).toFixed(6)) % 1 === 0,
      `${what}: hasta ${decimals} decimales`,
    );

// Espejo de ClaimRules.Validate en el servidor (docs/plan/03, sección 13).
const schema = z
  .object({
    claimDate: z
      .string()
      .min(1, "Indica la fecha de la reclamación")
      .refine((value) => value <= today(), "La fecha no puede ser posterior a hoy"),
    country: z.string().trim().max(80, "Máximo 80 caracteres"),
    contactName: z.string().trim().max(120, "Máximo 120 caracteres"),
    contactPhone: optionalPhone,
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

const STEP2_FIELDS = [
  "reason",
  "reasonOther",
  "affectedAreas",
  "plantIds",
  "productionLot",
  "invoiceRef",
  "poNumber",
  "defectFoundDuring",
] as const satisfies readonly (keyof FormValues)[];

const STEP3_FIELDS = ["lines"] as const satisfies readonly (keyof FormValues)[];

interface ClaimFormModalProps {
  /** Ticket al que se liga la reclamación (alta). */
  ticketId: number;
  ticketNumber: string;
  clientName: string;
  /** Del ticket; en edición prevalece lo guardado en la reclamación. */
  contactName?: string | null;
  contactPhone?: string | null;
  clientPhone?: string | null;
  clientContactPersonName?: string | null;
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
  contactName: contactNameProp,
  contactPhone: contactPhoneProp,
  clientPhone: clientPhoneProp,
  clientContactPersonName,
  claim,
  initialData,
  onClose,
  onSaved,
}: ClaimFormModalProps) {
  const isEdit = claim !== undefined;
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [plants, setPlants] = useState<Plant[] | null>(null);

  const suggestedContactName =
    claim?.contactName ?? contactNameProp ?? clientContactPersonName ?? "";
  const suggestedPhone = pickPhone(
    claim?.contactPhone,
    claim?.clientPhone,
    contactPhoneProp,
    clientPhoneProp,
  );

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
    trigger,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      claimDate: claim?.claimDate ?? today(),
      country: claim?.country ?? "",
      contactName: suggestedContactName,
      contactPhone: suggestedPhone ? formatPhoneNumber(suggestedPhone) : "",
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

  async function handleNextStep() {
    if (step === 1) {
      const ok = await trigger(["claimDate", "country", "contactName", "contactPhone"]);
      if (ok) setStep(2);
      return;
    }
    if (step === 2) {
      const ok = await trigger([...STEP2_FIELDS]);
      if (ok) setStep(3);
      return;
    }
    if (step === 3) {
      const ok = await trigger([...STEP3_FIELDS]);
      if (ok) setStep(4);
    }
  }

  const stepLabels: Record<typeof step, { title: string; hint: string }> = {
    1: { title: "Información general", hint: "Fecha, código y cliente" },
    2: { title: "Sobre la reclamación", hint: "Motivo, plantas y referencias" },
    3: { title: "Productos", hint: "Productos reclamados" },
    4: { title: "Descripción", hint: "Relato y fechas de recepción" },
  };

  const renderStepper = () => (
    <div className="flex w-full items-center justify-between max-w-3xl mx-auto select-none gap-0.5">
      {([1, 2, 3, 4] as const).map((n, idx) => (
        <Fragment key={n}>
          <button
            type="button"
            onClick={() => {
              if (n <= step) setStep(n);
            }}
            disabled={n > step}
            className="flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed focus:outline-hidden group min-w-0"
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-all ${
                step === n
                  ? "bg-brand-red text-white shadow-2xs ring-2 ring-brand-red/20"
                  : step > n
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-200 text-zinc-600 group-hover:bg-zinc-300"
              }`}
            >
              {step > n ? <Check className="h-3.5 w-3.5" /> : n}
            </span>
            <div className="hidden min-w-0 flex-col text-left md:flex">
              <span
                className={`truncate font-heading text-[12px] font-semibold transition-colors ${
                  step === n ? "text-zinc-900" : step > n ? "text-zinc-700" : "text-zinc-400"
                }`}
              >
                {stepLabels[n].title}
              </span>
              <span className="truncate text-[10px] text-zinc-400">{stepLabels[n].hint}</span>
            </div>
          </button>
          {idx < 3 && (
            <div
              className={`mx-0.5 h-0.5 flex-1 rounded-full transition-colors ${
                step > n ? "bg-emerald-600/40" : "bg-zinc-200"
              }`}
            />
          )}
        </Fragment>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 animate-plf-fade text-left">
      <div className="overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-2xs">
        <div className="flex flex-col items-center gap-2 border-b border-zinc-100 bg-zinc-50/70 px-4 py-4 sm:flex-row sm:justify-between sm:px-5">
          <div className="flex items-center gap-3">
            <Logo height={24} />
            <div className="min-w-0 text-left">
              <p className="font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-500">
                {CLAIM_FORM_CONTROL.code}
              </p>
              <p className="font-heading text-xs font-bold uppercase leading-snug tracking-wide text-zinc-900 sm:text-sm">
                {CLAIM_FORM_CONTROL.title}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 px-4 py-4 sm:px-5 sm:py-5">
          <ClaimFormDivider title="Identificación del caso" />

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Controller
              name="claimDate"
              control={control}
              render={({ field }) => (
                <DateField
                  label="Fecha de la reclamación"
                  required
                  maxDate={today()}
                  value={field.value}
                  onChange={field.onChange}
                  name={field.name}
                  state={stateOf("claimDate")}
                  error={errors.claimDate?.message}
                />
              )}
            />
            <StaticField label="Código" value={ticketNumber} mono />
          </div>

          <ClaimFormDivider title="I. Información general" />

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <StaticField label="Empresa" value={clientName} />
            <TextField
              size="sm"
              label="País"
              placeholder="Opcional"
              state={stateOf("country")}
              error={errors.country?.message}
              {...register("country")}
            />
            <TextField
              size="sm"
              label="Contacto"
              placeholder="Nombre de la persona de contacto"
              state={stateOf("contactName")}
              error={errors.contactName?.message}
              {...register("contactName")}
            />
            <Controller
              name="contactPhone"
              control={control}
              render={({ field }) => (
                <TextField
                  size="sm"
                  type="tel"
                  label="Teléfonos"
                  placeholder="Opcional"
                  name={field.name}
                  value={field.value}
                  onChange={(e) => field.onChange(formatPhoneNumber(e.target.value))}
                  onBlur={field.onBlur}
                  state={stateOf("contactPhone")}
                  error={errors.contactPhone?.message}
                />
              )}
            />
          </div>
        </div>
      </div>

      <p className="text-center text-[11.5px] leading-relaxed text-faint">
        Contacto y teléfono se sugieren desde el ticket y la ficha del cliente; puedes corregirlos antes de guardar.
      </p>
    </div>
  );

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const blank = (value: string) => (value.trim() === "" ? null : value.trim());

    const request = {
      claimDate: values.claimDate,
      country: blank(values.country),
      contactName: blank(values.contactName),
      contactPhone: blank(values.contactPhone),
      clientPhone: null,
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

  const renderStep2 = () => (
    <div className="flex flex-col gap-3 animate-plf-fade text-left">
        <FormSection title="II. Sobre la reclamación">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Controller
              name="reason"
              control={control}
              render={({ field }) => (
                <SelectField
                  size="sm"
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
                size="sm"
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
                    size="sm"
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
                  size="sm"
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

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <TextField
              size="sm"
              label="Fecha de producción (# lote)"
              placeholder="Como viene en el empaque"
              state={stateOf("productionLot")}
              error={errors.productionLot?.message}
              {...register("productionLot")}
            />
            <TextField
              size="sm"
              label="Factura"
              placeholder="Ej. B0100004471"
              state={stateOf("invoiceRef")}
              error={errors.invoiceRef?.message}
              {...register("invoiceRef")}
            />
            <TextField
              size="sm"
              label="Número de PO"
              placeholder="Orden de compra"
              state={stateOf("poNumber")}
              error={errors.poNumber?.message}
              {...register("poNumber")}
            />
          </div>
        </FormSection>
    </div>
  );

  const renderStep3 = () => (
    <div className="flex flex-col gap-3 animate-plf-fade text-left">
        <FormSection
          title="Productos reclamados"
          hint="Diferencia = facturados − recibidos · Total = diferencia × precio"
        >
          <div className="flex flex-col gap-2">

            {typeof lineErrors?.message === "string" && (
              <p className="text-[12px] text-brand-red">{lineErrors.message}</p>
            )}

            <div className="flex flex-col gap-3">
              {fields.map((field, index) => {
                const lineError = lineErrors?.[index];
                const figure = figures[index] ?? { difference: 0, lineTotal: 0 };
                return (
                  <div
                    key={field.id}
                    className="rounded-edge border border-line bg-canvas/60 p-3"
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <Controller
                          name={`lines.${index}.productId`}
                          control={control}
                          render={({ field: productField }) => (
                            <ProductLookupField
                              size="sm"
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
                          <RowAction
                            label={`Quitar la línea ${index + 1}`}
                            icon={Trash2}
                            danger
                            onClick={() => remove(index)}
                          />
                        </div>
                      )}
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                      <TextField
                        size="sm"
                        label="Compradas"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        error={lineError?.unitsPurchased?.message}
                        {...register(`lines.${index}.unitsPurchased`)}
                      />
                      <TextField
                        size="sm"
                        label="Defectuosas"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        error={lineError?.defectiveQuantity?.message}
                        {...register(`lines.${index}.defectiveQuantity`)}
                      />
                      <TextField
                        size="sm"
                        label="Facturados"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        error={lineError?.invoicedQuantity?.message}
                        {...register(`lines.${index}.invoicedQuantity`)}
                      />
                      <TextField
                        size="sm"
                        label="Recibidos"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        error={lineError?.receivedQuantity?.message}
                        {...register(`lines.${index}.receivedQuantity`)}
                      />
                      <TextField
                        size="sm"
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
                  </div>
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
        </FormSection>
    </div>
  );

  const renderStep4 = () => (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 animate-plf-fade text-left">
        <FormSection title="III. Descripción de la reclamación">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <TextField
              size="sm"
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
                  size="sm"
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
          <TextAreaField
            label="Descripción"
            required
            rows={4}
            className="py-1.5 text-[12.5px]"
            placeholder="Qué recibió el cliente, qué esperaba y qué pide"
            error={errors.description?.message}
            {...register("description")}
          />
          <TextAreaField
            label="Comentarios"
            rows={2}
            className="py-1.5 text-[12.5px]"
            placeholder="Opcional"
            error={errors.comments?.message}
            {...register("comments")}
          />
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <TextField
              size="sm"
              label="Fecha de quien recibe"
              type="date"
              max={today()}
              hint="En blanco: hoy."
              error={errors.receivedAt?.message}
              {...register("receivedAt")}
            />
            <TextField
              size="sm"
              label="Primer contacto con el cliente"
              type="date"
              hint="Opcional. No anterior a la reclamación."
              error={errors.firstCustomerContactAt?.message}
              {...register("firstCustomerContactAt")}
            />
          </div>
        </FormSection>
    </div>
  );

  return (
    <Modal
      title={isEdit ? `Editar · ${ticketNumber}` : `Registrar · ${ticketNumber}`}
      eyebrow={`${CLAIM_FORM_CONTROL.code} · ${stepLabels[step].title}`}
      onClose={onClose}
      maxWidth="max-w-3xl"
      footer={
        <div className="flex w-full items-center gap-3">
          {step === 4 ? (
            <span className="hidden select-none items-center gap-1 text-[11px] text-zinc-400 sm:inline-flex">
              <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 font-mono text-[10px] text-zinc-500">
                Ctrl
              </kbd>
              <span>+</span>
              <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 font-mono text-[10px] text-zinc-500">
                Enter
              </kbd>
              <span className="ml-0.5">para guardar</span>
            </span>
          ) : (
            <span className="text-[11.5px] text-zinc-400">Paso {step} de 4</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {step > 1 ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Anterior</span>
              </Button>
            ) : (
              <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                Cancelar
              </Button>
            )}
            {step < 4 ? (
              <Button key={`claim-next-${step}`} type="button" size="sm" onClick={() => void handleNextStep()}>
                <span>Siguiente paso</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button type="submit" form="claim-form" size="sm" isLoading={isSubmitting}>
                {isEdit ? "Guardar cambios" : "Registrar reclamación"}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="mb-4 -mt-2 border-b border-zinc-100 pb-3">{renderStepper()}</div>
      <form
        id="claim-form"
        onSubmit={handleSubmit(onSubmit)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            if (step < 4) void handleNextStep();
            else void handleSubmit(onSubmit)();
          }
        }}
        noValidate
        className="flex flex-col gap-3 text-left"
      >
        {formError && <Alert variant="error">{formError}</Alert>}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </form>
    </Modal>
  );
}

function ClaimFormDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 border-t border-zinc-100 pt-2 first:border-0 first:pt-0">
      <span className="select-none font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400">
        {title}
      </span>
      <div className="h-px flex-1 bg-zinc-100" />
    </div>
  );
}

/** Misma altura y etiqueta que `TextField size="sm"`, solo lectura. */
function pickPhone(...candidates: (string | null | undefined)[]): string {
  for (const raw of candidates) {
    const value = raw?.trim();
    if (value) return value;
  }
  return "";
}

function StaticField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const display = value.trim() === "" || value === "—" ? "—" : value;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-heading text-[11.5px] font-semibold text-faint">{label}</span>
      <div
        className={`flex h-8 w-full items-center truncate rounded-edge border border-line-strong bg-canvas px-2.5 text-[12.5px] text-ink ${
          mono ? "font-mono tabular-nums" : ""
        }`}
        title={display}
      >
        {display}
      </div>
    </div>
  );
}
