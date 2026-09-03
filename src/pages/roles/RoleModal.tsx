import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { rolesApi } from "../../api/roles";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { CheckboxField, TextField, type FieldState } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import type { RoleResponse } from "../../types/api";

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Al menos 2 caracteres")
    .max(60, "Máximo 60 caracteres"),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface RoleModalProps {
  /** Presente = edicion; ausente = alta. */
  role?: RoleResponse;
  onClose: () => void;
  onSaved: (role: RoleResponse) => void;
}

export function RoleModal({ role, onClose, onSaved }: RoleModalProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const isEdit = role !== undefined;

  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { name: role?.name ?? "", isActive: role?.isActive ?? true },
  });

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      if (isEdit) {
        // El PUT responde 204: la fila actualizada se arma aqui con lo enviado.
        await rolesApi.update(role.id, {
          name: values.name,
          permissions: role.permissions,
          isActive: values.isActive,
        });
        onSaved({ ...role, name: values.name, isActive: values.isActive });
      } else {
        onSaved(await rolesApi.create({ name: values.name, permissions: [] }));
      }
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("name", { message: err.message });
        setFocus("name");
        return;
      }

      const fallback = isEdit ? "No se pudo guardar el rol" : "No se pudo crear el rol";
      setFormError(err instanceof ApiError ? err.message : fallback);
    }
  }

  return (
    <Modal
      eyebrow="Personal · Roles"
      title={isEdit ? "Editar rol" : "Nuevo rol"}
      description="Los roles agrupan permisos y se asignan al personal por departamento."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="role-form" isLoading={isSubmitting}>
            {isEdit ? "Guardar cambios" : "Crear rol"}
          </Button>
        </>
      }
    >
      <form id="role-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <TextField
          label="Nombre del rol"
          placeholder="Ej. Supervisor de Calidad"
          required
          state={stateOf("name")}
          error={errors.name?.message}
          hint="Se ve en el listado y al asignar accesos: usa un nombre que se entienda solo."
          {...register("name")}
        />

        {isEdit && (
          <CheckboxField
            label="Activo"
            description="Si se desmarca, el rol deja de poder asignarse a nuevo personal."
            {...register("isActive")}
          />
        )}

        <p className="rounded-edge border border-dashed border-line-strong bg-canvas px-3.5 py-3 text-[11.5px] leading-relaxed text-muted">
          Los permisos de este rol se editan en{" "}
          <Link
            to="/permisos"
            className="font-medium text-brand-red underline-offset-2 hover:underline"
          >
            Permisos
          </Link>
          , donde se ven todos los roles a la vez y se compara qué concede cada uno.
        </p>
      </form>
    </Modal>
  );
}
