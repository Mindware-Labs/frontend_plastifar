import { Ban, CheckCircle2, KeyRound, Lock, Pencil, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../../api/client";
import { useSearchParams } from "react-router-dom";
import { permissionsApi } from "../../api/permissions";
import { rolesApi, type RoleQuery } from "../../api/roles";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { SegmentedTabs } from "../../components/ui/SegmentedTabs";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { HeaderTag } from "../../components/ui/HeaderTag";
import { ListPanel } from "../../components/ui/ListPanel";
import { Pagination } from "../../components/ui/Pagination";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { SelectBox } from "../../components/ui/SelectBox";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { StatusDot } from "../../components/ui/StatusDot";
import { useAuth } from "../../context/useAuth";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useActionErrorReceipt, useLoadErrorReceipt } from "../../hooks/useNoticeReceipts";
import { usePagedList } from "../../hooks/usePagedList";
import { useTablePageSelection } from "../../hooks/useTablePageSelection";
import type { RoleListResponse, RoleResponse } from "../../types/api";
import type { PermissionMatrixResponse } from "../../types/permissions";
import { PermissionsView } from "../permissions/PermissionsPage";
import { RoleModal } from "./RoleModal";
import { RolePermissionsDrawer } from "./RolePermissionsDrawer";

type FilterKey = "todos" | "activos" | "sistema" | "personalizados";

export function RolesPage() {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.isAdmin);

  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get("tab") === "permisos" ? "permisos" : "roles") as
    | "roles"
    | "permisos";

  function setTab(nextTab: "roles" | "permisos") {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (nextTab === "permisos") {
          next.set("tab", "permisos");
        } else {
          next.delete("tab");
        }
        return next;
      },
      { replace: true },
    );
  }

  const [busyId, setBusyId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(
    null,
  );
  // null = cerrado, "nuevo" = alta, un RoleResponse = edicion de esa fila.
  const [modal, setModal] = useState<"nuevo" | RoleResponse | null>(null);

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

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("todos");
  const [pageSize, setPageSize] = useState(10);
  const debouncedSearch = useDebouncedValue(search).trim();

  const { data, isStale, error, setPage, refresh } = usePagedList<RoleQuery, RoleListResponse>({
    fetch: rolesApi.list,
    criteria: { pageSize, search: debouncedSearch || undefined, status: filter },
    fallbackError: "No se pudieron cargar los roles",
  });

  useLoadErrorReceipt(error, "roles-list", refresh);
  useActionErrorReceipt(actionError, "roles-action");

  const listLoading = data === null || isStale;
  const rows = isStale ? [] : (data?.items ?? []);
  const counts = data?.counts;
  const unfiltered = filter === "todos" && !debouncedSearch;

  const selectablePageIds = useMemo(
    () => rows.filter((role) => !role.isSystem).map((role) => role.id),
    [rows],
  );
  const { selectedIds, pageState, togglePage, toggleSelect, clearSelection } =
    useTablePageSelection(selectablePageIds);

  async function runBulk(action: "activate" | "deactivate" | "delete") {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    setActionError(null);
    try {
      const result = await rolesApi.bulk({
        ids: Array.from(selectedIds),
        action,
      });
      if (result.updatedCount < result.totalRequested) {
        const skipped = result.totalRequested - result.updatedCount;
        setActionError(
          action === "delete"
            ? `Se eliminaron ${result.updatedCount} de ${result.totalRequested}. ${skipped} omitidos (sistema, en uso o predeterminados en departamentos).`
            : `Se actualizaron ${result.updatedCount} de ${result.totalRequested}. Los roles del sistema se omiten.`,
        );
      }
      clearSelection();
      refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "No se pudo completar la acción en lote");
    } finally {
      setBulkBusy(false);
    }
  }

  function askBulkActivate() {
    setConfirmation({
      tone: "warn",
      icon: CheckCircle2,
      eyebrow: "Personal · Roles",
      title: `Activar ${selectedIds.size} roles`,
      description: "Los roles personalizados seleccionados volverán a poder asignarse.",
      confirmLabel: "Activar",
      onConfirm: () => {
        setConfirmation(null);
        void runBulk("activate");
      },
    });
  }

  function askBulkDeactivate() {
    setConfirmation({
      tone: "danger",
      icon: Ban,
      eyebrow: "Personal · Roles",
      title: `Desactivar ${selectedIds.size} roles`,
      description:
        "Quienes los tengan asignados perderán la sesión activa. Los roles del sistema no se modifican.",
      confirmLabel: "Desactivar",
      onConfirm: () => {
        setConfirmation(null);
        void runBulk("deactivate");
      },
    });
  }

  function askBulkDelete() {
    setConfirmation({
      tone: "danger",
      icon: Trash2,
      eyebrow: "Personal · Roles",
      title: `Eliminar ${selectedIds.size} roles`,
      description:
        "Solo se borran los personalizados sin personal asignado ni uso como rol predeterminado. El resto se omitirá.",
      confirmLabel: "Eliminar",
      onConfirm: () => {
        setConfirmation(null);
        void runBulk("delete");
      },
    });
  }

  /** Los roles del sistema no se tocan: sostienen los permisos base. */
  function canManage(role: RoleResponse) {
    return isAdmin && !role.isSystem;
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
      onConfirm: async () => {
        setBusyId(role.id);
        try {
          await rolesApi.remove(role.id);
          refresh();
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  // Selector segmentado de vista (Roles / Matriz de permisos)
  const tabSwitcher = (
    <SegmentedTabs
      className="shrink-0 shadow-2xs"
      ariaLabel="Vistas de roles y permisos"
      activeKey={currentTab}
      items={[
        {
          key: "roles",
          label: (
            <>
              <ShieldCheck
                className={`h-3.5 w-3.5 ${currentTab === "roles" ? "text-brand-red" : "text-zinc-400"}`}
              />
              <span>Roles</span>
            </>
          ),
          onClick: () => setTab("roles"),
        },
        {
          key: "permisos",
          label: (
            <>
              <KeyRound
                className={`h-3.5 w-3.5 ${currentTab === "permisos" ? "text-brand-red" : "text-zinc-400"}`}
              />
              <span>Matriz de permisos</span>
            </>
          ),
          onClick: () => setTab("permisos"),
        },
      ]}
    />
  );

  return (
    <div className="flex h-full flex-col">
      <div
        key={currentTab}
        className="flex min-h-0 flex-1 flex-col animate-plf-apple-tab motion-reduce:animate-none"
      >
        {currentTab === "permisos" ? (
          <PermissionsView
            title="Roles y Permisos"
            headerExtra={tabSwitcher}
            onMatrixLoaded={setMatrix}
          />
        ) : (
          <>
      <ModuleHeader
        title="Roles y Permisos"
        summary={
          counts ? (
            <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
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
              <span aria-hidden className="text-zinc-300">
                ·
              </span>
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
              <span aria-hidden className="text-zinc-300">
                ·
              </span>
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
              <span aria-hidden className="text-zinc-300">
                ·
              </span>
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
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-300" />
              Cargando los roles del sistema…
            </span>
          )
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
        <ListPanel
          toolbar={
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
          }
          selection={
            isAdmin && selectedIds.size > 0
              ? {
                  count: selectedIds.size,
                  pageState,
                  busy: bulkBusy,
                  onTogglePage: togglePage,
                  onClear: clearSelection,
                  actions: [
                    {
                      key: "activate",
                      label: "Activar",
                      icon: <CheckCircle2 aria-hidden className="h-3.5 w-3.5 text-emerald-600" />,
                      onClick: askBulkActivate,
                    },
                    {
                      key: "deactivate",
                      label: "Desactivar",
                      icon: <Ban aria-hidden className="h-3.5 w-3.5 text-amber-600" />,
                      onClick: askBulkDeactivate,
                    },
                    {
                      key: "delete",
                      label: "Eliminar",
                      icon: <Trash2 aria-hidden className="h-3.5 w-3.5 text-brand-red" />,
                      onClick: askBulkDelete,
                    },
                  ],
                }
              : undefined
          }
          footer={
            data !== null && data.total > 0 ? (
              <Pagination
                loading={listLoading}
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                totalPages={data.totalPages}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                noun="roles"
              />
            ) : undefined
          }
        >
        {listLoading ? (
          error === null && <TableSkeleton rows={pageSize} columns={6} />
        ) : (
          <div className="plf-results-in">
            <DataTable>
              <thead>
                <HeadRow>
                  {isAdmin && (
                    <Th className="w-10 text-center">
                      <div className="flex items-center justify-center">
                        <SelectBox
                          checked={pageState}
                          onToggle={togglePage}
                          label={
                            pageState === true
                              ? "Quitar la selección de esta página"
                              : "Seleccionar roles personalizados de esta página"
                          }
                        />
                      </div>
                    </Th>
                  )}
                  <Th>Nombre</Th>
                  <Th>Tipo</Th>
                  <Th>Permisos</Th>
                  <Th>Estado</Th>
                  {isAdmin && <Th className="w-28 text-right">Acciones</Th>}
                </HeadRow>
              </thead>
              <tbody>
                {rows.map((role) => {
                  const checked = selectedIds.has(role.id);
                  return (
                  <Row
                    key={role.id}
                    busy={busyId === role.id || bulkBusy}
                    data-checked={checked}
                    onClick={() => setPermissionDrawerRole(role)}
                    className="cursor-pointer hover:bg-zinc-50/80 transition-colors group"
                  >
                    {isAdmin && (
                      <Td className="w-10 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center">
                          {role.isSystem ? (
                            <span
                              className="inline-block size-4.5 rounded-[5px] border border-dashed border-zinc-200 bg-zinc-50"
                              title="Los roles del sistema no se incluyen en acciones en lote"
                            />
                          ) : (
                            <SelectBox
                              checked={checked}
                              onToggle={() => toggleSelect(role.id)}
                              label={`Seleccionar ${role.name}`}
                            />
                          )}
                        </div>
                      </Td>
                    )}
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
                );
                })}
              </tbody>
            </DataTable>

            {rows.length === 0 && (
              <p className="py-14 text-center text-[13.5px] text-faint">
                {unfiltered
                  ? "Todavía no hay roles creados."
                  : "Ningún rol coincide con este filtro o búsqueda."}
              </p>
            )}
          </div>
        )}
        </ListPanel>
      </div>
          </>
        )}
      </div>

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}

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
