import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { CheckboxField, SelectField, type FieldState } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import type { DepartmentAccess, RoleSummary } from "../../types/permissions";

/**
 * Espejo de la validacion del servidor en POST /api/staff/{id}/department-access:
 * departamento y rol obligatorios, y el departamento no puede repetirse en dos
 * accesos de la misma persona (la clave primaria de StaffDepartmentAccess es
 * StaffId + DepartmentId).
 */
const schema = z.object({
  departmentId: z.string().min(1, "Elige el departamento al que le das acceso"),
  roleId: z.string().min(1, "Elige con qué rol entra a ese departamento"),
  isPrimary: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface AccessModalProps {
  staffName: string;
  /** Presente = cambiar el rol de un acceso existente; ausente = otorgar uno nuevo. */
  access?: DepartmentAccess;
  departments: { id: number; name: string }[];
  roles: RoleSummary[];
  /** Departamentos que la persona ya tiene: no pueden concederse dos veces. */
  taken: number[];
  /** Verdadero cuando todavia no hay ningun acceso: el primero es el principal. */
  isFirst: boolean;
  onClose: () => void;
  onSave: (value: { departmentId: number; roleId: number; isPrimary: boolean }) => Promise<void>;
}

export function AccessModal({
  staffName,
  access,
  departments,
  roles,
  taken,
  isFirst,
  onClose,
  onSave,
}: AccessModalProps) {
  const isEdit = access !== undefined;
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
      departmentId: access ? String(access.departmentId) : "",
      roleId: access ? String(access.roleId) : "",
      isPrimary: access?.isPrimary ?? isFirst,
    },
  });

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  const available = departments.filter((department) => isEdit || !taken.includes(department.id));

  // Un rol inactivo no puede asignarse a nadie nuevo, pero si ya estaba asignado
  // se muestra para no romper la ficha de quien lo tiene.
  const assignableRoles = roles.filter(
    (role) => !role.isSystem && (role.isActive || (access && role.id === access.roleId)),
  );

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      await onSave({
        departmentId: Number(values.departmentId),
        roleId: Number(values.roleId),
        isPrimary: values.isPrimary,
      });
      onClose();
    } catch (err) {
      const fallback = isEdit ? "No se pudo guardar el acceso" : "No se pudo otorgar el acceso";
      setFormError(err instanceof ApiError ? err.message : fallback);
    }
  }

  return (
    <Modal
      title={isEdit ? "Cambiar el rol del acceso" : "Otorgar acceso a un departamento"}
      description={
        isEdit
          ? `${staffName} conserva el acceso y pasa a entrar con otro rol.`
          : `${staffName} podrá ver y trabajar los recursos de ese departamento, con los permisos del rol que elijas.`
      }
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="access-form" isLoading={isSubmitting}>
            {isEdit ? "Guardar cambios" : "Otorgar acceso"}
          </Button>
        </>
      }
    >
      <form id="access-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <Controller
          name="departmentId"
          control={control}
          render={({ field }) => (
            <SelectField
              label="Departamento"
              required
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              disabled={isEdit}
              placeholder="Elige un departamento"
              options={available.map((department) => ({
                value: String(department.id),
                label: department.name,
              }))}
              state={stateOf("departmentId")}
              error={errors.departmentId?.message}
              hint={
                !isEdit && available.length === 0
                  ? "Ya tiene acceso a todos los departamentos."
                  : undefined
              }
            />
          )}
        />

        <Controller
          name="roleId"
          control={control}
          render={({ field }) => (
            <SelectField
              label="Rol en ese departamento"
              required
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              placeholder="Elige un rol"
              options={assignableRoles.map((role) => ({
                value: String(role.id),
                label: role.isActive ? role.name : `${role.name} (inactivo)`,
                disabled: !role.isActive,
              }))}
              state={stateOf("roleId")}
              error={errors.roleId?.message}
              hint="Solo aplica dentro de este departamento: la misma persona puede tener otro rol en otro."
            />
          )}
        />

        <CheckboxField
          label="Departamento principal"
          description="Es el que aparece en el listado de personal. Marcarlo aquí lo quita del acceso que lo sea hoy."
          disabled={isFirst}
          {...register("isPrimary")}
        />
      </form>
    </Modal>
  );
}
