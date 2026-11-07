import {
  Ban,
  Building,
  CheckCircle2,
  Pencil,
  Plus,
  Power,
  Trash2,
  MapPin,
} from "lucide-react";
import { useMemo, useState } from "react";
import { ApiError } from "../../api/client";
import { sedesApi } from "../../api/sedes";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { ListEmptyState } from "../../components/ui/ListEmptyState";
import { EmptyResult } from "../../components/ui/EmptyResult";
import { ErrorRetry } from "../../components/ui/ErrorRetry";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { ClearFiltersButton } from "../../components/ui/FilterDropdown";
import { HeaderTag } from "../../components/ui/HeaderTag";
import { ListPanel } from "../../components/ui/ListPanel";
import { Pagination } from "../../components/ui/Pagination";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { SelectBox } from "../../components/ui/SelectBox";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { StatusDot } from "../../components/ui/StatusDot";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useActionErrorReceipt, useLoadErrorReceipt } from "../../hooks/useNoticeReceipts";
import { useReceipts } from "../../context/useReceipts";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import { useTablePageSelection } from "../../hooks/useTablePageSelection";
import type { Sede, SedeQuery } from "../../types/sedes";
import { SedeModal } from "./SedeModal";

type ChipKey = "todos" | "activos" | "inactivos";
type PagedSedeQuery = SedeQuery & { page: number };

export function SedesPage() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");

  const [busyId, setBusyId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const receipts = useReceipts();
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<ChipKey>("todos");
  const [pageSize, setPageSize] = useState(15);

  const [modal, setModal] = useState<"nuevo" | Sede | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);

  const debouncedSearch = useDebouncedValue(search).trim();

  const { data, isStale, error, page, setPage, refresh } = usePagedList<
    PagedSedeQuery,
    Awaited<ReturnType<typeof sedesApi.list>>
  >({
    queryKey: ["sedes"],
    fetch: sedesApi.list,
    criteria: {
      pageSize,
      search: debouncedSearch || undefined,
      status: chip === "todos" ? undefined : chip,
      includeInactive: true,
    },
    fallbackError: "No se pudieron cargar las sedes",
  });

  // El aviso en línea cubre la carga inicial; el toast solo avisa cuando
  // la tabla sigue mostrando datos previos y el aviso no se ve.
  useLoadErrorReceipt(data === null || isStale ? null : error, "sedes-list", refresh);
  useActionErrorReceipt(actionError, "sedes-action");

  const listLoading = data === null || isStale;
  const rows = isStale ? [] : (data?.items ?? []);
  const counts = data?.counts;
  const isFiltering = debouncedSearch !== "" || chip !== "todos";

  const pageIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const { selectedIds, pageState, togglePage, toggleSelect, clearSelection } =
    useTablePageSelection(pageIds);

  async function runBulk(action: "activate" | "deactivate" | "delete") {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    setActionError(null);
    try {
      const result = await sedesApi.bulk({
        ids: Array.from(selectedIds),
        action,
      });
      if (result.updatedCount < result.totalRequested) {
        const skipped = result.totalRequested - result.updatedCount;
        setActionError(
          action === "delete"
            ? `Se eliminaron ${result.updatedCount} de ${result.totalRequested}. ${skipped} tienen departamentos asignados.`
            : `Se actualizaron ${result.updatedCount} de ${result.totalRequested} sedes.`,
        );
      } else {
        const titles = { activate: "Sedes activadas", deactivate: "Sedes desactivadas", delete: "Sedes eliminadas" };
        receipts.done({
          action: `${action}-sedes-lote`,
          title: titles[action],
          detail: `${result.updatedCount} ${result.updatedCount === 1 ? "sede" : "sedes"}`,
        });
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
      title: `Reactivar ${selectedIds.size} sedes`,
      description: "Volverán a ofrecerse al asignar sede a un departamento.",
      confirmLabel: "Reactivar",
      onConfirm: () => runBulk("activate"),
    });
  }

  function askBulkDeactivate() {
    setConfirmation({
      tone: "warn",
      icon: Ban,
      title: `Desactivar ${selectedIds.size} sedes`,
      description: "Dejarán de ofrecerse en selectores; los departamentos que ya las usan las conservan.",
      confirmLabel: "Desactivar",
      onConfirm: () => runBulk("deactivate"),
    });
  }

  function askBulkDelete() {
    setConfirmation({
      tone: "danger",
      icon: Trash2,
      title: `Eliminar ${selectedIds.size} sedes`,
      description:
        "Solo se borran las que no tienen departamentos. Las demás se omitirán; desactívalas si no las necesitas.",
      confirmLabel: "Eliminar",
      onConfirm: () => runBulk("delete"),
    });
  }

  function askToggle(sede: Sede) {
    const willDeactivate = sede.isActive;
    setConfirmation({
      tone: "warn",
      icon: willDeactivate ? Ban : CheckCircle2,
      title: willDeactivate ? "Desactivar sede" : "Reactivar sede",
      description: willDeactivate ? (
        <>
          <strong className="font-semibold text-ink">{sede.name}</strong> dejará de ofrecerse al
          asignar sede a un departamento.{" "}
          {sede.departmentCount > 0 ? (
            <>
              {sede.departmentCount}{" "}
              {sede.departmentCount === 1
                ? "departamento la conserva asignada."
                : "departamentos la conservan asignada."}
            </>
          ) : (
            <>No hay ningún departamento asignado a ella.</>
          )}
        </>
      ) : (
        <>
          <strong className="font-semibold text-ink">{sede.name}</strong> vuelve a estar disponible
          para asociarle departamentos.
        </>
      ),
      confirmLabel: willDeactivate ? "Desactivar" : "Reactivar",
      onConfirm: async () => {
        setBusyId(sede.id);
        try {
          const current = await sedesApi.get(sede.id);
          await sedesApi.update(current.id, {
            name: current.name,
            address: current.address,
            isActive: !current.isActive,
          });
          receipts.done({
            action: current.isActive ? "reactivar-sede" : "desactivar-sede",
            title: current.isActive ? "Sede desactivada" : "Sede reactivada",
            detail: current.name,
          });
          refresh();
        } catch (err) {
          receipts.failed({
            action: "toggle-sede",
            title: "No se pudo cambiar el estado de la sede",
            detail: err instanceof Error ? err.message : undefined,
          });
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  function askDelete(sede: Sede) {
    setConfirmation({
      tone: "danger",
      icon: Trash2,
      title: "Eliminar sede",
      description: (
        <>
          <strong className="font-semibold text-ink">{sede.name}</strong> se eliminará de forma
          permanente.
        </>
      ),
      confirmLabel: "Eliminar",
      onConfirm: async () => {
        setBusyId(sede.id);
        try {
          await sedesApi.remove(sede.id);
          receipts.done({ action: "eliminar-sede", title: "Sede eliminada", detail: sede.name });
          refresh();
        } catch (err) {
          receipts.failed({
            action: "eliminar-sede",
            title: "No se pudo eliminar la sede",
            detail: err instanceof Error ? err.message : undefined,
          });
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        title="Sedes"
        summary={
          counts ? (
            <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
              <HeaderTag
                label={counts.all === 1 ? "sede" : "sedes"}
                count={counts.all}
                active={chip === "todos"}
                onClick={() => setChip("todos")}
                tone="neutral"
                title="Mostrar todas las sedes"
              />
              <span aria-hidden className="text-zinc-300">·</span>
              <HeaderTag
                label={counts.active === 1 ? "activa" : "activas"}
                count={counts.active}
                active={chip === "activos"}
                onClick={() => setChip("activos")}
                tone="emerald"
                dot
                title="Filtrar por sedes activas"
              />
              <span aria-hidden className="text-zinc-300">·</span>
              <HeaderTag
                label={counts.inactive === 1 ? "inactiva" : "inactivas"}
                count={counts.inactive}
                active={chip === "inactivos"}
                onClick={() => setChip("inactivos")}
                tone="red"
                dot
                title="Filtrar por sedes inactivas"
              />
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-300" />
              Cargando catálogo de sedes…
            </span>
          )
        }
        action={
          canWrite && (
            <Button size="sm" onClick={() => setModal("nuevo")} disabled={busyId !== null}>
              <Plus className="h-[15px] w-[15px]" />
              Nueva sede
            </Button>
          )
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto pb-8">
        <ListPanel
          toolbar={
            <div className="flex flex-wrap items-center justify-between gap-3 w-full">
              <div className="flex flex-wrap items-center gap-2">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Buscar sede por nombre o dirección…"
                  className="w-[260px] sm:w-[300px]"
                />
                {isFiltering && (
                  <ClearFiltersButton
                    onClick={() => {
                      setSearch("");
                      setChip("todos");
                    }}
                  />
                )}
              </div>
            </div>
          }
          selection={
            canWrite && selectedIds.size > 0
              ? {
                  count: selectedIds.size,
                  pageState,
                  busy: bulkBusy,
                  onTogglePage: togglePage,
                  onClear: clearSelection,
                  actions: [
                    {
                      key: "activate",
                      label: "Reactivar",
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
            data && data.total > 0 && (
              <Pagination
                loading={listLoading}
                page={page}
                pageSize={pageSize}
                total={data.total}
                totalPages={data.totalPages}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                noun="sedes"
              />
            )
          }
        >
          {listLoading ? (
            error !== null ? (
            <ErrorRetry className="p-4" onRetry={refresh}>{error}</ErrorRetry>
          ) : (
            <TableSkeleton rows={pageSize} columns={5} />
          )
          ) : rows.length === 0 ? (
            isFiltering ? (
              <EmptyResult
                message="Ninguna sede coincide con este filtro o búsqueda."
                onClear={() => {
                  setSearch("");
                  setChip("todos");
                  setPage(1);
                }}
              />
            ) : (
              <ListEmptyState
                icon={MapPin}
                isFiltered={false}
                filteredTitle=""
                emptyTitle="Todavía no hay ninguna sede registrada."
                action={
                  canWrite && (
                    <Button size="sm" onClick={() => setModal("nuevo")}>
                      <Plus className="h-[15px] w-[15px]" />
                      Nueva sede
                    </Button>
                  )
                }
              />
            )
          ) : (
            <div className="plf-results-in">
              <DataTable>
              <thead>
                <HeadRow>
                  {canWrite && (
                    <Th className="w-10 text-center">
                      <div className="flex items-center justify-center">
                        <SelectBox
                          checked={pageState}
                          onToggle={togglePage}
                          label={
                            pageState === true
                              ? "Quitar la selección de esta página"
                              : "Seleccionar toda la página"
                          }
                        />
                      </div>
                    </Th>
                  )}
                  <Th>Nombre de la sede</Th>
                  <Th>Dirección / Ubicación</Th>
                  <Th className="w-36 text-center">Departamentos</Th>
                  <Th className="w-24">Estado</Th>
                  {canWrite && <Th className="w-24 text-right">Acciones</Th>}
                </HeadRow>
              </thead>
              <tbody>
                {rows.map((sede) => {
                  const checked = selectedIds.has(sede.id);
                  return (
                  <Row key={sede.id} busy={busyId === sede.id || bulkBusy} data-checked={checked}>
                    {canWrite && (
                      <Td className="w-10 text-center">
                        <div className="flex items-center justify-center">
                          <SelectBox
                            checked={checked}
                            onToggle={() => toggleSelect(sede.id)}
                            label={`Seleccionar ${sede.name}`}
                          />
                        </div>
                      </Td>
                    )}
                    {/* 1. NOMBRE */}
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-600">
                          <Building className="h-3.5 w-3.5" />
                        </div>
                        <span className="font-medium text-[13px] text-ink">{sede.name}</span>
                      </div>
                    </Td>

                    {/* 2. DIRECCIÓN */}
                    <Td>
                      {sede.address ? (
                        <span className="text-[12.5px] text-zinc-700">{sede.address}</span>
                      ) : (
                        <span className="text-[12px] text-zinc-400 italic">Sin dirección registrada</span>
                      )}
                    </Td>

                    {/* 3. DEPARTAMENTOS ASOCIADOS */}
                    <Td className="text-center">
                      <Badge tone={sede.departmentCount > 0 ? "slate" : "neutral"}>
                        {sede.departmentCount}{" "}
                        {sede.departmentCount === 1 ? "departamento" : "departamentos"}
                      </Badge>
                    </Td>

                    {/* 4. ESTADO */}
                    <Td>
                      <StatusDot active={sede.isActive} />
                    </Td>

                    {/* 5. ACCIONES */}
                    {canWrite && (
                      <Td>
                        <div className="flex items-center justify-end gap-1">
                          <RowAction
                            label={`Editar ${sede.name}`}
                            icon={Pencil}
                            onClick={() => setModal(sede)}
                            disabled={busyId === sede.id}
                          />
                          <RowAction
                            label={sede.isActive ? `Desactivar ${sede.name}` : `Reactivar ${sede.name}`}
                            icon={Power}
                            onClick={() => askToggle(sede)}
                            disabled={busyId === sede.id}
                          />
                          {sede.departmentCount === 0 && (
                            <RowAction
                              label={`Eliminar ${sede.name}`}
                              icon={Trash2}
                              danger
                              onClick={() => askDelete(sede)}
                              disabled={busyId === sede.id}
                            />
                          )}
                        </div>
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

      {modal !== null && (
        <SedeModal
          sede={modal === "nuevo" ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={(saved) => {
            const isEdit = modal !== "nuevo";
            receipts.done({
              action: isEdit ? "editar-sede" : "crear-sede",
              title: isEdit ? "Sede actualizada" : "Sede creada exitosamente",
              detail: saved.name,
            });
            refresh();
          }}
        />
      )}

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </div>
  );
}
