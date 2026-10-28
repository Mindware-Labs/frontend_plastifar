import { Flag, Layers, ListTodo, Pencil, Plus, Power, Star, Ticket } from "lucide-react";
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
import { TableSkeleton } from "../../components/ui/Skeleton";
import { StatusDot } from "../../components/ui/StatusDot";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import {
  useActionErrorReceipt,
  useConfigNoticeReceipt,
  useLoadErrorReceipt,
} from "../../hooks/useNoticeReceipts";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import { humanizeMinutes, workdayMinutes } from "../../lib/sla";
import { PRIORITIES, type Holiday, type Priority, type SlaPolicy, type SlaPolicyType } from "../../types/settings";
import { freshCopy, staleClass, useReferenceData } from "./catalogState";
import { SlaModal } from "./SlaModal";

type ChipKey = "todas" | "activas" | "inactivas";

interface UncoveredItem {
  priority: Priority;
  type: SlaPolicyType;
}

/**
 * Consulta las políticas activas completas para detectar combinaciones (Tipo + Prioridad)
 * que carezcan de una política predeterminada.
 */
async function loadUncovered(): Promise<UncoveredItem[]> {
  try {
    const policies = await fetchAllPages<SlaPolicy>((page, pageSize) =>
      settingsApi.slaPolicies.list({ page, pageSize, status: "activas" }),
    );

    const missing: UncoveredItem[] = [];
    for (const type of ["Ticket", "Tarea"] as SlaPolicyType[]) {
      for (const priority of PRIORITIES) {
        const hasDefault = policies.some(
          (p) => p.type === type && p.priority === priority && p.isDefault && p.isActive,
        );
        if (!hasDefault) {
          missing.push({ priority, type });
        }
      }
    }
    return missing;
  } catch {
    return [];
  }
}

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

  const uncoveredRef = useReferenceData<UncoveredItem[]>(loadUncovered, []);
  const uncovered = uncoveredRef.data;

  const holidaysRef = useReferenceData<Holiday[]>(loadHolidays, []);
  const holidays = holidaysRef.data;

  const rows = data?.items ?? [];
  const counts = data?.counts;
  const isFiltering = debouncedSearch !== "" || chip !== "todas" || priority !== "todas" || typeFilter !== "todas";

  const uncoveredDetail = useMemo(() => {
    if (uncovered.length === 0) return undefined;
    return `Sin predeterminada activa para: ${uncovered
      .map((u) => `${u.priority} (${u.type === "Tarea" ? "Tareas" : "Tickets"})`)
      .join(", ")}. Un registro que nazca con esa combinación no tendría compromiso de tiempo automático.`;
  }, [uncovered]);

  useLoadErrorReceipt(error, "settings-sla-list", refresh);
  useActionErrorReceipt(actionError, "settings-sla-action");
  useConfigNoticeReceipt(
    uncovered.length > 0,
    "settings-sla-defaults",
    "Políticas SLA incompletas",
    uncoveredDetail,
  );

  function reloadAll() {
    refresh();
    uncoveredRef.reload();
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
              <span aria-hidden className="text-zinc-300">·</span>
              <span className="text-[12px] text-zinc-500 font-medium">
                {8 - uncovered.length} de 8 predeterminadas asignadas
              </span>
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
            <Button size="sm" onClick={() => setModal("nueva")} disabled={busyId !== null}>
              <Plus className="h-[15px] w-[15px]" />
              Nueva política
            </Button>
          )
        }
      />

      <ListPanel
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
          error === null && <TableSkeleton rows={pageSize} columns={9} />
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
                {rows.map((policy) => (
                  <Row key={policy.id} busy={busyId === policy.id}>
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
                              disabled={busyId === policy.id}
                            />
                          )}
                          <RowAction
                            label={`Editar ${policy.name}`}
                            icon={Pencil}
                            onClick={() => setModal(policy)}
                            disabled={busyId === policy.id}
                          />
                          <RowAction
                            label={
                              policy.isActive
                                ? `Desactivar ${policy.name}`
                                : `Reactivar ${policy.name}`
                            }
                            icon={Power}
                            onClick={() => askToggle(policy)}
                            disabled={busyId === policy.id}
                          />
                        </div>
                      </Td>
                    )}
                  </Row>
                ))}
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
