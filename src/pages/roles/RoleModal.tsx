import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { rolesApi } from "../../api/roles";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import type { RoleResponse } from "../../types/api";

const schema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
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
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: role?.name ?? "", isActive: role?.isActive ?? true },
  });

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
      const fallback = isEdit ? "No se pudo guardar el rol" : "No se pudo crear el rol";
      setFormError(err instanceof ApiError ? err.message : fallback);
    }
  }

  return (
    <Modal title={isEdit ? "Editar rol" : "Nuevo rol"} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <Input
          label="Nombre del rol"
          placeholder="Ej. Supervisor de Calidad"
          error={errors.name?.message}
          {...register("name")}
        />

        {isEdit && (
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-zinc-300 text-brand-red focus:ring-brand-red"
              {...register("isActive")}
            />
            Activo (asignable a personal)
          </label>
        )}

        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3.5 py-3 text-xs text-zinc-500">
          Los permisos del rol se configuran en un paso posterior, cuando existan las entidades
          sobre las que aplican (tickets, departamentos, etc.).
        </div>

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {isEdit ? "Guardar cambios" : "Crear rol"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
