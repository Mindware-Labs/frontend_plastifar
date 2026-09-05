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
import type { ProductLine } from "../../types/settings";

/**
 * Espejo de la validacion del servidor en POST/PUT /api/settings/product-lines:
 * codigo unico en mayusculas y nombre unico, ambos obligatorios.
 */
const schema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Al menos 2 caracteres")
    .max(10, "Máximo 10 caracteres")
    .regex(/^[A-Za-z0-9]+$/, "Solo letras y números, sin espacios"),
  name: z.string().trim().min(2, "Al menos 2 caracteres").max(80, "Máximo 80 caracteres"),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface ProductLineModalProps {
  line?: ProductLine;
  onClose: () => void;
  onSaved: (line: ProductLine) => void;
}

export function ProductLineModal({ line, onClose, onSaved }: ProductLineModalProps) {
  const isEdit = line !== undefined;
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
      code: line?.code ?? "",
      name: line?.name ?? "",
      isActive: line?.isActive ?? true,
    },
  });

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const request = { code: values.code.trim().toUpperCase(), name: values.name.trim(), isActive: values.isActive };

    try {
      const saved = isEdit
        ? await settingsApi.productLines.update(line.id, request)
        : await settingsApi.productLines.create(request);
      onSaved(saved);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // El API no dice que campo choca. Se busca el valor enviado dentro del
        // mensaje —lo unico que no cambia si alguien reescribe la frase— y, si
        // no aparece ninguno, el conflicto se muestra arriba: preferible a
        // marcar un campo al azar.
        const message = err.message.toLowerCase();
        if (message.includes(request.code.toLowerCase())) {
          setError("code", { message: err.message });
          setFocus("code");
        } else if (message.includes(request.name.toLowerCase())) {
          setError("name", { message: err.message });
          setFocus("name");
        } else {
          setFormError(err.message);
        }
        return;
      }
      setFormError(err instanceof ApiError ? err.message : "No se pudo guardar la línea");
    }
  }

  return (
    <Modal
      title={isEdit ? "Editar línea de producto" : "Nueva línea de producto"}
      description="Es el eje por el que Calidad sigue las reclamaciones, y se exige en los motivos marcados para ello."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="line-form" isLoading={isSubmitting}>
            {isEdit ? "Guardar cambios" : "Crear línea"}
          </Button>
        </>
      }
    >
      <form id="line-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <TextField
          label="Código"
          placeholder="Ej. BIO"
          required
          state={stateOf("code")}
          error={errors.code?.message}
          hint="Corto y estable: se guarda en mayúsculas y aparece en los reportes."
          {...register("code")}
        />

        <TextField
          label="Nombre"
          placeholder="Ej. Bio"
          required
          state={stateOf("name")}
          error={errors.name?.message}
          {...register("name")}
        />

        {isEdit && (
          <>
            <CheckboxField
              label="Activa"
              description="Si se desmarca, deja de ofrecerse en tickets y hojas de corrección."
              {...register("isActive")}
            />

            {line.usedByTopics > 0 && (
              <p className="rounded-edge border border-line px-3.5 py-3 text-[11.5px] leading-relaxed text-muted">
                {line.usedByTopics} {line.usedByTopics === 1 ? "motivo la exige" : "motivos la exigen"}.
                Desactivarla no rompe el historial, pero deja de poder elegirse en tickets nuevos.
              </p>
            )}
          </>
        )}
      </form>
    </Modal>
  );
}
