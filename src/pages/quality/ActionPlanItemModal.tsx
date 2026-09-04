import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../../components/ui/Button";
import {
  SelectField,
  TextAreaField,
  TextField,
  type FieldState,
} from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { NEW_ID } from "../../lib/catalog";
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
  onSave: (item: ActionPlanItem) => void;
}

/** RF-Q4: agregar y editar acciones del plan. Marcar cumplida y anular son
 *  acciones de fila, no campos de este formulario. */
export function ActionPlanItemModal({
  sheetId,
  sheetNumber,
  item,
  staff,
  onClose,
  onSave,
}: ActionPlanItemModalProps) {
  const isEdit = item !== undefined;

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

  function onSubmit(values: FormValues) {
    onSave({
      id: item?.id ?? NEW_ID,
      sheetId,
      description: values.description.trim(),
      responsibleStaffId: Number(values.responsibleStaffId),
      dueDate: values.dueDate,
      completedAt: item?.completedAt ?? null,
      status: item?.status ?? "Pendiente",
      cancelReason: item?.cancelReason ?? null,
    });
    onClose();
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
