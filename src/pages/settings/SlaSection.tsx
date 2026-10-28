import { Ban, CheckCircle2, Flag, Layers, ListTodo, Pencil, Plus, Power, Star, Ticket } from "lucide-react";
import { useMemo, useState } from "react";
import { ApiError } from "../../api/client";
import { fetchAllPages } from "../../api/paging";
import { settingsApi } from "../../api/settings";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { ClearFiltersButton, FilterDropdown } from "../../components/ui/FilterDropdown";
import { HeaderTag } from "../../components/ui/HeaderTag";
import { ListPanel } from "../../components/ui/ListPanel";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { Pagination } from "../../components/ui/Pagination";
import { SelectBox } from "../../components/ui/SelectBox";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { StatusDot } from "../../components/ui/StatusDot";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useTablePageSelection } from "../../hooks/useTablePageSelection";
import { useActionErrorReceipt, useLoadErrorReceipt } from "../../hooks/useNoticeReceipts";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import { humanizeMinutes, workdayMinutes } from "../../lib/sla";
import { invalidateActiveSlaPoliciesCache } from "../../lib/useActiveSlaPolicies";
import { PRIORITIES, type Holiday, type Priority, type SlaPolicy, type SlaPolicyType } from "../../types/settings";
import { freshCopy, staleClass, useReferenceData } from "./catalogState";
import { SlaModal } from "./SlaModal";

type ChipKey = "todas" | "activas" | "inactivas";

const loadHolidays = () =>
  fetchAllPages<Holiday>((page, pageSize) =>
    settingsApi.holidays.list({ page, pageSize, status: "activos" }),
  );

function toRequest(policy: SlaPolicy): Omit<SlaPolicy, "id"> {
  return {
    name: policy.name,
    type: policy.type,
    priority: policy.priority,
    firstResponseMinutes: policy.firstResponseMinutes,
    resolutionMinutes: policy.resolutionMinutes,
    businessHoursOnly: policy.businessHoursOnly,
    workdayStart: policy.workdayStart,
    workdayEnd: policy.workdayEnd,
    workDays: policy.workDays,
    isDefault: policy.isDefault,
    isActive: policy.isActive,
  };
}

export function SlaSection() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");

  const [busyId, setBusyId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<SlaPolicyType | "todas">("todas");
  const [priority, setPriority] = useState<Priority | "todas">("todas");
  const [chip, setChip] = useState<ChipKey>("todas");
  const [pageSize, setPageSize] = useState(10);

  const [modal, setModal] = useState<"nueva" | SlaPolicy | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);

  const debouncedSearch = useDebouncedValue(search).trim();

  const { data, isStale, error, page, setPage, refresh } = usePagedList({
    fetch: settingsApi.slaPolicies.list,
    criteria: {
      pageSize,
      search: debouncedSearch || undefined,
      status: chip === "todas" ? undefined : chip,
      priority: priority === "todas" ? undefined : priority,
      type: typeFilter === "todas" ? undefined : typeFilter,
    },
    fallbackError: "No se pudieron cargar las políticas de SLA",
  });

  const holidaysRef = useReferenceData<Holiday[]>(loadHolidays, []);
  const holidays = holidaysRef.data;

  const rows = data?.items ?? [];
  const counts = data?.counts;
  const isFiltering = debouncedSearch !== "" || chip !== "todas" || priority !== "todas" || typeFilter !== "todas";

  const pageIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const { selectedIds, pageState, togglePage, toggleSelect, clearSelection } = useTablePageSelection(pageIds);
  const tableBusy = busyId !== null || bulkBusy;

  useLoadErrorReceipt(error, "settings-sla-list", refresh);
  useActionErrorReceipt(actionError, "settings-sla-action");

  function reloadAll() {
    invalidateActiveSlaPoliciesCache();
    refresh();
  }

  async function makeDefault(policy: SlaPolicy) {
    setBusyId(policy.id);
    setActionError(null);
    try {
      const current = await freshCopy(settingsApi.slaPolicies.get, policy);
      await settingsApi.slaPolicies.update(current.id, { ...toRequest(current), isDefault: true });
      reloadAll();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "No se pudo marcar como predeterminada",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function runBulkSetActive(nextActive: boolean) {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    setActionError(null);
    const ids = Array.from(selectedIds);
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    let lastMessage = "No se pudo completar la acción en lote";

    for (const id of ids) {
      try {
        const current = await freshCopy(settingsApi.slaPolicies.get, { id } as SlaPolicy);
        if (current.isActive === nextActive) {
          skipped += 1;
          continue;
        }
        await settingsApi.slaPolicies.update(current.id, {
          ...toRequest(current),
          isActive: nextActive,
          isDefault: nextActive ? current.isDefault : false,
        });
        updated += 1;
      } catch (err) {
        failed += 1;
        lastMessage = err instanceof ApiError ? err.message : lastMessage;
      }
    }

    clearSelection();
    reloadAll();

    if (failed > 0) {
      setActionError(
        updated > 0 || skipped > 0
          ? `${lastMessage} (${updated} actualizadas, ${failed} con error).`
          : lastMessage,
      );
    }

    setBulkBusy(false);
  }

  function askBulkActivate() {
    setConfirmation({
      tone: "warn",
      icon: CheckCircle2,
      title: `Reactivar ${selectedIds.size} políticas`,
      description: "Volverán a estar disponibles para asignarse en tickets y tareas nuevos.",
      confirmLabel: "Reactivar",
      onConfirm: () => {
        setConfirmation(null);
        void runBulkSetActive(true);
      },
    });
  }

  function askBulkDeactivate() {
    setConfirmation({
      tone: "warn",
      icon: Ban,
      title: `Desactivar ${selectedIds.size} políticas`,
      description:
        "Dejarán de ofrecerse en registros nuevos. Si alguna era predeterminada, pierde ese rol. Los abiertos conservan sus plazos.",
      confirmLabel: "Desactivar",
      onConfirm: () => {
        setConfirmation(null);
        void runBulkSetActive(false);
      },
    });
  }

  function askToggle(policy: SlaPolicy) {
    setConfirmation({
      tone: "warn",
      icon: Power,
      title: policy.isActive ? "Desactivar política" : "Reactivar política",
      description: policy.isActive ? (
        <>
          <strong className="font-semibold text-ink">{policy.name}</strong> deja de aplicarse a
          nuevos registros. Los ya abiertos conservan las fechas que se les calcularon al crearse.
        </>
      ) : (
        <>
          <strong className="font-semibold text-ink">{policy.name}</strong> vuelve a estar disponible
          para asignarse a {policy.type === "Tarea" ? "tareas" : "tickets"} nuevos.
        </>
      ),
      confirmLabel: policy.isActive ? "Desactivar" : "Reactivar",
      onConfirm: async () => {
        setBusyId(policy.id);
        try {
          const current = await freshCopy(settingsApi.slaPolicies.get, policy);
          await settingsApi.slaPolicies.update(current.id, {
            ...toRequest(current),
            isActive: !current.isActive,
            isDefault: current.isActive ? false : current.isDefault,
          });
          reloadAll();
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  return (
    <>
      <ModuleHeader
        title="Políticas de SLA"
        summary={
          counts ? (
            <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
              <HeaderTag
                label={counts.all === 1 ? "política" : "políticas"}
                count={counts.all}
                active={chip === "todas"}
                onClick={() => {
                  setChip("todas");
                  setPage(1);
                }}
                tone="neutral"
                title="Mostrar todas las políticas de SLA"
              />
              <span aria-hidden className="text-zinc-300">·</span>
              <HeaderTag
                label={counts.active === 1 ? "activa" : "activas"}
                count={counts.active}
                active={chip === "activas"}
                onClick={() => {
                  setChip("activas");
                  setPage(1);
                }}
                tone="emerald"
                dot
                title="Filtrar por políticas activas"
              />
              <span aria-hidden className="text-zinc-300">·</span>
              <HeaderTag
                label={counts.inactive === 1 ? "inactiva" : "inactivas"}
                count={counts.inactive}
                active={chip === "inactivas"}
                onClick={() => {
                  setChip("inactivas");
                  setPage(1);
                }}
                tone="red"
                dot
                title="Filtrar por políticas inactivas"
              />
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-300" />
              Cargando las políticas de SLA…
            </span>
          )
        }
        action={
          canWrite && (
            <Button size="sm" onClick={() => setModal("nueva")} disabled={tableBusy}>
              <Plus className="h-[15px] w-[15px]" />
              Nueva política
            </Button>
          )
        }
      />

      <ListPanel
        selection={
          canWrite
            ? {
                count: selectedIds.size,
                pageState,
                busy: tableBusy,
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
                ],
              }
            : undefined
        }
        toolbar={
          <>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar política…"
              className="w-[220px]"
            />

            <FilterDropdown
              title="Tipo de política"
              aria-label="Filtrar por tipo"
              value={typeFilter}
              onChange={(value) => {
                setTypeFilter(value as SlaPolicyType | "todas");
                setPage(1);
              }}
              defaultIcon={<Layers className="h-3.5 w-3.5 text-zinc-500" />}
              options={[
                { value: "todas", label: "Todos los tipos" },
                { value: "Ticket", label: "Tickets" },
                { value: "Tarea", label: "Tareas" },
              ]}
            />

            <FilterDropdown
              title="Prioridad"
              aria-label="Filtrar por prioridad"
              value={priority}
              onChange={(value) => {
                setPriority(value as Priority | "todas");
                setPage(1);
              }}
              defaultIcon={<Flag className="h-3.5 w-3.5 text-zinc-500" />}
              options={[
                { value: "todas", label: "Todas las prioridades" },
                ...PRIORITIES.map((value) => ({ value, label: value })),
              ]}
            />

            {(search || priority !== "todas" || typeFilter !== "todas") && (
              <ClearFiltersButton
                onClick={() => {
                  setSearch("");
                  setPriority("todas");
                  setTypeFilter("todas");
                  setPage(1);
                }}
              />
            )}
          </>
        }
        footer={
          data !== null &&
          data.total > 0 && (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={data.total}
              totalPages={data.totalPages}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              noun="políticas"
            />
          )
        }
      >
        {data === null ? (
          error === null && <TableSkeleton rows={pageSize} columns={canWrite ? 10 : 9} />
        ) : rows.length === 0 ? (
          <p className="py-14 text-center text-[13.5px] text-faint">
            {isFiltering
              ? "Ninguna política coincide con este filtro o búsqueda."
              : "Todavía no hay ninguna política de SLA configurada."}
          </p>
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
                          label={
                            pageState === true
                              ? "Quitar la selección de esta página"
                              : "Seleccionar toda la página"
                          }
                        />
                      </div>
                    </Th>
                  )}
                  <Th>Política</Th>
                  <Th>Tipo</Th>
                  <Th>Prioridad</Th>
                  <Th>1ª respuesta</Th>
                  <Th>Resolución</Th>
                  <Th>Reloj</Th>
                  <Th>Predeterminada</Th>
                  <Th>Estado</Th>
                  {canWrite && <Th className="w-24 text-right">Acciones</Th>}
                </HeadRow>
              </thead>

              <tbody>
                {rows.map((policy) => {
                  const checked = selectedIds.has(policy.id);
                  return (
                  <Row key={policy.id} busy={busyId === policy.id || bulkBusy} data-checked={checked}>
                    {canWrite && (
                      <Td className="w-10 text-center">
                        <div className="flex items-center justify-center">
                          <SelectBox
                            checked={checked}
                            onToggle={() => toggleSelect(policy.id)}
                            label={`Seleccionar ${policy.name}`}
                          />
                        </div>
                      </Td>
                    )}
                    <Td className="text-[12.5px] font-medium text-ink">{policy.name}</Td>
                    <Td>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide border ${
                          policy.type === "Tarea"
                            ? "border-blue-200/80 bg-blue-50/70 text-blue-700"
                            : "border-purple-200/80 bg-purple-50/70 text-purple-700"
                        }`}
                      >
                        {policy.type === "Tarea" ? (
                          <ListTodo className="h-3 w-3 shrink-0" />
                        ) : (
                          <Ticket className="h-3 w-3 shrink-0" />
                        )}
                        <span>{policy.type === "Tarea" ? "Tarea" : "Ticket"}</span>
                      </span>
                    </Td>
                    <Td>
                      <Badge tone={policy.priority === "Emergencia" ? "red" : "neutral"}>
                        {policy.priority}
                      </Badge>
                    </Td>
                    <Td className="text-[12.5px] tabular-nums text-brand-gray">
                      {policy.type === "Tarea" && policy.firstResponseMinutes === policy.resolutionMinutes ? (
                        <span className="text-zinc-400 text-[11.5px]">—</span>
                      ) : (
                        humanizeMinutes(policy.firstResponseMinutes, workdayMinutes(policy))
                      )}
                    </Td>
                    <Td className="text-[12.5px] tabular-nums text-brand-gray">
                      {humanizeMinutes(policy.resolutionMinutes, workdayMinutes(policy))}
                    </Td>
                    <Td className="text-[12.5px] text-brand-gray">
                      {policy.businessHoursOnly ? (
                        <span className="flex flex-col gap-0.5">
                          <span className="leading-tight">Solo jornada</span>
                          <span className="text-[11px] leading-tight tabular-nums text-faint">
                            {policy.workdayStart}–{policy.workdayEnd} · {policy.workDays.join("")}
                          </span>
                        </span>
                      ) : (
                        "Continuo (24/7)"
                      )}
                    </Td>
                    <Td>
                      {policy.isDefault ? (
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-medium text-ink">
                          <Star aria-hidden className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                          De {policy.priority.toLowerCase()} ({policy.type.toLowerCase()})
                        </span>
                      ) : (
                        <span className="text-[12.5px] text-faint">—</span>
                      )}
                    </Td>
                    <Td>
                      <StatusDot active={policy.isActive} />
                    </Td>
                    {canWrite && (
                      <Td>
                        <div className="flex items-center justify-end gap-1">
                          {!policy.isDefault && policy.isActive && (
                            <RowAction
                              label={`Hacer predeterminada de ${policy.priority.toLowerCase()} (${policy.type.toLowerCase()}): ${policy.name}`}
                              icon={Star}
                              onClick={() => makeDefault(policy)}
                              disabled={tableBusy}
                            />
                          )}
                          <RowAction
                            label={`Editar ${policy.name}`}
                            icon={Pencil}
                            onClick={() => setModal(policy)}
                            disabled={tableBusy}
                          />
                          <RowAction
                            label={
                              policy.isActive
                                ? `Desactivar ${policy.name}`
                                : `Reactivar ${policy.name}`
                            }
                            icon={Power}
                            onClick={() => askToggle(policy)}
                            disabled={tableBusy}
                          />
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

      {modal !== null && (
        <SlaModal
          policy={modal === "nueva" ? undefined : modal}
          holidays={holidays}
          onClose={() => setModal(null)}
          onSaved={reloadAll}
        />
      )}

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </>
  );
}
