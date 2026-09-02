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
});

type FormValues = z.infer<typeof schema>;

export function CreateRoleModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (role: RoleResponse) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      const role = await rolesApi.create({ name: values.name, permissions: [] });
      onCreated(role);
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo crear el rol");
    }
  }

  return (
    <Modal title="Nuevo rol" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <Input
          label="Nombre del rol"
          placeholder="Ej. Supervisor de Calidad"
          error={errors.name?.message}
          {...register("name")}
        />

        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3.5 py-3 text-xs text-zinc-500">
          Los permisos del rol se configuran en un paso posterior, cuando existan las entidades
          sobre las que aplican (tickets, departamentos, etc.). El rol se crea sin permisos por ahora.
        </div>

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Crear rol
          </Button>
        </div>
      </form>
    </Modal>
  );
}
