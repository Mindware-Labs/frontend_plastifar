import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../../components/ui/Button";
import { CheckboxField, TextField, type FieldState } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { NEW_ID } from "../../lib/catalog";
import type { Territory } from "../../types/clients";

/**
 * Espejo de la validacion del servidor en POST/PUT /api/settings/territories:
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

interface TerritoryModalProps {
  territory?: Territory;
  existing: Territory[];
  onClose: () => void;
  onSave: (territory: Territory) => void;
}

export function TerritoryModal({ territory, existing, onClose, onSave }: TerritoryModalProps) {
  const isEdit = territory !== undefined;

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
      code: territory?.code ?? "",
      name: territory?.name ?? "",
      isActive: territory?.isActive ?? true,
    },
  });

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  function onSubmit(values: FormValues) {
    const code = values.code.trim().toUpperCase();

    const clash = existing.find(
      (candidate) => candidate.code.toUpperCase() === code && candidate.id !== territory?.id,
    );

    if (clash) {
      setError("code", { message: `Ese código ya lo usa ${clash.name}` });
      setFocus("code");
      return;
    }

    onSave({
      id: territory?.id ?? NEW_ID,
      code,
      name: values.name.trim(),
      isActive: values.isActive,
      clientCount: territory?.clientCount ?? 0,
    });
    onClose();
  }

  return (
    <Modal
      title={isEdit ? "Editar territorio" : "Nuevo territorio"}
      description="La zona comercial de un cliente; alimenta el ranking por territorio y vendedor."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="territory-form" isLoading={isSubmitting}>
            {isEdit ? "Guardar cambios" : "Crear territorio"}
          </Button>
        </>
      }
    >
      <form
        id="territory-form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        <TextField
          label="Código"
          placeholder="Ej. SDQ"
          required
          state={stateOf("code")}
          error={errors.code?.message}
          hint="Corto y estable: se guarda en mayúsculas."
          {...register("code")}
        />

        <TextField
          label="Nombre"
          placeholder="Ej. Santo Domingo"
          required
          state={stateOf("name")}
          error={errors.name?.message}
          {...register("name")}
        />

        {isEdit && (
          <>
            <CheckboxField
              label="Activo"
              description="Si se desmarca, deja de ofrecerse al registrar un cliente."
              {...register("isActive")}
            />

            {territory.clientCount > 0 && (
              <p className="rounded-edge border border-dashed border-line-strong bg-canvas px-3.5 py-3 text-[11.5px] leading-relaxed text-muted">
                {territory.clientCount}{" "}
                {territory.clientCount === 1 ? "cliente lo usa" : "clientes lo usan"}. Desactivarlo
                no rompe el historial, pero deja de poder elegirse en clientes nuevos.
              </p>
            )}
          </>
        )}
      </form>
    </Modal>
  );
}
