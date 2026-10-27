import { KeyRound, Lock, Pencil, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { permissionsApi } from "../../api/permissions";
import { rolesApi, type RoleQuery } from "../../api/roles";
import { HeaderCounts } from "../../components/app/HeaderCounts";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { EmptyResult } from "../../components/ui/EmptyResult";
import { HeaderTag } from "../../components/ui/HeaderTag";
import { Pagination } from "../../components/ui/Pagination";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { Spinner } from "../../components/ui/Spinner";
import { StatusDot } from "../../components/ui/StatusDot";
import { useAuth } from "../../context/useAuth";
import { useCatalogActions } from "../../hooks/useCatalogActions";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { useUrlNumber, useUrlState } from "../../hooks/useUrlState";
import { staleClass } from "../../lib/listState";
import type { RoleListResponse, RoleResponse } from "../../types/api";
import type { PermissionMatrixResponse } from "../../types/permissions";
import { PermissionsView } from "../permissions/PermissionsPage";
import { RoleModal } from "./RoleModal";
import { RolePermissionsDrawer } from "./RolePermissionsDrawer";
import { PAGE_SIZES } from "../../lib/pageSizes";

type FilterKey = "todos" | "activos" | "sistema" | "personalizados";
type TabKey = "roles" | "permisos";

const FILTER_KEYS: FilterKey[] = ["todos", "activos", "sistema", "personalizados"];
const TAB_KEYS: TabKey[] = ["roles", "permisos"];

export function RolesPage() {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.isAdmin);

  // `?tab=permisos` abre la matriz; la vista de roles es la de por defecto.
  const [currentTab, setTab] = useUrlState<TabKey>("tab", "roles", TAB_KEYS);

  const { modal, setModal, busyId, confirm, dialog } = useCatalogActions<RoleResponse>();

  // Drawer lateral para ver y editar permisos del rol seleccionado
  const [permissionDrawerRole, setPermissionDrawerRole] = useState<RoleResponse | null>(null);

  // Catálogo completo de permisos en caché para el drawer
  const [matrix, setMatrix] = useState<PermissionMatrixResponse | null>(null);

  useEffect(() => {
    permissionsApi
      .matrix()
      .then(setMatrix)
      .catch(() => {});
  }, []);

  const [search, setSearch] = useUrlState<string>("q", "");
  const [filter, setFilter] = useUrlState<FilterKey>("estado", "todos", FILTER_KEYS);
  const [pageSize, setPageSize] = useUrlNumber("tam", 10, PAGE_SIZES);
  const debouncedSearch = useDebouncedValue(search).trim();

  const { data, isStale, error, setPage, refresh } = usePagedList<RoleQuery, RoleListResponse>({
    fetch: rolesApi.list,
    criteria: { pageSize, search: debouncedSearch || undefined, status: filter },
    fallbackError: "No se pudieron cargar los roles",
    pageKey: "pagina",
  });

  const rows = data?.items ?? [];
  const counts = data?.counts;
  const unfiltered = filter === "todos" && !debouncedSearch;

  function clearAll() {
    setSearch("");
    setFilter("todos");
  }

  /** Los roles del sistema no se tocan: sostienen los permisos base. */
  function canManage(role: RoleResponse) {
    return isAdmin && !role.isSystem;
  }

  function askDelete(role: RoleResponse) {
    confirm(role.id, {
      tone: "danger",
      icon: Trash2,
      title: "Eliminar rol",
      description: (
        <>
          Se eliminará el rol <strong className="font-semibold text-ink">{role.name}</strong>. Esta
          acción no se puede deshacer. Si ya está asignado a alguien, desactívalo en su lugar.
        </>
      ),
      confirmLabel: "Eliminar",
      onConfirm: async () => {
        await rolesApi.remove(role.id);
        refresh();
      },
    });
  }

  // Selector segmentado de vista (Roles / Matriz de permisos)
  const tabSwitcher = (
    <div
      role="tablist"
      aria-label="Vistas de roles y permisos"
      className="inline-flex h-8 items-center gap-0.5 rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 shadow-2xs shrink-0"
    >
      <button
        type="button"
        role="tab"
        aria-selected={currentTab === "roles"}
        onClick={() => setTab("roles")}
        className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] transition-colors duration-150 outline-none select-none cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-red/25 ${
          currentTab === "roles"
            ? "border border-zinc-200 bg-white font-semibold text-zinc-900 shadow-2xs"
            : "border-transparent font-medium text-zinc-500 hover:bg-white/60 hover:text-zinc-800"
        }`}
      >
        <ShieldCheck
          className={`h-3.5 w-3.5 ${currentTab === "roles" ? "text-brand-red" : "text-zinc-400"}`}
        />
        <span>Roles</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={currentTab === "permisos"}
        onClick={() => setTab("permisos")}
        className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] transition-colors duration-150 outline-none select-none cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-red/25 ${
          currentTab === "permisos"
            ? "border border-zinc-200 bg-white font-semibold text-zinc-900 shadow-2xs"
            : "border-transparent font-medium text-zinc-500 hover:bg-white/60 hover:text-zinc-800"
        }`}
      >
        <KeyRound
          className={`h-3.5 w-3.5 ${currentTab === "permisos" ? "text-brand-red" : "text-zinc-400"}`}
        />
        <span>Matriz de permisos</span>
      </button>
    </div>
  );

  // Si estamos en la pestaña de matriz de permisos, renderizamos la vista de matriz embebida
  if (currentTab === "permisos") {
    return (
      <div className="flex h-full flex-col">
        <PermissionsView
          title="Roles y Permisos"
          headerExtra={tabSwitcher}
          onMatrixLoaded={setMatrix}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        title="Roles y Permisos"
        summary={
          <HeaderCounts counts={counts} loadingLabel="Cargando los roles del sistema…">
            {(counts) => (
              <>
                <HeaderTag
                  label={counts.all === 1 ? "rol" : "roles"}
                  count={counts.all}
                  active={filter === "todos"}
                  onClick={() => {
                    setFilter("todos");
                    setPage(1);
                  }}
                  tone="neutral"
                  title="Mostrar todos los roles"
                />
                <HeaderTag
                  label={counts.active === 1 ? "activo" : "activos"}
                  count={counts.active}
                  active={filter === "activos"}
                  onClick={() => {
                    setFilter("activos");
                    setPage(1);
                  }}
                  tone="emerald"
                  dot
                  title="Filtrar por roles activos"
                />
                <HeaderTag
                  label="del sistema"
                  count={counts.system}
                  active={filter === "sistema"}
                  onClick={() => {
                    setFilter("sistema");
                    setPage(1);
                  }}
                  tone="blue"
                  dot
                  title="Filtrar por roles del sistema"
                />
                <HeaderTag
                  label="personalizados"
                  count={counts.custom}
                  active={filter === "personalizados"}
                  onClick={() => {
                    setFilter("personalizados");
                    setPage(1);
                  }}
                  tone="amber"
                  dot
                  title="Filtrar por roles personalizados"
                />
              </>
            )}
          </HeaderCounts>
        }
        action={
          <div className="flex items-center gap-2">
            {tabSwitcher}
            {isAdmin && (
              <Button size="sm" onClick={() => setModal("nuevo")}>
                <Plus className="h-[15px] w-[15px]" />
                Nuevo rol
              </Button>
            )}
          </div>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto pb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar por nombre de rol…"
              className="w-[240px] sm:w-[260px]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                title="Limpiar búsqueda"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-[12.5px] font-medium text-zinc-600 shadow-2xs hover:bg-zinc-50 hover:border-zinc-300 transition-all cursor-pointer active:scale-[0.98]"
              >
                <X className="h-3.5 w-3.5 text-zinc-400" />
                <span>Limpiar</span>
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-3">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        {data === null ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : (
          <div className={staleClass(isStale)}>
            <DataTable>
              <thead>
                <HeadRow>
                  <Th>Nombre</Th>
                  <Th>Tipo</Th>
                  <Th>Permisos</Th>
                  <Th>Estado</Th>
                  {isAdmin && <Th className="w-28 text-right">Acciones</Th>}
                </HeadRow>
              </thead>
              <tbody>
                {rows.map((role) => (
                  <Row
                    key={role.id}
                    busy={busyId === role.id}
                    onClick={() => setPermissionDrawerRole(role)}
                    className="cursor-pointer hover:bg-zinc-50/80 transition-colors group"
                  >
                    <Td className="text-[13px] font-semibold text-ink group-hover:text-brand-red transition-colors">
                      {role.name}
                    </Td>
                    <Td>
                      {role.isSystem ? (
                        <Badge tone="neutral">Sistema</Badge>
                      ) : (
                        <Badge tone="green">Personalizado</Badge>
                      )}
                    </Td>
                    <Td>
                      {role.isSystem ? (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setPermissionDrawerRole(role);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/90 bg-zinc-100/80 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-600 select-none cursor-pointer hover:bg-zinc-200/70 hover:border-zinc-300 transition-colors"
                          title="Ver permisos protegidos del sistema"
                        >
                          <Lock className="h-3 w-3 text-zinc-400" />
                          <span>Catálogo completo</span>
                        </span>
                      ) : (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setPermissionDrawerRole(role);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-700 hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-900 transition-colors select-none cursor-pointer shadow-2xs"
                          title="Ver y configurar permisos del rol"
                        >
                          <KeyRound className="h-3 w-3 text-brand-red" />
                          <span>
                            {role.permissions.length}{" "}
                            {role.permissions.length === 1 ? "permiso" : "permisos"}
                          </span>
                        </span>
                      )}
                    </Td>
                    <Td>
                      <StatusDot active={role.isActive} />
                    </Td>
                    {isAdmin && (
                      <Td onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <RowAction
                            label={`Ver permisos de ${role.name}`}
                            icon={KeyRound}
                            onClick={() => setPermissionDrawerRole(role)}
                          />
                          {canManage(role) && (
                            <>
                              <RowAction
                                label={`Editar datos de ${role.name}`}
                                icon={Pencil}
                                onClick={() => setModal(role)}
                                disabled={busyId === role.id}
                              />
                              <RowAction
                                label={`Eliminar ${role.name}`}
                                icon={Trash2}
                                onClick={() => askDelete(role)}
                                disabled={busyId === role.id}
                                danger
                              />
                            </>
                          )}
                        </div>
                      </Td>
                    )}
                  </Row>
                ))}
              </tbody>
            </DataTable>

            {rows.length === 0 &&
              (unfiltered ? (
                <p className="py-14 text-center text-[13.5px] text-faint">Todavía no hay roles creados.</p>
              ) : (
                <EmptyResult message="Ningún rol coincide con este filtro o búsqueda." onClear={clearAll} />
              ))}

            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              totalPages={data.totalPages}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              noun="roles"
            />
          </div>
        )}
      </div>

      {dialog}

      {modal !== null && (
        <RoleModal
          role={modal === "nuevo" ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={(savedRole) => {
            refresh();
            // Si acabamos de crear un rol nuevo, abrir directamente el drawer de permisos para asignarle
            if (modal === "nuevo") {
              setPermissionDrawerRole(savedRole);
            }
          }}
        />
      )}

      {/* Drawer lateral editorial para ver y editar permisos del rol */}
      {permissionDrawerRole !== null && (
        <RolePermissionsDrawer
          role={permissionDrawerRole}
          matrix={matrix}
          onClose={() => setPermissionDrawerRole(null)}
          onSaved={(_updated) => {
            refresh();
            setPermissionDrawerRole(null);
          }}
          onEditRole={(role) => {
            setPermissionDrawerRole(null);
            setModal(role);
          }}
        />
      )}
    </div>
  );
}
