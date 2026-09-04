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
import type { ActionPlanItem, QualityStaff } from "../../types/quality";

// Espejo de la validacion del servidor de POST/PUT /api/quality/sheets/{id}/plan.
const schema = z.object({
  description: z
    .string()
    .trim()
    .min(10, "Describe la acción: al menos 10 caracteres")
    .max(500, "Máximo 500 caracteres"),
  responsibleStaffId: z.string().min(1, "Elige quién responde por esta acción"),
  dueDate: z.string().min(1, "Indica la fecha comprometida"),
});

type FormValues = z.infer<typeof schema>;

interface ActionPlanItemModalProps {
  sheetId: number;
  sheetNumber: string;
  /** Ausente = alta. */
  item?: ActionPlanItem;
  staff: QualityStaff[];
  onClose: () => void;
  onSaved: (item: ActionPlanItem) => void;
}

/** RF-Q4: agregar y editar acciones del plan. Marcar cumplida y anular son
 *  acciones de fila, no campos de este formulario. */
export function ActionPlanItemModal({
  sheetId,
  sheetNumber,
  item,
  staff,
  onClose,
  onSaved,
}: ActionPlanItemModalProps) {
  const isEdit = item !== undefined;
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
      description: item?.description ?? "",
      responsibleStaffId: item ? String(item.responsibleStaffId) : "",
      dueDate: item?.dueDate ?? "",
    },
  });

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const request = {
      description: values.description.trim(),
      responsibleStaffId: Number(values.responsibleStaffId),
      dueDate: values.dueDate,
    };

    try {
      const saved = isEdit
        ? await qualityApi.planItems.update(item.id, request)
        : await qualityApi.planItems.create(sheetId, request);
      onSaved(saved);
      onClose();
    } catch (err) {
      const fallback = isEdit ? "No se pudo guardar la acción" : "No se pudo agregar la acción";
      setFormError(err instanceof ApiError ? err.message : fallback);
    }
  }

  return (
    <Modal
      title={isEdit ? "Editar acción" : "Nueva acción del plan"}
      description={`Del plan de ${sheetNumber}. La hoja no se cierra mientras quede una acción sin resolver.`}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="plan-item-form" isLoading={isSubmitting}>
            {isEdit ? "Guardar cambios" : "Agregar acción"}
          </Button>
        </>
      }
    >
      <form
        id="plan-item-form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        {formError && <Alert variant="error">{formError}</Alert>}

        <TextAreaField
          label="Acción"
          required
          rows={3}
          placeholder="Qué se va a hacer para que no vuelva a ocurrir"
          error={errors.description?.message}
          {...register("description")}
        />

        <div className="grid grid-cols-2 gap-3">
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
                placeholder="Elige uno"
                options={staff.map((person) => ({ value: String(person.id), label: person.name }))}
                state={stateOf("responsibleStaffId")}
                error={errors.responsibleStaffId?.message}
              />
            )}
          />

          <TextField
            label="Comprometida para"
            type="date"
            required
            state={stateOf("dueDate")}
            error={errors.dueDate?.message}
            {...register("dueDate")}
          />
        </div>
      </form>
    </Modal>
  );
}
