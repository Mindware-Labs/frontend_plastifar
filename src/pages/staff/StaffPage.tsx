import { LogOut, Pencil, Plus, Trash2, UserX } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { departmentsApi } from "../../api/departments";
import { staffApi, type StaffQuery } from "../../api/staff";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th, type SortDir } from "../../components/ui/DataTable";
import { FilterChip } from "../../components/ui/FilterChip";
import { Pagination } from "../../components/ui/Pagination";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { Select } from "../../components/ui/Select";
import { Spinner } from "../../components/ui/Spinner";
import { StatusDot } from "../../components/ui/StatusDot";
import { useAuth } from "../../context/useAuth";
import { usePermissions } from "../../hooks/usePermissions";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import type { DepartmentResponse, StaffListResponse, StaffResponse } from "../../types/api";
import { StaffModal } from "./StaffModal";

type FilterKey = "todos" | "activos" | "inactivos" | "administradores";
type SortKey = "nombre" | "correo" | "departamento" | "rol" | "estado";

const filters: { key: FilterKey; label: string; countKey: keyof StaffListResponse["counts"] }[] = [
  { key: "todos", label: "Todos", countKey: "all" },
  { key: "activos", label: "Activos", countKey: "active" },
  { key: "inactivos", label: "Inactivos", countKey: "inactive" },
  { key: "administradores", label: "Administradores", countKey: "admins" },
];

const columns: { key: SortKey; label: string }[] = [
  { key: "nombre", label: "Nombre" },
  { key: "correo", label: "Correo" },
  { key: "departamento", label: "Departamento" },
  { key: "rol", label: "Rol" },
  { key: "estado", label: "Estado" },
];

export function StaffPage() {
  const { user } = useAuth();
  // El permiso, no el perfil: un administrador lo tiene por definicion, pero un
  // rol con staff.write tambien, y hasta ahora la interfaz no lo contemplaba.
  const { can } = usePermissions();
  const canWrite = can("staff.write");

  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  // Confirmacion propia del panel; null = ninguna pendiente.
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(
    null,
  );
  // null = cerrado, "nuevo" = alta, un StaffResponse = edicion de esa fila.
  const [modal, setModal] = useState<"nuevo" | StaffResponse | null>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("todos");
  const [departmentId, setDepartmentId] = useState<number | "todos">("todos");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "nombre", dir: "asc" });
  const [pageSize, setPageSize] = useState(10);
  const debouncedSearch = useDebouncedValue(search).trim();

  useEffect(() => {
    departmentsApi
      .list()
      .then(setDepartments)
      .catch(() => setDepartments([]));
  }, []);

  const { data, isStale, error, setPage, refresh } = usePagedList<StaffQuery, StaffListResponse>({
    fetch: staffApi.list,
    criteria: {
      pageSize,
      search: debouncedSearch || undefined,
      departmentId: departmentId === "todos" ? undefined : departmentId,
      status: filter,
      sort: sort.key,
      dir: sort.dir,
    },
    fallbackError: "No se pudo cargar el personal",
  });

  const rows = data?.items ?? [];
  const counts = data?.counts;
  const unfiltered = filter === "todos" && departmentId === "todos" && !debouncedSearch;

  function departmentName(id: number) {
    return departments.find((d) => d.id === id)?.name ?? "—";
  }

  function fullName(member: StaffResponse) {
    return `${member.firstName} ${member.lastName}`;
  }

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  /** Desactivar y eliminar nunca aplican sobre uno mismo; editar si. */
  function canManage(member: StaffResponse) {
    return canWrite && member.id !== user?.staffId;
  }

  /** El error sube al dialogo, que lo muestra sin cerrarse. */
  async function runOnRow(id: number, action: () => Promise<void>) {
    setBusyId(id);
    try {
      await action();
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  function askDeactivate(member: StaffResponse) {
    setConfirmation({
      tone: "warn",
      icon: UserX,
      title: "Desactivar colaborador",
      description: (
        <>
          <strong className="font-semibold text-ink">{fullName(member)}</strong> dejará de poder
          iniciar sesión y sus sesiones abiertas se cerrarán. La cuenta y su historial se conservan,
          y puedes reactivarla cuando quieras.
        </>
      ),
      confirmLabel: "Desactivar",
      onConfirm: () => runOnRow(member.id, () => staffApi.deactivate(member.id)),
    });
  }

  function askRevokeSessions(member: StaffResponse) {
    setConfirmation({
      tone: "warn",
      icon: LogOut,
      title: "Cerrar sesiones",
      description: (
        <>
          Se cerrarán todas las sesiones abiertas de{" "}
          <strong className="font-semibold text-ink">{fullName(member)}</strong>, en cualquier
          dispositivo. La cuenta sigue activa: podrá volver a entrar con su contraseña.
        </>
      ),
      confirmLabel: "Cerrar sesiones",
      onConfirm: () => runOnRow(member.id, () => staffApi.revokeSessions(member.id)),
    });
  }

  function askDelete(member: StaffResponse) {
    setConfirmation({
      tone: "danger",
      icon: Trash2,
      title: "Eliminar colaborador",
      description: (
        <>
          Se eliminará permanentemente a{" "}
          <strong className="font-semibold text-ink">{fullName(member)}</strong>. Esta acción no se
          puede deshacer. Si ya tiene actividad registrada en el sistema, desactívalo en su lugar.
        </>
      ),
      confirmLabel: "Eliminar",
      onConfirm: () => runOnRow(member.id, () => staffApi.remove(member.id)),
    });
  }

  return (
    <div>
      <ModuleHeader
        action={
          canWrite && (
            <Button size="sm" onClick={() => setModal("nuevo")}>
              <Plus className="h-[15px] w-[15px]" />
              Nuevo colaborador
            </Button>
          )
        }
      />

      {/* Criterios: busqueda, departamento y pastillas de estado */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nombre o correo…"
          className="w-[240px]"
        />

        <Select
          size="sm"
          className="w-[220px]"
          aria-label="Filtrar por departamento"
          value={String(departmentId)}
          onChange={(next) => setDepartmentId(next === "todos" ? "todos" : Number(next))}
          options={[
            { value: "todos", label: "Todos los departamentos" },
            ...departments.map((department) => ({
              value: String(department.id),
              label: department.name,
            })),
          ]}
        />

        <span aria-hidden className="mx-1 h-5 w-px bg-line" />

        {/* Esqueleto antes de la primera respuesta: un cero es una afirmacion. */}
        {counts === undefined
          ? filters.map(({ key }) => (
              <span key={key} aria-hidden className="h-8 w-[104px] animate-pulse rounded-full bg-fill" />
            ))
          : filters.map(({ key, label, countKey }) => (
              <FilterChip
                key={key}
                label={label}
                count={counts[countKey]}
                active={filter === key}
                onClick={() => setFilter(key)}
              />
            ))}
      </div>

      {error && (
        <div className="mb-3 flex items-start gap-3">
          <Alert variant="error">{error}</Alert>
          <Button size="sm" variant="secondary" onClick={refresh}>
            Reintentar
          </Button>
        </div>
      )}

      {/* Con error no queda spinner girando debajo del aviso. */}
      {data === null ? (
        error === null && (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        )
      ) : (
        <div className={`transition-opacity ${isStale ? "opacity-60" : ""}`}>
          {/* Sin filas se retira la tabla entera: dejar la cabecera puesta deja
              el mensaje colgando bajo un filete de columnas que no existen. */}
          {rows.length === 0 ? (
            <p className="py-14 text-center text-[13.5px] text-faint">
              {unfiltered
                ? "Todavía no hay personal registrado."
                : "Ningún colaborador coincide con este filtro o búsqueda."}
            </p>
          ) : (
          <DataTable>
            <thead>
              <HeadRow>
                {columns.map(({ key, label }) => (
                  <Th
                    key={key}
                    sort={{ dir: sort.key === key ? sort.dir : null, onToggle: () => toggleSort(key) }}
                  >
                    {label}
                  </Th>
                ))}
                {canWrite && <Th className="w-24 text-right">Acciones</Th>}
              </HeadRow>
            </thead>

            <tbody>
              {rows.map((member) => (
                <Row key={member.id} busy={busyId === member.id}>
                  <Td>
                    <Link
                      to={`/staff/${member.id}`}
                      className="flex items-center gap-2.5 rounded-edge underline-offset-4
                        outline-none focus-visible:ring-3 focus-visible:ring-brand-red/20"
                    >
                      <Avatar name={fullName(member)} seed={member.id} />
                      <span className="whitespace-nowrap text-[13px] font-medium text-ink hover:underline">
                        {fullName(member)}
                      </span>
                    </Link>
                  </Td>
                  <Td className="text-[12.5px] text-brand-gray">{member.email}</Td>
                  <Td className="text-[12.5px] text-brand-gray">
                    {departmentName(member.primaryDepartmentId)}
                  </Td>
                  <Td>
                    {member.isAdmin ? <Badge tone="red">Administrador</Badge> : <Badge>Staff</Badge>}
                  </Td>
                  <Td>
                    <StatusDot active={member.isActive} />
                  </Td>
                  {canWrite && (
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        <RowAction
                          label={`Editar a ${fullName(member)}`}
                          icon={Pencil}
                          onClick={() => setModal(member)}
                          disabled={busyId === member.id}
                        />
                        {member.isActive && canManage(member) && (
                          <>
                            <RowAction
                              label={`Cerrar las sesiones de ${fullName(member)}`}
                              icon={LogOut}
                              onClick={() => askRevokeSessions(member)}
                              disabled={busyId === member.id}
                            />
                            <RowAction
                              label={`Desactivar a ${fullName(member)}`}
                              icon={UserX}
                              onClick={() => askDeactivate(member)}
                              disabled={busyId === member.id}
                            />
                          </>
                        )}
                        {canManage(member) && (
                          <RowAction
                            label={`Eliminar a ${fullName(member)}`}
                            icon={Trash2}
                            onClick={() => askDelete(member)}
                            disabled={busyId === member.id}
                            danger
                          />
                        )}
                      </div>
                    </Td>
                  )}
                </Row>
              ))}
            </tbody>
          </DataTable>
          )}

          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            totalPages={data.totalPages}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            noun="colaboradores"
          />
        </div>
      )}

      {confirmation && (
        <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />
      )}

      {modal !== null && (
        <StaffModal
          departments={departments}
          staff={modal === "nuevo" ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
