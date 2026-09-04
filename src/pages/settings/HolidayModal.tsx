import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { settingsApi } from "../../api/settings";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { CheckboxField, TextField, type FieldState } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import type { Holiday } from "../../types/settings";

/**
 * Espejo de la validacion del servidor en POST/PUT /api/settings/holidays: fecha
 * obligatoria y unica, y nombre obligatorio. La fecha es un dia, no un instante.
 */
const schema = z.object({
  date: z.string().min(1, "Elige la fecha"),
  name: z.string().trim().min(2, "Al menos 2 caracteres").max(80, "Máximo 80 caracteres"),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface HolidayModalProps {
  holiday?: Holiday;
  onClose: () => void;
  onSaved: (holiday: Holiday) => void;
}

export function HolidayModal({ holiday, onClose, onSaved }: HolidayModalProps) {
  const isEdit = holiday !== undefined;
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      date: holiday?.date ?? "",
      name: holiday?.name ?? "",
      isActive: holiday?.isActive ?? true,
    },
  });

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const request = { date: values.date, name: values.name.trim(), isActive: values.isActive };

    try {
      const saved = isEdit
        ? await settingsApi.holidays.update(holiday.id, request)
        : await settingsApi.holidays.create(request);
      onSaved(saved);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("date", { message: err.message });
        setFocus("date");
        return;
      }
      setFormError(err instanceof ApiError ? err.message : "No se pudo guardar el día");
    }
  }

  return (
    <Modal
      title={isEdit ? "Editar día no laborable" : "Nuevo día no laborable"}
      description="Los días de esta lista se saltan al calcular vencimientos en las políticas con reloj de jornada."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="holiday-form" isLoading={isSubmitting}>
            {isEdit ? "Guardar cambios" : "Agregar día"}
          </Button>
        </>
      }
    >
      <form id="holiday-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <TextField
          label="Fecha"
          type="date"
          required
          state={stateOf("date")}
          error={errors.date?.message}
          {...register("date")}
        />

        <TextField
          label="Motivo"
          placeholder="Ej. Día de la Restauración"
          required
          state={stateOf("name")}
          error={errors.name?.message}
          hint="Feriado nacional, cierre de planta, inventario: lo que corresponda."
          {...register("name")}
        />

        {isEdit && (
          <CheckboxField
            label="Activo"
            description="Si se desmarca, ese día vuelve a contar como laborable."
            {...register("isActive")}
          />
        )}
      </form>
    </Modal>
  );
}
