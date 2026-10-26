import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { fetchAllPages } from "../../api/paging";
import { qualityApi } from "../../api/quality";
import { settingsApi } from "../../api/settings";
import { ProductLookupField } from "../../components/app/ProductLookupField";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import {
  DateField,
  LookupField,
  SelectField,
  TextAreaField,
  type FieldState,
} from "../../components/ui/Field";
import { FormDivider } from "../../components/ui/FormDivider";
import { Modal } from "../../components/ui/Modal";
import { RowAction } from "../../components/ui/RowAction";
import { ShortcutModalFooter } from "../../components/ui/ShortcutModalFooter";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { resolveClientLabel, resolveStaffLabel, searchActiveStaff, searchClients } from "../../lib/lookups";
import { today } from "../../lib/quality";
import type { CorrectiveActionSheet } from "../../types/quality";
import type { Plant, ProductLine } from "../../types/settings";

/**
 * Espejo de la validación del servidor de POST/PUT /api/quality/sheets
 * (CorrectiveActionSheetsController.ValidateAsync y QualityRules.ValidateCauses).
 */
const schema = z
  .object({
    clientId: z.string().min(1, "Elige el cliente afectado"),
    productLineId: z.string().min(1, "Elige la línea de producto"),
    productId: z.string(),
    plantId: z.string(),
    detectedAt: z.string().min(1, "Indica cuándo se detectó"),
    dueDate: z.string().min(1, "Indica la fecha comprometida de cierre"),
    responsibleStaffId: z.string().min(1, "Elige el responsable de la hoja"),
    description: z
      .string()
      .trim()
      .min(20, "Describe qué ocurrió: al menos 20 caracteres")
      .max(2000, "Máximo 2000 caracteres"),
    immediateAction: z.string().trim().max(2000, "Máximo 2000 caracteres"),
    causes: z
      .array(
        z.object({
          text: z
            .string()
            .trim()
            .refine((value) => value === "" || value.length >= 10, "Describe la causa: al menos 10 caracteres")
            .refine((value) => value.length <= 1000, "Máximo 1000 caracteres"),
        }),
      )
      .max(20, "Una hoja admite hasta 20 causas"),
    comments: z.string().trim().max(4000, "Máximo 4000 caracteres"),
  })
  .refine((values) => values.dueDate >= values.detectedAt, {
    path: ["dueDate"],
    message: "La fecha comprometida no puede ser anterior a la detección",
  });

type FormValues = z.infer<typeof schema>;

interface HcaModalProps {
  /** Ausente = alta. */
  sheet?: CorrectiveActionSheet;
  productLines: ProductLine[];
  /**
   * Alta desde otro registro: la reclamación de clientes abre la HCA
   * heredando el cliente y el ticket (docs/plan/03, RF-R7). Solo cuenta en el
   * alta; en edición manda la hoja.
   */
  defaults?: { clientId: number; ticketId: number | null; description?: string };
  onClose: () => void;
  onSaved: (sheet: CorrectiveActionSheet) => void;
}

export function HcaModal({
  sheet,
  productLines,
  defaults,
  onClose,
  onSaved,
}: HcaModalProps) {
  const isEdit = sheet !== undefined;
  const [formError, setFormError] = useState<string | null>(null);
  const [plants, setPlants] = useState<Plant[]>([]);
  const { isExiting, requestClose } = useModalAnimation();

  // Las plantas son catálogo acotado (16 en la fuente): se recorren enteras.
  useEffect(() => {
    fetchAllPages<Plant>((page, pageSize) => settingsApi.plants.list({ page, pageSize }))
      .then(setPlants)
      .catch(() => setPlants([]));
  }, []);

  const {
    control,
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      clientId: sheet ? String(sheet.clientId) : defaults ? String(defaults.clientId) : "",
      productLineId: sheet ? String(sheet.productLineId) : "",
      productId: sheet?.productId ? String(sheet.productId) : "",
      plantId: sheet?.plantId ? String(sheet.plantId) : "",
      detectedAt: sheet ? sheet.detectedAt.slice(0, 10) : today(),
      dueDate: sheet?.dueDate ?? "",
      responsibleStaffId: sheet ? String(sheet.responsibleStaffId) : "",
      description: sheet?.description ?? defaults?.description ?? "",
      immediateAction: sheet?.immediateAction ?? "",
      causes:
        sheet && sheet.causes.length > 0
          ? sheet.causes.map((cause) => ({ text: cause.description }))
          : [{ text: "" }],
      comments: sheet?.comments ?? "",
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "causes" });

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    // Si se presiona Ctrl+Enter o Cmd+Enter en un campo no-textarea, enviar el formulario
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit(onSubmit)();
    }
  }

  /**
   * Regla 7: al elegir un producto, su línea se propone si la hoja no tiene
   * ninguna. El selector solo trae id, código y nombre; la línea se pide por id.
   */
  async function proposeLineFrom(productId: string) {
    if (productId === "" || getValues("productLineId") !== "") return;
    try {
      const product = await settingsApi.products.get(Number(productId));
      if (product.productLineId !== null) {
        setValue("productLineId", String(product.productLineId), { shouldValidate: true });
      }
      if (product.plantId !== null && getValues("plantId") === "") {
        setValue("plantId", String(product.plantId));
      }
    } catch {
      // Sin propuesta: la persona elige la línea a mano.
    }
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);

    const immediateAction = values.immediateAction.trim();
    const comments = values.comments.trim();

    const request = {
      clientId: Number(values.clientId),
      productLineId: Number(values.productLineId),
      productId: values.productId === "" ? null : Number(values.productId),
      plantId: values.plantId === "" ? null : Number(values.plantId),
      detectedAt: values.detectedAt,
      description: values.description.trim(),
      immediateAction: immediateAction === "" ? null : immediateAction,
      responsibleStaffId: Number(values.responsibleStaffId),
      dueDate: values.dueDate,
      ticketId: sheet?.ticketId ?? defaults?.ticketId ?? null,
      comments: comments === "" ? null : comments,
      causes: values.causes.map((cause) => cause.text.trim()).filter((text) => text !== ""),
    };

    try {
      const saved = isEdit
        ? await qualityApi.sheets.update(sheet.id, request)
        : await qualityApi.sheets.create(request);
      onSaved(saved);
      requestClose();
    } catch (err) {
      const fallback = isEdit ? "No se pudo guardar la HCA" : "No se pudo crear la HCA";
      setFormError(err instanceof ApiError ? err.message : fallback);
    }
  }

  return (
    <Modal
      title={isEdit ? `Editar ${sheet.number}` : "Nueva HCA"}
      eyebrow={isEdit ? `HCA #${sheet.number} · PF-FOR-109` : "PF-FOR-109 · Hecho, Causa y Acción"}
      description={
        isEdit
          ? "Actualiza los datos del hallazgo, plazos comprometidos o causas identificadas."
          : "Documenta la no conformidad detectada. El plan de acción y verificación de eficacia se gestionan desde la ficha."
      }
      onClose={onClose}
      isExiting={isExiting}
      onRequestClose={requestClose}
      maxWidth="max-w-2xl"
      footer={
        <ShortcutModalFooter
          formId="hca-form"
          isEdit={isEdit}
          createLabel="Crear HCA"
          isSubmitting={isSubmitting}
          onCancel={requestClose}
        />
      }
    >
      <form
        id="hca-form"
        onSubmit={handleSubmit(onSubmit)}
        onKeyDown={handleKeyDown}
        noValidate
        className="flex flex-col gap-3 text-left"
      >
        {formError && <Alert variant="error">{formError}</Alert>}

        {/* 1. Origen del hallazgo */}
        <FormDivider title="Origen del hallazgo" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Controller
            name="clientId"
            control={control}
            render={({ field }) => (
              <LookupField
                size="sm"
                label="Cliente afectado"
                required
                name={field.name}
                value={field.value}
                onChange={(value) => field.onChange(value)}
                onBlur={field.onBlur}
                placeholder="Seleccionar cliente…"
                searchPlaceholder="Buscar por nombre o RNC…"
                search={searchClients}
                resolveSelectedLabel={resolveClientLabel}
                state={stateOf("clientId")}
                error={errors.clientId?.message}
              />
            )}
          />

          <Controller
            name="productId"
            control={control}
            render={({ field }) => (
              <ProductLookupField
                size="sm"
                label="Producto específico"
                name={field.name}
                value={field.value}
                onChange={(value) => {
                  field.onChange(value);
                  void proposeLineFrom(value);
                }}
                onBlur={field.onBlur}
                placeholder="Elige un producto (opcional)"
                clearLabel="Sin producto específico"
                error={errors.productId?.message}
                hint="Opcional. Autopropone la línea y planta."
              />
            )}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Controller
            name="productLineId"
            control={control}
            render={({ field }) => (
              <SelectField
                size="sm"
                label="Línea de producto"
                required
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="Seleccionar línea…"
                options={productLines
                  .filter((line) => line.isActive || String(line.id) === field.value)
                  .map((line) => ({ value: String(line.id), label: line.name }))}
                state={stateOf("productLineId")}
                error={errors.productLineId?.message}
              />
            )}
          />

          <Controller
            name="plantId"
            control={control}
            render={({ field }) => (
              <SelectField
                size="sm"
                label="Planta de fabricación"
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="Sin planta específica"
                options={[
                  { value: "", label: "Sin planta específica" },
                  ...plants
                    .filter((plant) => plant.isActive || String(plant.id) === field.value)
                    .map((plant) => ({
                      value: String(plant.id),
                      label: `${plant.name} · ${plant.country}`,
                    })),
                ]}
                error={errors.plantId?.message}
              />
            )}
          />
        </div>

        {/* 2. Plazos y asignación */}
        <FormDivider title="Plazos y responsable" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Controller
            name="detectedAt"
            control={control}
            render={({ field }) => (
              <DateField
                label="Fecha de detección"
                required
                value={field.value}
                onChange={field.onChange}
                placeholder="Seleccionar fecha…"
                headerLabel="Fecha de detección"
                state={stateOf("detectedAt")}
                error={errors.detectedAt?.message}
              />
            )}
          />

          <Controller
            name="dueDate"
            control={control}
            render={({ field }) => (
              <DateField
                label="Cierre comprometido"
                required
                value={field.value}
                onChange={field.onChange}
                placeholder="Seleccionar fecha de cierre…"
                headerLabel="Cierre comprometido"
                state={stateOf("dueDate")}
                error={errors.dueDate?.message}
              />
            )}
          />
        </div>

        <Controller
          name="responsibleStaffId"
          control={control}
          render={({ field }) => (
            <LookupField
              size="sm"
              label="Responsable de la hoja"
              required
              name={field.name}
              value={field.value}
              onChange={(value) => field.onChange(value)}
              onBlur={field.onBlur}
              placeholder="Elige a quien responde por la HCA…"
              searchPlaceholder="Buscar por nombre o cargo…"
              search={searchActiveStaff}
              resolveSelectedLabel={resolveStaffLabel}
              state={stateOf("responsibleStaffId")}
              error={errors.responsibleStaffId?.message}
            />
          )}
        />

        {/* 3. El hallazgo */}
        <FormDivider title="Descripción del hallazgo" />

        <TextAreaField
          label="¿Qué ocurrió? (Descripción de la no conformidad)"
          required
          rows={3}
          placeholder="Describe la no conformidad con detalle: lote, cantidad afectada y efecto en el cliente…"
          error={errors.description?.message}
          {...register("description")}
        />

        <TextAreaField
          label="Acción inmediata / contención"
          rows={2}
          placeholder="Medida de contención inmediata aplicada al detectar el problema (opcional)…"
          error={errors.immediateAction?.message}
          {...register("immediateAction")}
        />

        {/* 4. Causas identificadas */}
        <FormDivider title="Causas raíz identificadas" />

        <div className="flex flex-col gap-2">
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <TextAreaField
                  label={`Causa raíz ${index + 1}`}
                  rows={2}
                  placeholder={`Describe la causa raíz ${index + 1} del hallazgo…`}
                  error={errors.causes?.[index]?.text?.message}
                  {...register(`causes.${index}.text`)}
                />
              </div>
              {fields.length > 1 && (
                <div className="pt-6">
                  <RowAction
                    label={`Quitar la causa ${index + 1}`}
                    icon={Trash2}
                    danger
                    onClick={() => remove(index)}
                  />
                </div>
              )}
            </div>
          ))}

          {typeof errors.causes?.message === "string" && (
            <p className="text-[11.5px] font-medium text-brand-red">{errors.causes.message}</p>
          )}

          {fields.length < 20 && (
            <div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => append({ text: "" })}
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar otra causa
              </Button>
            </div>
          )}
        </div>

        {/* 5. Comentarios */}
        <FormDivider title="Comentarios y notas" />

        <TextAreaField
          label="Comentarios u observaciones"
          rows={2}
          placeholder="Notas adicionales o contexto de seguimiento (opcional)…"
          error={errors.comments?.message}
          {...register("comments")}
        />
      </form>
    </Modal>
  );
}
