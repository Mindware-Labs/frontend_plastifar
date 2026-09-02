import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../../api/client";
import { rolesApi, type RoleQuery } from "../../api/roles";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { FilterChip } from "../../components/ui/FilterChip";
import { Pagination } from "../../components/ui/Pagination";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "../../context/AuthContext";
import type { RoleListResponse, RoleResponse } from "../../types/api";
import { RoleModal } from "./RoleModal";

type FilterKey = "todos" | "activos" | "sistema" | "personalizados";

const filters: { key: FilterKey; label: string; countKey: keyof RoleListResponse["counts"] }[] = [
  { key: "todos", label: "Todos", countKey: "all" },
  { key: "activos", label: "Activos", countKey: "active" },
  { key: "sistema", label: "Del sistema", countKey: "system" },
  { key: "personalizados", label: "Personalizados", countKey: "custom" },
];

const headClass =
  "px-3.5 py-2.5 font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-faint";

export function RolesPage() {
  const { user } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(
    null,
  );
  // null = cerrado, "nuevo" = alta, un RoleResponse = edicion de esa fila.
  const [modal, setModal] = useState<"nuevo" | RoleResponse | null>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("todos");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [reloadKey, setReloadKey] = useState(0);

  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Cambiar de criterio invalida la pagina actual: siempre se vuelve a la primera.
  const criteria = `${debouncedSearch}|${filter}|${pageSize}`;
  const [lastCriteria, setLastCriteria] = useState(criteria);
  if (criteria !== lastCriteria) {
    setLastCriteria(criteria);
    setPage(1);
  }

  const query = useMemo<RoleQuery>(
    () => ({
      page,
      pageSize,
      search: debouncedSearch.trim() || undefined,
      status: filter,
    }),
    [page, pageSize, debouncedSearch, filter],
  );

  const queryKey = `${JSON.stringify(query)}|${reloadKey}`;
  const [snapshot, setSnapshot] = useState<{ key: string; data: RoleListResponse } | null>(null);

  useEffect(() => {
    let cancelled = false;

    rolesApi
      .list(query)
      .then((data) => {
        if (cancelled) return;
        setSnapshot({ key: queryKey, data });
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "No se pudieron cargar los roles");
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

  function refresh() {
    setReloadKey((value) => value + 1);
  }

  /** Los roles del sistema no se tocan: sostienen los permisos base. */
  function canManage(role: RoleResponse) {
    return Boolean(user?.isAdmin) && !role.isSystem;
  }

  function askDelete(role: RoleResponse) {
    setConfirmation({
      tone: "danger",
      icon: Trash2,
      eyebrow: "Personal · Roles",
      title: "Eliminar rol",
      description: (
        <>
          Se eliminará el rol <strong className="font-semibold text-ink">{role.name}</strong>. Esta
          acción no se puede deshacer. Si ya está asignado a alguien, desactívalo en su lugar.
        </>
      ),
      confirmLabel: "Eliminar",
      // El error sube al diálogo, que lo muestra sin cerrarse.
      onConfirm: async () => {
        setBusyId(role.id);
        setError(null);
        try {
          await rolesApi.remove(role.id);
          refresh();
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  return (
    <div>
      <ModuleHeader
        summary={
          counts
            ? `${counts.all} roles definidos · ${counts.custom} personalizados · los permisos llegan en una fase posterior`
            : "Cargando los roles del sistema…"
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
              Nuevo rol
            </button>
          )
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nombre de rol…"
          className="w-[240px]"
        />

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
                    <th className={headClass}>Nombre</th>
                    <th className={headClass}>Tipo</th>
                    <th className={headClass}>Estado</th>
                    <th className={`${headClass} w-24 text-right`}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((role) => (
                    <tr
                      key={role.id}
                      className={`border-b border-line-soft transition-colors last:border-0
                        hover:bg-canvas [&>td:first-child]:pl-0 [&>td:last-child]:pr-0
                        ${busyId === role.id ? "opacity-50" : ""}`}
                    >
                      <td className="px-3.5 py-2.5 text-[13px] font-medium text-ink">{role.name}</td>
                      <td className="px-3.5 py-2.5">
                        {role.isSystem ? (
                          <span
                            className="inline-flex h-[22px] items-center rounded-full bg-fill px-2.5
                              text-[11.5px] font-semibold text-brand-gray"
                          >
                            Sistema
                          </span>
                        ) : (
                          <span
                            className="inline-flex h-[22px] items-center rounded-full bg-brand-green/8 px-2.5
                              text-[11.5px] font-semibold text-brand-green"
                          >
                            Personalizado
                          </span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span className="inline-flex items-center gap-[7px] whitespace-nowrap text-[12.5px] text-brand-gray">
                          <span
                            className={`h-[7px] w-[7px] shrink-0 rounded-full ${
                              role.isActive ? "bg-brand-green" : "bg-zinc-300"
                            }`}
                          />
                          {role.isActive ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5">
                        {canManage(role) && (
                          <div className="flex items-center justify-end gap-1">
                            <RowAction
                              label={`Editar el rol ${role.name}`}
                              icon={Pencil}
                              onClick={() => setModal(role)}
                              disabled={busyId === role.id}
                            />
                            <RowAction
                              label={`Eliminar el rol ${role.name}`}
                              icon={Trash2}
                              onClick={() => askDelete(role)}
                              disabled={busyId === role.id}
                              danger
                            />
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
                    ? "Todavía no hay roles creados."
                    : "Ningún rol coincide con este filtro o búsqueda."}
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
                noun="roles"
              />
            )}
          </div>
        )}
      </div>

      {confirmation && (
        <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />
      )}

      {modal !== null && (
        <RoleModal
          role={modal === "nuevo" ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
