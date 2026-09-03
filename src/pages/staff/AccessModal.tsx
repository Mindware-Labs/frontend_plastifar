import { useState } from "react";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { CheckboxField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import type { DepartmentAccess, RoleSummary } from "../../types/permissions";

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
  onSave: (value: { departmentId: number; roleId: number; isPrimary: boolean }) => void;
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

  const [departmentId, setDepartmentId] = useState(access ? String(access.departmentId) : "");
  const [roleId, setRoleId] = useState(access ? String(access.roleId) : "");
  const [isPrimary, setIsPrimary] = useState(access?.isPrimary ?? isFirst);
  const [error, setError] = useState<string | null>(null);

  const available = departments.filter(
    (department) => isEdit || !taken.includes(department.id),
  );

  // Un rol inactivo no puede asignarse a nadie nuevo, pero si ya estaba asignado
  // se muestra para no romper la ficha de quien lo tiene.
  const assignableRoles = roles.filter(
    (role) => !role.grantsAll && (role.isActive || String(role.id) === roleId),
  );

  function submit() {
    if (departmentId === "") {
      setError("Elige el departamento al que le das acceso");
      return;
    }
    if (roleId === "") {
      setError("Elige con qué rol entra a ese departamento");
      return;
    }

    onSave({ departmentId: Number(departmentId), roleId: Number(roleId), isPrimary });
    onClose();
  }

  return (
    <Modal
      eyebrow="Personal · Accesos"
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
          <Button type="button" onClick={submit}>
            {isEdit ? "Guardar cambios" : "Otorgar acceso"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Alert variant="error">{error}</Alert>}

        <label className="flex flex-col gap-1.5">
          <span className="font-heading text-[11px] font-semibold uppercase tracking-[0.06em] text-brand-gray">
            Departamento
          </span>
          <Select
            value={departmentId}
            onChange={setDepartmentId}
            disabled={isEdit}
            placeholder="Elige un departamento"
            options={available.map((department) => ({
              value: String(department.id),
              label: department.name,
            }))}
          />
          {!isEdit && available.length === 0 && (
            <span className="text-[11.5px] text-faint">
              Ya tiene acceso a todos los departamentos.
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-heading text-[11px] font-semibold uppercase tracking-[0.06em] text-brand-gray">
            Rol en ese departamento
          </span>
          <Select
            value={roleId}
            onChange={setRoleId}
            placeholder="Elige un rol"
            options={assignableRoles.map((role) => ({
              value: String(role.id),
              label: role.isActive ? role.name : `${role.name} (inactivo)`,
              disabled: !role.isActive,
            }))}
          />
          <span className="text-[11.5px] leading-relaxed text-faint">
            El rol solo aplica dentro de este departamento. La misma persona puede tener otro rol
            distinto en otro.
          </span>
        </label>

        <CheckboxField
          label="Departamento principal"
          description="Es el que aparece en el listado de personal. Marcarlo aquí lo quita del acceso que lo sea hoy."
          checked={isPrimary}
          disabled={isFirst}
          onChange={(event) => setIsPrimary(event.target.checked)}
        />
      </div>
    </Modal>
  );
}
