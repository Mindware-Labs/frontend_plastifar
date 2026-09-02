import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "../../api/client";
import { rolesApi } from "../../api/roles";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "../../context/AuthContext";
import type { RoleResponse } from "../../types/api";
import { CreateRoleModal } from "./CreateRoleModal";

export function RolesPage() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<RoleResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    rolesApi
      .list()
      .then(setRoles)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "No se pudieron cargar los roles"),
      );
  }, []);

  async function handleDelete(role: RoleResponse) {
    if (!confirm(`¿Eliminar el rol "${role.name}"?`)) return;

    setDeletingId(role.id);
    setError(null);
    try {
      await rolesApi.remove(role.id);
      setRoles((prev) => prev?.filter((r) => r.id !== role.id) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo eliminar el rol");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-zinc-900">Roles</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Define los roles disponibles. Los permisos se asignarán en una fase posterior.
          </p>
        </div>
        {user?.isAdmin && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            Nuevo rol
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <Card>
        {roles === null ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : roles.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-zinc-500">
            Todavía no hay roles creados.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-6 py-3 font-medium">Nombre</th>
                <th className="px-6 py-3 font-medium">Tipo</th>
                <th className="px-6 py-3 font-medium">Estado</th>
                {user?.isAdmin && <th className="px-6 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {roles.map((role) => (
                <tr key={role.id}>
                  <td className="px-6 py-3.5 font-medium text-zinc-900">{role.name}</td>
                  <td className="px-6 py-3.5">
                    {role.isSystem ? (
                      <Badge variant="neutral">Sistema</Badge>
                    ) : (
                      <Badge variant="green">Personalizado</Badge>
                    )}
                  </td>
                  <td className="px-6 py-3.5">
                    {role.isActive ? (
                      <Badge variant="success">Activo</Badge>
                    ) : (
                      <Badge variant="neutral">Inactivo</Badge>
                    )}
                  </td>
                  {user?.isAdmin && (
                    <td className="px-6 py-3.5 text-right">
                      {!role.isSystem && (
                        <button
                          onClick={() => handleDelete(role)}
                          disabled={deletingId === role.id}
                          aria-label={`Eliminar ${role.name}`}
                          className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-brand-red disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {showCreate && (
        <CreateRoleModal
          onClose={() => setShowCreate(false)}
          onCreated={(role) => setRoles((prev) => [...(prev ?? []), role])}
        />
      )}
    </div>
  );
}
