import {
  Ban,
  Building,
  CheckCircle2,
  Lock,
  Plus,
  Power,
  Shield,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { departmentsApi } from "../../api/departments";
import { sedesApi } from "../../api/sedes";
import { HeaderCounts } from "../../components/app/HeaderCounts";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { EmptyResult } from "../../components/ui/EmptyResult";
import { ClearFiltersButton, FilterDropdown, type FilterOption } from "../../components/ui/FilterDropdown";
import { HeaderTag } from "../../components/ui/HeaderTag";
import { ListPanel } from "../../components/ui/ListPanel";
import { Modal } from "../../components/ui/Modal";
import { ListPagination } from "../../components/ui/ListPagination";
import { SearchInput } from "../../components/ui/SearchInput";
import { SelectBox } from "../../components/ui/SelectBox";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { StatusDot } from "../../components/ui/StatusDot";
import { TableSelectionBar } from "../../components/ui/TableSelectionBar";
import { useCatalogActions } from "../../hooks/useCatalogActions";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import { useUrlNumber, useUrlState } from "../../hooks/useUrlState";
import { staleClass } from "../../lib/listState";
import type {
  DepartmentListResponse,
  DepartmentQuery,
  DepartmentResponse,
  DepartmentType,
} from "../../types/api";
import { LoadErrorAlert } from "../settings/catalogSection";
import { useReferenceData } from "../settings/catalogState";
import { CatalogRowActions } from "../settings/CatalogRowActions";
import { DepartmentModal } from "./DepartmentModal";
import { idParam } from "../../lib/idParam";
import { PAGE_SIZES } from "../../lib/pageSizes";

const CHIPS = ["todos", "activos", "inactivos"] as const;
type ChipKey = (typeof CHIPS)[number];
type TypeKey = "todos" | DepartmentType;
const TYPES: readonly TypeKey[] = ["todos", "Publico", "Privado"];
type PagedDepartmentQuery = DepartmentQuery & { page: number };

export function DepartmentsPage() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");

  const { modal, setModal, busyId, confirm, ask, dialog } = useCatalogActions<DepartmentResponse>();
  const [search, setSearch] = useUrlState<string>("q", "");
  const [chip, setChip] = useUrlState<ChipKey>("estado", "todos", CHIPS);
  const [typeChip, setTypeChip] = useUrlState<TypeKey>("tipo", "todos", TYPES);
  const [selectedSedeId, setSelectedSedeId] = useUrlState<string>("sede", "todas");
  const [pageSize, setPageSize] = useUrlNumber("tam", 10, PAGE_SIZES);

  // Selección múltiple y acciones en lote
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkSedeModalOpen, setBulkSedeModalOpen] = useState(false);
  const [selectedBulkSedeId, setSelectedBulkSedeId] = useState<string>("");

  const debouncedSearch = useDebouncedValue(search).trim();

  // Paginación real de servidor mediante usePagedList
  const {
    data,
    isStale,
    error,
    page,
    setPage,
    refresh,
  } = usePagedList<PagedDepartmentQuery, DepartmentListResponse>({
    fetch: departmentsApi.listPaged,
    criteria: {
      pageSize,
      search: debouncedSearch || undefined,
      status: chip === "todos" ? undefined : chip,
      sedeId:
        selectedSedeId === "todas"
          ? undefined
          : selectedSedeId === "sin-sede"
            ? -1
            : idParam(selectedSedeId),
      type: typeChip === "todos" ? undefined : typeChip,
      includeInactive: true,
    },
    fallbackError: "No se pudieron cargar los departamentos",
    pageKey: "pagina",
  });

  const { data: sedesList } = useReferenceData(
    () => sedesApi.list({ includeInactive: false, pageSize: 100 }),
    null,
  );

  const counts = data?.counts;

  // Opciones de filtro para el selector de Sedes
  const sedeOptions = useMemo<FilterOption[]>(() => {
    const sedes = sedesList?.items ?? [];
    const options: FilterOption[] = [
      {
        value: "todas",
        label: "Todas las sedes",
        icon: <Building className="h-4 w-4 text-zinc-500" />,
      },
    ];

    for (const s of sedes) {
      options.push({
        value: String(s.id),
        label: s.name,
        icon: <Building className="h-4 w-4 text-zinc-500" />,
      });
    }

    options.push({
      value: "sin-sede",
      label: "Sin sede asignada",
      icon: <Building className="h-4 w-4 text-zinc-400" />,
    });

    return options;
  }, [sedesList]);

  // Manejo de casillas de selección
  const pageIds = useMemo(() => data?.items.map((d) => d.id) ?? [], [data?.items]);

  const pageState: boolean | "mixed" = useMemo(() => {
    if (pageIds.length === 0) return false;
    const selectedCount = pageIds.filter((id) => selectedIds.has(id)).length;
    if (selectedCount === 0) return false;
    if (selectedCount === pageIds.length) return true;
    return "mixed";
  }, [pageIds, selectedIds]);

  const togglePage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = pageIds.every((id) => next.has(id));
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Ejecución de acciones en lote
  async function runBulk(action: "activate" | "deactivate" | "set-sede" | "delete", sedeId?: number | null) {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      await departmentsApi.bulk({
        ids: Array.from(selectedIds),
        action,
        sedeId,
      });
      setSelectedIds(new Set());
      refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setBulkBusy(false);
    }
  }

  function askBulkActivate() {
    ask({
      icon: Power,
      title: `Activar ${selectedIds.size} departamentos`,
      description: `¿Deseas activar los ${selectedIds.size} departamentos seleccionados? Volverán a estar disponibles en la creación de tickets.`,
      confirmLabel: "Activar",
      onConfirm: async () => {
        await runBulk("activate");
      },
    });
  }

  function askBulkDeactivate() {
    ask({
      tone: "warn",
      icon: Power,
      title: `Desactivar ${selectedIds.size} departamentos`,
      description: `¿Estás seguro de que deseas desactivar los ${selectedIds.size} departamentos seleccionados? Ya no se ofrecerán al asignar tickets.`,
      confirmLabel: "Desactivar",
      onConfirm: async () => {
        await runBulk("deactivate");
      },
    });
  }

  function askBulkDelete() {
    ask({
      tone: "danger",
      icon: Trash2,
      title: `Eliminar ${selectedIds.size} departamentos`,
      description: `¿Estás seguro de que deseas eliminar los ${selectedIds.size} departamentos seleccionados? Sólo se eliminarán los que no tengan colaboradores asociados.`,
      confirmLabel: "Eliminar seleccionados",
      onConfirm: async () => {
        await runBulk("delete");
      },
    });
  }

  const isFiltering =
    debouncedSearch !== "" || chip !== "todos" || typeChip !== "todos" || selectedSedeId !== "todas";

  function clearFilters() {
    setSearch("");
    setTypeChip("todos");
    setChip("todos");
    setSelectedSedeId("todas");
  }

  function askToggle(department: DepartmentResponse) {
    confirm(department.id, {
      tone: "warn",
      icon: Power,
      title: department.isActive ? "Desactivar departamento" : "Reactivar departamento",
      description: department.isActive ? (
        <>
          <strong className="font-semibold text-ink">{department.name}</strong> dejará de ofrecerse
          al asignar personal o encolar un ticket.{" "}
          {(department.staffCount ?? 0) > 0 ? (
            <>
              {department.staffCount}{" "}
              {department.staffCount === 1
                ? "colaborador lo conserva"
                : "colaboradores lo conservan"}{" "}
              como departamento primario.
            </>
          ) : (
            <>No hay nadie asignado a él.</>
          )}
        </>
      ) : (
        <>
          <strong className="font-semibold text-ink">{department.name}</strong> vuelve a estar
          disponible al asignar personal y al encolar un ticket.
        </>
      ),
      confirmLabel: department.isActive ? "Desactivar" : "Reactivar",
      onConfirm: async () => {
        const current = await departmentsApi.get(department.id);
        await departmentsApi.update(current.id, {
          name: current.name,
          parentId: current.parentId ?? null,
          sedeId: current.sedeId ?? null,
          isActive: !current.isActive,
          type: current.type ?? "Publico",
          defaultRoleId: current.defaultRoleId ?? null,
          mailboxId: current.mailboxId ?? null,
          managerStaffId: current.managerStaffId ?? null,
        });
        refresh();
      },
    });
  }

  function askDelete(department: DepartmentResponse) {
    confirm(department.id, {
      tone: "danger",
      icon: Trash2,
      title: "Eliminar departamento",
      description: (
        <>
          Se eliminará <strong className="font-semibold text-ink">{department.name}</strong> de forma
          definitiva. Esta acción no se puede deshacer.
        </>
      ),
      confirmLabel: "Eliminar",
      onConfirm: async () => {
        await departmentsApi.remove(department.id);
        refresh();
      },
    });
  }

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        title="Departamentos"
        badge={
          <HeaderCounts counts={counts} loadingLabel="Cargando departamentos…">
            {(counts) => (
              <>
                <HeaderTag
                  label={counts.all === 1 ? "departamento" : "departamentos"}
                  count={counts.all}
                  active={chip === "todos" && typeChip === "todos"}
                  onClick={() => {
                    setChip("todos");
                    setTypeChip("todos");
                  }}
                  tone="neutral"
                  title="Mostrar todos los departamentos"
                />
                <HeaderTag
                  label={counts.active === 1 ? "activo" : "activos"}
                  count={counts.active}
                  active={chip === "activos"}
                  onClick={() => setChip("activos")}
                  tone="emerald"
                  dot
                  title="Filtrar por departamentos activos"
                />
                <HeaderTag
                  label={counts.inactive === 1 ? "inactivo" : "inactivos"}
                  count={counts.inactive}
                  active={chip === "inactivos"}
                  onClick={() => setChip("inactivos")}
                  tone="red"
                  dot
                  title="Filtrar por departamentos inactivos"
                />
                <HeaderTag
                  label={counts.publicos === 1 ? "público" : "públicos"}
                  count={counts.publicos}
                  active={typeChip === "Publico"}
                  onClick={() => setTypeChip(typeChip === "Publico" ? "todos" : "Publico")}
                  tone="blue"
                  dot
                  title="Filtrar por departamentos públicos"
                />
                <HeaderTag
                  label={counts.privados === 1 ? "privado" : "privados"}
                  count={counts.privados}
                  active={typeChip === "Privado"}
                  onClick={() => setTypeChip(typeChip === "Privado" ? "todos" : "Privado")}
                  tone="amber"
                  dot
                  title="Filtrar por departamentos privados"
                />
              </>
            )}
          </HeaderCounts>
        }
        action={
          canWrite && (
            <Button size="sm" onClick={() => setModal("nuevo")} disabled={busyId !== null}>
              <Plus className="h-[15px] w-[15px]" />
              Nuevo departamento
            </Button>
          )
        }
      />

      {error && (
        <LoadErrorAlert message={error} onRetry={refresh} />
      )}

      <div className="min-h-0 flex-1 overflow-y-auto pb-8">
        <ListPanel
          toolbar={
            <div className="grid w-full">
              {selectedIds.size > 0 ? (
                <div className="col-start-1 row-start-1 w-full">
                  <TableSelectionBar
                    count={selectedIds.size}
                    pageState={pageState}
                    busy={bulkBusy}
                    onTogglePage={togglePage}
                    onClear={() => setSelectedIds(new Set())}
                    actions={[
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
                        key: "sede",
                        label: "Cambiar sede",
                        icon: <Building aria-hidden className="h-3.5 w-3.5 text-zinc-500" />,
                        onClick: () => {
                          setSelectedBulkSedeId("");
                          setBulkSedeModalOpen(true);
                        },
                      },
                      {
                        key: "delete",
                        label: "Eliminar",
                        icon: <Trash2 aria-hidden className="h-3.5 w-3.5 text-rose-600" />,
                        onClick: askBulkDelete,
                      },
                    ]}
                  />
                </div>
              ) : (
                <div className="col-start-1 row-start-1 flex flex-wrap items-center gap-2">
                  <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Buscar por departamento, sede o correo…"
                    className="w-[260px] sm:w-[280px]"
                  />
                  <FilterDropdown
                    title="Seleccionar tipo"
                    aria-label="Filtrar por tipo de departamento"
                    value={typeChip}
                    onChange={(next) => setTypeChip(next as TypeKey)}
                    defaultIcon={<Users className="h-3.5 w-3.5 text-zinc-500" />}
                    options={[
                      { value: "todos", label: "Todos los tipos", icon: <Users className="h-4 w-4 text-zinc-500" /> },
                      { value: "Publico", label: "Públicos", icon: <Users className="h-4 w-4 text-blue-600" /> },
                      { value: "Privado", label: "Privados", icon: <Lock className="h-4 w-4 text-amber-600" /> },
                    ]}
                  />
                  <FilterDropdown
                    title="Seleccionar sede"
                    aria-label="Filtrar por sede"
                    value={selectedSedeId}
                    onChange={(next) => setSelectedSedeId(next)}
                    defaultIcon={<Building className="h-3.5 w-3.5 text-zinc-500" />}
                    options={sedeOptions}
                    searchable={sedeOptions.length > 6}
                    searchPlaceholder="Buscar sede…"
                  />
                  {(search || typeChip !== "todos" || chip !== "todos" || selectedSedeId !== "todas") && (
                    <ClearFiltersButton onClick={clearFilters} />
                  )}
                </div>
              )}
            </div>
          }
          footer={
            <ListPagination
              data={data}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              noun="departamentos"
              nounSingular="departamento"
            />
          }
        >
          {data === null ? (
            <TableSkeleton rows={8} columns={7} />
          ) : data.items.length === 0 ? (
            isFiltering ? (
              <EmptyResult
                message="Ningún departamento coincide con este filtro o búsqueda."
                onClear={clearFilters}
              />
            ) : (
              <p className="py-14 text-center text-[13.5px] text-faint">
                Todavía no hay ningún departamento registrado.
              </p>
            )
          ) : (
            <div className={staleClass(isStale)}>
              <DataTable>
                <thead>
                  <HeadRow>
                    {canWrite && (
                      <Th className="w-10 text-center">
                        <div className="flex items-center justify-center">
                          <SelectBox
                            checked={pageState}
                            onToggle={togglePage}
                            label={pageState === true ? "Quitar la selección de esta página" : "Seleccionar toda la página"}
                          />
                        </div>
                      </Th>
                    )}
                    <Th className="w-48">Sede</Th>
                    <Th className="w-1/4">Departamento</Th>
                    <Th className="w-36 text-center">Tipo</Th>
                    <Th className="w-1/4">Administrador</Th>
                    <Th className="w-44">Permisos</Th>
                    <Th className="w-24">Estado</Th>
                    {canWrite && <Th className="w-24 text-right">Acciones</Th>}
                  </HeadRow>
                </thead>
                <tbody>
                  {data.items.map((d) => {
                    const checked = selectedIds.has(d.id);
                    const propios = d.staffCount ?? 0;

                    return (
                      <Row key={d.id} busy={busyId === d.id} data-checked={checked}>
                        {/* 0. CASILLA DE SELECCIÓN */}
                        {canWrite && (
                          <Td className="w-10 text-center">
                            <div className="flex items-center justify-center">
                              <SelectBox
                                checked={checked}
                                onToggle={() => toggleSelect(d.id)}
                                label={`Seleccionar ${d.name}`}
                              />
                            </div>
                          </Td>
                        )}

                        {/* 1. SEDE */}
                        <Td>
                          {d.sedeName ? (
                            <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-zinc-800">
                              <Building className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                              <span className="truncate">{d.sedeName}</span>
                            </span>
                          ) : (
                            <span className="text-[12px] text-zinc-400 italic">Sin sede</span>
                          )}
                        </Td>

                        {/* 2. DEPARTAMENTO */}
                        <Td>
                          <span className="text-[12.5px] font-semibold text-ink">
                            {d.name}
                          </span>
                        </Td>

                        {/* 3. TIPO */}
                        <Td className="text-center">
                          {d.type === "Privado" ? (
                            <Badge tone="slate" className="gap-1">
                              <Lock className="h-2.5 w-2.5" />
                              Privado
                            </Badge>
                          ) : (
                            <Badge tone="neutral" className="gap-1">
                              <Users className="h-2.5 w-2.5" />
                              Público
                            </Badge>
                          )}
                        </Td>

                        {/* 4. ADMINISTRADOR / ENCARGADO */}
                        <Td>
                          {d.managerName ? (
                            <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-zinc-800">
                              <UserCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                              <span className="truncate">{d.managerName}</span>
                            </span>
                          ) : (
                            <span className="text-[12px] text-zinc-400 italic">Sin administrador</span>
                          )}
                        </Td>

                        {/* 6. PERMISOS / ROL PREDETERMINADO */}
                        <Td>
                          {d.defaultRoleName ? (
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] text-zinc-700">
                              <Shield className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                              <span>{d.defaultRoleName}</span>
                            </span>
                          ) : (
                            <span className="text-[12px] text-zinc-400 italic">Sin rol</span>
                          )}
                        </Td>

                        {/* 7. ESTADO */}
                        <Td>
                          <StatusDot active={d.isActive} />
                        </Td>

                        {/* 8. ACCIONES */}
                        {canWrite && (
                          <Td>
                            <CatalogRowActions
                              name={d.name}
                              isActive={d.isActive}
                              busy={busyId === d.id}
                              onEdit={() => setModal(d)}
                              onToggle={() => askToggle(d)}
                              onDelete={propios === 0 ? () => askDelete(d) : undefined}
                            />
                          </Td>
                        )}
                      </Row>
                    );
                  })}
                </tbody>
              </DataTable>
            </div>
          )}
        </ListPanel>
      </div>

      {/* Modal para cambiar sede en lote */}
      {bulkSedeModalOpen && (
        <Modal
          title={`Cambiar sede (${selectedIds.size} departamentos)`}
          description="Elige la sede a la que deseas asignar los departamentos seleccionados."
          onClose={() => setBulkSedeModalOpen(false)}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Sede destino
              </label>
              <select
                value={selectedBulkSedeId}
                onChange={(e) => setSelectedBulkSedeId(e.target.value)}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red"
              >
                <option value="">Sin sede asignada</option>
                {sedesList?.items.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setBulkSedeModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={async () => {
                  const sid = selectedBulkSedeId === "" ? null : Number(selectedBulkSedeId);
                  await runBulk("set-sede", sid);
                  setBulkSedeModalOpen(false);
                }}
                disabled={bulkBusy}
              >
                Guardar cambios
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {modal !== null && (
        <DepartmentModal
          department={modal === "nuevo" ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={refresh}
        />
      )}

      {dialog}
    </div>
  );
}
