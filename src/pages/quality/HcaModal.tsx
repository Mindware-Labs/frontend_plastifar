import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { qualityApi } from "../../api/quality";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import {
  SelectField,
  TextAreaField,
  TextField,
  type FieldState,
} from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { today } from "../../lib/quality";
import type { Client } from "../../types/clients";
import type { CorrectiveActionSheet, QualityStaff } from "../../types/quality";
import type { ProductLine } from "../../types/settings";

// Espejo de la validacion del servidor: cuando exista POST/PUT /api/quality/sheets,
// estas mismas reglas van en el validador de C#. Si una cambia aqui, cambia alli.
const schema = z
  .object({
    clientId: z.string().min(1, "Elige el cliente afectado"),
    productLineId: z.string().min(1, "Elige la línea de producto"),
    detectedAt: z.string().min(1, "Indica cuándo se detectó"),
    dueDate: z.string().min(1, "Indica la fecha comprometida de cierre"),
    responsibleStaffId: z.string().min(1, "Elige el responsable de la hoja"),
    description: z
      .string()
      .trim()
      .min(20, "Describe qué ocurrió: al menos 20 caracteres")
      .max(2000, "Máximo 2000 caracteres"),
    immediateAction: z.string().trim().max(2000, "Máximo 2000 caracteres"),
    rootCause: z.string().trim().max(2000, "Máximo 2000 caracteres"),
  })
  .refine((values) => values.dueDate >= values.detectedAt, {
    path: ["dueDate"],
    message: "La fecha comprometida no puede ser anterior a la detección",
  });

type FormValues = z.infer<typeof schema>;

interface HcaModalProps {
  /** Ausente = alta. */
  sheet?: CorrectiveActionSheet;
  clients: Client[];
  productLines: ProductLine[];
  staff: QualityStaff[];
  onClose: () => void;
  onSaved: (sheet: CorrectiveActionSheet) => void;
}

export function HcaModal({
  sheet,
  clients,
  productLines,
  staff,
  onClose,
  onSaved,
}: HcaModalProps) {
  const isEdit = sheet !== undefined;
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      clientId: sheet ? String(sheet.clientId) : "",
      productLineId: sheet ? String(sheet.productLineId) : "",
      detectedAt: sheet ? sheet.detectedAt.slice(0, 10) : today(),
      dueDate: sheet?.dueDate ?? "",
      responsibleStaffId: sheet ? String(sheet.responsibleStaffId) : "",
      description: sheet?.description ?? "",
      immediateAction: sheet?.immediateAction ?? "",
      rootCause: sheet?.rootCause ?? "",
    },
  });

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);

    const rootCause = values.rootCause.trim();
    const immediateAction = values.immediateAction.trim();

    const request = {
      clientId: Number(values.clientId),
      productLineId: Number(values.productLineId),
      detectedAt: values.detectedAt,
      description: values.description.trim(),
      immediateAction: immediateAction === "" ? null : immediateAction,
      rootCause: rootCause === "" ? null : rootCause,
      responsibleStaffId: Number(values.responsibleStaffId),
      dueDate: values.dueDate,
      ticketId: sheet?.ticketId ?? null,
    };

    try {
      const saved = isEdit
        ? await qualityApi.sheets.update(sheet.id, request)
        : await qualityApi.sheets.create(request);
      onSaved(saved);
      onClose();
    } catch (err) {
      const fallback = isEdit ? "No se pudo guardar la HCA" : "No se pudo crear la HCA";
      setFormError(err instanceof ApiError ? err.message : fallback);
    }
  }

  return (
    <Modal
      title={isEdit ? `Editar ${sheet.number}` : "Nueva HCA"}
      description={
        isEdit
          ? "Una HCA no se elimina: si se abrió por error, se cierra con nota explicativa."
          : "Documenta la no conformidad. El plan de acción y el cierre se trabajan después, desde la ficha."
      }
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="hca-form" isLoading={isSubmitting}>
            {isEdit ? "Guardar cambios" : "Crear HCA"}
          </Button>
        </>
      }
    >
      <form id="hca-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <div className="grid grid-cols-2 gap-3">
          <Controller
            name="clientId"
            control={control}
            render={({ field }) => (
              <SelectField
                label="Cliente"
                required
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="Elige uno"
                options={clients.map((client) => ({
                  value: String(client.id),
                  label: client.name,
                }))}
                state={stateOf("clientId")}
                error={errors.clientId?.message}
              />
            )}
          />

          <Controller
            name="productLineId"
            control={control}
            render={({ field }) => (
              <SelectField
                label="Línea de producto"
                required
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="Elige una"
                options={productLines
                  .filter((line) => line.isActive || String(line.id) === field.value)
                  .map((line) => ({ value: String(line.id), label: line.name }))}
                state={stateOf("productLineId")}
                error={errors.productLineId?.message}
                hint="Obligatoria: es el eje del seguimiento por línea."
              />
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Detectada el"
            type="date"
            required
            state={stateOf("detectedAt")}
            error={errors.detectedAt?.message}
            {...register("detectedAt")}
          />
          <TextField
            label="Cierre comprometido"
            type="date"
            required
            state={stateOf("dueDate")}
            error={errors.dueDate?.message}
            {...register("dueDate")}
          />
        </div>

        <Controller
          name="responsibleStaffId"
          control={control}
          render={({ field }) => (
            <SelectField
              label="Responsable"
              required
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              placeholder="Elige a quien responde por la hoja"
              options={staff.map((person) => ({ value: String(person.id), label: person.name }))}
              state={stateOf("responsibleStaffId")}
              error={errors.responsibleStaffId?.message}
            />
          )}
        />

        <TextAreaField
          label="Qué ocurrió"
          required
          rows={4}
          placeholder="La no conformidad, con el lote, la cantidad y el efecto en el cliente"
          error={errors.description?.message}
          {...register("description")}
        />

        <TextAreaField
          label="Acción inmediata"
          rows={2}
          placeholder="Contención aplicada de inmediato, si la hubo"
          error={errors.immediateAction?.message}
          {...register("immediateAction")}
        />

        {isEdit && (
          <TextAreaField
            label="Causa raíz"
            rows={3}
            placeholder="Por qué ocurrió, no qué ocurrió"
            hint="Obligatoria para pasar a ejecución y para cerrar la hoja."
            error={errors.rootCause?.message}
            {...register("rootCause")}
          />
        )}
      </form>
    </Modal>
  );
}
