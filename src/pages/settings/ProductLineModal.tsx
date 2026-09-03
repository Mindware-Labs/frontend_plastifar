import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../../components/ui/Button";
import { CheckboxField, TextField, type FieldState } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { NEW_ID } from "../../lib/catalog";
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
  existing: ProductLine[];
  onClose: () => void;
  onSave: (line: ProductLine) => void;
}

export function ProductLineModal({ line, existing, onClose, onSave }: ProductLineModalProps) {
  const isEdit = line !== undefined;

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

  function onSubmit(values: FormValues) {
    const code = values.code.trim().toUpperCase();

    const clash = existing.find(
      (candidate) => candidate.code.toUpperCase() === code && candidate.id !== line?.id,
    );

    if (clash) {
      setError("code", { message: `Ese código ya lo usa la línea ${clash.name}` });
      setFocus("code");
      return;
    }

    onSave({
      id: line?.id ?? NEW_ID,
      code,
      name: values.name.trim(),
      isActive: values.isActive,
      usedByTopics: line?.usedByTopics ?? 0,
    });
    onClose();
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
              <p className="rounded-edge border border-dashed border-line-strong bg-canvas px-3.5 py-3 text-[11.5px] leading-relaxed text-muted">
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
