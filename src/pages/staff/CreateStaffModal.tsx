import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { staffApi } from "../../api/staff";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import type { DepartmentResponse, StaffResponse } from "../../types/api";

const schema = z.object({
  firstName: z.string().min(1, "Requerido"),
  lastName: z.string().min(1, "Requerido"),
  email: z.string().min(1, "Requerido").email("Correo inválido"),
  primaryDepartmentId: z.string().min(1, "Selecciona un departamento"),
  isAdmin: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export function CreateStaffModal({
  departments,
  onClose,
  onCreated,
}: {
  departments: DepartmentResponse[];
  onClose: () => void;
  onCreated: (staff: StaffResponse) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { isAdmin: false },
  });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      const staff = await staffApi.create({
        ...values,
        primaryDepartmentId: Number(values.primaryDepartmentId),
      });
      onCreated(staff);
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo crear el usuario");
    }
  }

  return (
    <Modal title="Agregar personal" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <div className="grid grid-cols-2 gap-3">
          <Input label="Nombre" error={errors.firstName?.message} {...register("firstName")} />
          <Input label="Apellido" error={errors.lastName?.message} {...register("lastName")} />
        </div>

        <Input label="Correo" type="email" error={errors.email?.message} {...register("email")} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="primaryDepartmentId" className="text-sm font-medium text-zinc-700">
            Departamento
          </label>
          <select
            id="primaryDepartmentId"
            defaultValue=""
            className="rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 outline-none
              focus:border-brand-red focus:ring-2 focus:ring-brand-red/20"
            {...register("primaryDepartmentId")}
          >
            <option value="" disabled>
              Selecciona un departamento
            </option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
          {errors.primaryDepartmentId && (
            <p className="text-xs font-medium text-brand-red">
              {errors.primaryDepartmentId.message}
            </p>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-zinc-300 text-brand-red focus:ring-brand-red"
            {...register("isAdmin")}
          />
          Es administrador
        </label>

        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3.5 py-3 text-xs text-zinc-500">
          Se genera una contraseña aleatoria y se envía un código de activación de 6 dígitos al
          correo indicado. La persona define su propia contraseña desde "Olvidé mi contraseña".
        </div>

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Crear usuario
          </Button>
        </div>
      </form>
    </Modal>
  );
}
