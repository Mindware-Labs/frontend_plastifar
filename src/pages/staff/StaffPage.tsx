import { Plus, Trash2, UserX } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "../../api/client";
import { departmentsApi } from "../../api/departments";
import { staffApi } from "../../api/staff";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "../../context/AuthContext";
import type { DepartmentResponse, StaffResponse } from "../../types/api";
import { CreateStaffModal } from "./CreateStaffModal";

export function StaffPage() {
  const { user } = useAuth();
  const [staff, setStaff] = useState<StaffResponse[] | null>(null);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([staffApi.list(), departmentsApi.list()])
      .then(([staffList, departmentList]) => {
        setStaff(staffList);
        setDepartments(departmentList);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "No se pudo cargar el personal"),
      );
  }, []);

  function departmentName(id: number) {
    return departments.find((d) => d.id === id)?.name ?? "—";
  }

  async function handleDeactivate(member: StaffResponse) {
    if (!confirm(`¿Desactivar a ${member.firstName} ${member.lastName}?`)) return;

    setBusyId(member.id);
    setError(null);
    try {
      await staffApi.deactivate(member.id);
      setStaff((prev) =>
        prev?.map((s) => (s.id === member.id ? { ...s, isActive: false } : s)) ?? null,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo desactivar el usuario");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(member: StaffResponse) {
    if (
      !confirm(
        `¿Eliminar permanentemente a ${member.firstName} ${member.lastName}? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }

    setBusyId(member.id);
    setError(null);
    try {
      await staffApi.remove(member.id);
      setStaff((prev) => prev?.filter((s) => s.id !== member.id) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo eliminar el usuario");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-zinc-900">Personal</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Staff con acceso al sistema. El alta siempre es interna, no hay registro público.
          </p>
        </div>
        {user?.isAdmin && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            Agregar personal
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <Card>
        {staff === null ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : staff.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-zinc-500">
            Todavía no hay personal registrado.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-6 py-3 font-medium">Nombre</th>
                <th className="px-6 py-3 font-medium">Correo</th>
                <th className="px-6 py-3 font-medium">Departamento</th>
                <th className="px-6 py-3 font-medium">Rol</th>
                <th className="px-6 py-3 font-medium">Estado</th>
                {user?.isAdmin && <th className="px-6 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {staff.map((member) => (
                <tr key={member.id}>
                  <td className="px-6 py-3.5 font-medium text-zinc-900">
                    {member.firstName} {member.lastName}
                  </td>
                  <td className="px-6 py-3.5 text-zinc-600">{member.email}</td>
                  <td className="px-6 py-3.5 text-zinc-600">
                    {departmentName(member.primaryDepartmentId)}
                  </td>
                  <td className="px-6 py-3.5">
                    {member.isAdmin ? (
                      <Badge variant="red">Administrador</Badge>
                    ) : (
                      <Badge variant="neutral">Staff</Badge>
                    )}
                  </td>
                  <td className="px-6 py-3.5">
                    {member.isActive ? (
                      <Badge variant="success">Activo</Badge>
                    ) : (
                      <Badge variant="neutral">Inactivo</Badge>
                    )}
                  </td>
                  {user?.isAdmin && (
                    <td className="px-6 py-3.5 text-right">
                      <div className="flex justify-end gap-1">
                        {member.isActive && member.id !== user.staffId && (
                          <button
                            onClick={() => handleDeactivate(member)}
                            disabled={busyId === member.id}
                            aria-label={`Desactivar a ${member.firstName}`}
                            title="Desactivar"
                            className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-brand-red disabled:opacity-50"
                          >
                            <UserX className="h-4 w-4" />
                          </button>
                        )}
                        {member.id !== user.staffId && (
                          <button
                            onClick={() => handleDelete(member)}
                            disabled={busyId === member.id}
                            aria-label={`Eliminar a ${member.firstName}`}
                            title="Eliminar"
                            className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-brand-red disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {showCreate && (
        <CreateStaffModal
          departments={departments}
          onClose={() => setShowCreate(false)}
          onCreated={(newStaff) => setStaff((prev) => [...(prev ?? []), newStaff])}
        />
      )}
    </div>
  );
}
