import { ChevronDown, ChevronsUpDown, ChevronUp, Pencil, Plus, Trash2, UserX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../../api/client";
import { departmentsApi } from "../../api/departments";
import { staffApi, type StaffQuery } from "../../api/staff";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { useAppSearch } from "../../components/app/useAppSearch";
import { Alert } from "../../components/ui/Alert";
import { Avatar } from "../../components/ui/Avatar";
import { FilterChip } from "../../components/ui/FilterChip";
import { Pagination } from "../../components/ui/Pagination";
import { RowAction } from "../../components/ui/RowAction";
import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "../../context/AuthContext";
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

const headClass =
  "px-3.5 py-2.5 font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-faint";

export function StaffPage() {
  const { user } = useAuth();
  const search = useAppSearch();

  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  // null = cerrado, "nuevo" = alta, un StaffResponse = edicion de esa fila.
  const [modal, setModal] = useState<"nuevo" | StaffResponse | null>(null);

  const [filter, setFilter] = useState<FilterKey>("todos");
  const [departmentId, setDepartmentId] = useState<number | "todos">("todos");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "nombre",
    dir: "asc",
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    departmentsApi
      .list()
      .then(setDepartments)
      .catch(() => setDepartments([]));
  }, []);

  // El buscador global escribe letra a letra: se espera a que pare para consultar.
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Cambiar de criterio invalida la pagina actual: siempre se vuelve a la primera.
  const criteria = `${debouncedSearch}|${departmentId}|${filter}|${sort.key}|${sort.dir}|${pageSize}`;
  const [lastCriteria, setLastCriteria] = useState(criteria);
  if (criteria !== lastCriteria) {
    setLastCriteria(criteria);
    setPage(1);
  }

  const query = useMemo<StaffQuery>(
    () => ({
      page,
      pageSize,
      search: debouncedSearch.trim() || undefined,
      departmentId: departmentId === "todos" ? undefined : departmentId,
      status: filter,
      sort: sort.key,
      dir: sort.dir,
    }),
    [page, pageSize, debouncedSearch, departmentId, filter, sort],
  );

  const queryKey = `${JSON.stringify(query)}|${reloadKey}`;
  const [snapshot, setSnapshot] = useState<{ key: string; data: StaffListResponse } | null>(null);

  useEffect(() => {
    let cancelled = false;

    staffApi
      .list(query)
      .then((data) => {
        if (cancelled) return;
        setSnapshot({ key: queryKey, data });
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "No se pudo cargar el personal");
      });

    return () => {
      cancelled = true;
    };
  }, [query, queryKey]);

  const data = snapshot?.data ?? null;
  const isStale = snapshot !== null && snapshot.key !== queryKey;
  const rows = data?.items ?? [];
  const counts = data?.counts;

  // Borrar la ultima fila de la ultima pagina deja la pagina fuera de rango.
  if (data && data.totalPages > 0 && page > data.totalPages) setPage(data.totalPages);

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

  /** Tras cada cambio se relee la pagina: totales y contadores vienen del servidor. */
  function refresh() {
    setReloadKey((value) => value + 1);
  }

  /** Desactivar y eliminar nunca aplican sobre uno mismo; editar si. */
  function canManage(member: StaffResponse) {
    return Boolean(user?.isAdmin) && member.id !== user?.staffId;
  }

  async function handleDeactivate(member: StaffResponse) {
    if (!confirm(`¿Desactivar a ${fullName(member)}?`)) return;

    setBusyId(member.id);
    setError(null);
    try {
      await staffApi.deactivate(member.id);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo desactivar el usuario");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(member: StaffResponse) {
    if (
      !confirm(`¿Eliminar permanentemente a ${fullName(member)}? Esta acción no se puede deshacer.`)
    ) {
      return;
    }

    setBusyId(member.id);
    setError(null);
    try {
      await staffApi.remove(member.id);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo eliminar el usuario");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <ModuleHeader
        summary={
          counts
            ? `${counts.all} colaboradores · ${counts.active} activos · ${counts.admins} con permisos de administrador`
            : "Cargando el personal con acceso al sistema…"
        }
        action={
          user?.isAdmin && (
            <button
              type="button"
              onClick={() => setModal("nuevo")}
              className="flex h-8 items-center gap-2 rounded-edge bg-brand-red px-3.5 font-heading text-[11.5px]
                font-semibold uppercase tracking-[0.06em] text-white
                shadow-[0_10px_20px_-12px_rgba(228,0,43,0.55)]
                transition-[filter,transform] hover:brightness-105 active:translate-y-px"
            >
              <Plus className="h-[15px] w-[15px]" />
              Agregar personal
            </button>
          )
        }
      />

      {/* Criterios: departamento y pastillas de estado */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <select
            value={departmentId}
            onChange={(event) =>
              setDepartmentId(event.target.value === "todos" ? "todos" : Number(event.target.value))
            }
            aria-label="Filtrar por departamento"
            className="h-8 appearance-none rounded-edge border border-line-strong bg-white pl-3 pr-8
              text-[12.5px] font-medium text-brand-gray outline-none transition-colors
              hover:border-zinc-400 focus:border-brand-red"
          >
            <option value="todos">Todos los departamentos</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-2 h-4 w-4 text-faint" />
        </div>

        <span className="mx-1 h-5 w-px bg-line" />

        {filters.map(({ key, label, countKey }) => (
          <FilterChip
            key={key}
            label={label}
            count={counts?.[countKey] ?? 0}
            active={filter === key}
            onClick={() => setFilter(key)}
          />
        ))}
      </div>

      {error && (
        <div className="mb-3">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {/* Sin tarjeta: la tabla es la pagina. Solo filetes horizontales. */}
      <div>
        {snapshot === null ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : (
          <div className={`transition-opacity ${isStale ? "opacity-60" : ""}`}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-line [&>th:first-child]:pl-0 [&>th:last-child]:pr-0">
                    {columns.map(({ key, label }) => (
                      <th key={key} className={headClass}>
                        <button
                          type="button"
                          onClick={() => toggleSort(key)}
                          className="inline-flex items-center gap-1.5 transition-colors hover:text-ink"
                        >
                          {label}
                          {sort.key !== key ? (
                            <ChevronsUpDown className="h-3 w-3" />
                          ) : sort.dir === "asc" ? (
                            <ChevronUp className="h-3 w-3 text-brand-red" />
                          ) : (
                            <ChevronDown className="h-3 w-3 text-brand-red" />
                          )}
                        </button>
                      </th>
                    ))}
                    <th className={`${headClass} w-28 text-right`}>Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((member) => (
                    <tr
                      key={member.id}
                      className={`border-b border-line-soft transition-colors last:border-0
                        hover:bg-canvas [&>td:first-child]:pl-0 [&>td:last-child]:pr-0
                        ${busyId === member.id ? "opacity-50" : ""}`}
                    >
                      <td className="px-3.5 py-2.5">
                        <span className="flex items-center gap-2.5">
                          <Avatar name={fullName(member)} seed={member.id} />
                          <span className="whitespace-nowrap text-[13px] font-medium text-ink">
                            {fullName(member)}
                          </span>
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-[12.5px] text-brand-gray">
                        {member.email}
                      </td>
                      <td className="px-3.5 py-2.5 text-[12.5px] text-brand-gray">
                        {departmentName(member.primaryDepartmentId)}
                      </td>
                      <td className="px-3.5 py-2.5">
                        {member.isAdmin ? (
                          <span
                            className="inline-flex h-[22px] items-center rounded-full bg-brand-red/8 px-2.5
                              text-[11.5px] font-semibold text-brand-red-dark"
                          >
                            Administrador
                          </span>
                        ) : (
                          <span
                            className="inline-flex h-[22px] items-center rounded-full bg-fill px-2.5
                              text-[11.5px] font-semibold text-brand-gray"
                          >
                            Staff
                          </span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span className="inline-flex items-center gap-[7px] whitespace-nowrap text-[12.5px] text-brand-gray">
                          <span
                            className={`h-[7px] w-[7px] shrink-0 rounded-full ${
                              member.isActive ? "bg-brand-green" : "bg-zinc-300"
                            }`}
                          />
                          {member.isActive ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5">
                        {user?.isAdmin && (
                          <div className="flex items-center justify-end gap-1">
                            <RowAction
                              label={`Editar a ${fullName(member)}`}
                              icon={Pencil}
                              onClick={() => setModal(member)}
                              disabled={busyId === member.id}
                            />
                            {member.isActive && canManage(member) && (
                              <RowAction
                                label={`Desactivar a ${fullName(member)}`}
                                icon={UserX}
                                onClick={() => handleDeactivate(member)}
                                disabled={busyId === member.id}
                              />
                            )}
                            {canManage(member) && (
                              <RowAction
                                label={`Eliminar a ${fullName(member)}`}
                                icon={Trash2}
                                onClick={() => handleDelete(member)}
                                disabled={busyId === member.id}
                                danger
                              />
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {rows.length === 0 && (
              <div className="py-14 text-center">
                <p className="text-[13.5px] text-faint">
                  {counts?.all === 0 && filter === "todos"
                    ? "Todavía no hay personal registrado."
                    : "Ningún colaborador coincide con este filtro o búsqueda."}
                </p>
              </div>
            )}

            {data && (
              <Pagination
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                totalPages={data.totalPages}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                noun="colaboradores"
              />
            )}
          </div>
        )}
      </div>

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
