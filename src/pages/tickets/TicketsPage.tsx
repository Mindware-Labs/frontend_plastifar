import { Clock, Flag, Plus, Ticket as TicketIcon, UserCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { departmentsApi } from "../../api/departments";
import { ticketsApi } from "../../api/tickets";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { DataTable, HeadRow, Row, Td, Th, type SortDir } from "../../components/ui/DataTable";
import { FilterChip } from "../../components/ui/FilterChip";
import { Modal } from "../../components/ui/Modal";
import { Pagination } from "../../components/ui/Pagination";
import { SearchInput } from "../../components/ui/SearchInput";
import { Select } from "../../components/ui/Select";
import { Spinner } from "../../components/ui/Spinner";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { useEmailCounts } from "../../context/useEmailCounts";
import { formatDateTime, formatSlaRemaining } from "../../lib/format";
import type {
  DepartmentResponse,
  TicketCounts,
  TicketListItemResponse,
  TicketListResponse,
  TicketQuery,
  TicketStaffOptionResponse,
} from "../../types/api";
import { CreateTicketModal } from "./CreateTicketModal";

type TicketFilterKey = "todos" | "abiertos" | "por-vencer" | "vencidos" | "espera" | "cerrados";
type SortKey = "numero" | "asunto" | "cliente" | "departamento" | "prioridad" | "estado" | "sla" | "actividad";

const filters: { key: TicketFilterKey; label: string; countKey: keyof TicketCounts }[] = [
  { key: "todos", label: "Todos", countKey: "all" },
  { key: "abiertos", label: "Abiertos", countKey: "open" },
  { key: "por-vencer", label: "Por vencer", countKey: "upcoming" },
  { key: "vencidos", label: "Vencidos", countKey: "overdue" },
  { key: "espera", label: "En espera del cliente", countKey: "waitingOnClient" },
  { key: "cerrados", label: "Cerrados", countKey: "closed" },
];

const columns: { key: SortKey; label: string }[] = [
  { key: "numero", label: "Número" },
  { key: "asunto", label: "Asunto / Motivo" },
  { key: "cliente", label: "Cliente" },
  { key: "departamento", label: "Departamento" },
  { key: "prioridad", label: "Prioridad" },
  { key: "estado", label: "Estado" },
  { key: "sla", label: "SLA" },
  { key: "actividad", label: "Última actividad" },
];

function priorityBadgeClass(priority: string) {
  switch (priority.toLowerCase()) {
    case "emergencia":
      return "bg-red-50 text-red-700 border-red-200 font-semibold";
    case "alta":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "normal":
      return "bg-slate-50 text-slate-700 border-slate-200";
    case "baja":
      return "bg-gray-50 text-gray-600 border-gray-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}


export function TicketsPage() {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TicketFilterKey>("todos");
  const [departmentId, setDepartmentId] = useState<number | "todos">("todos");
  const [priority, setPriority] = useState<string>("todas");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "actividad",
    dir: "desc",
  });
  const [pageSize, setPageSize] = useState(10);
  const debouncedSearch = useDebouncedValue(search).trim();

  // Fase 8: Selección múltiple, acciones en lote y alta manual
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkPriorityOpen, setBulkPriorityOpen] = useState(false);
  const [bulkStaffId, setBulkStaffId] = useState<string>("");
  const [bulkPriority, setBulkPriority] = useState<string>("Normal");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<{ variant: "success" | "error" | "info"; message: string } | null>(null);
  const [staffOptions, setStaffOptions] = useState<TicketStaffOptionResponse[]>([]);

  useEffect(() => {
    departmentsApi
      .list()
      .then(setDepartments)
      .catch(() => setDepartments([]));
  }, []);

  const { onTicketsChanged } = useEmailCounts();

  const { data, isStale, error, setPage, refresh } = usePagedList<TicketQuery, TicketListResponse>({
    fetch: ticketsApi.list,
    criteria: {
      pageSize,
      search: debouncedSearch || undefined,
      departmentId: departmentId === "todos" ? undefined : departmentId,
      priority: priority === "todas" ? undefined : priority,
      status: filter,
      sort: sort.key,
      dir: sort.dir,
    },
    fallbackError: "No se pudieron cargar los tickets",
  });

  useEffect(() => {
    return onTicketsChanged(() => {
      refresh();
    });
  }, [onTicketsChanged, refresh]);

  const rows: TicketListItemResponse[] = data?.items ?? [];
  const counts = data?.counts;

  const allVisibleIds = rows.map((r) => r.id);
  const allVisibleSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = allVisibleIds.some((id) => selectedIds.has(id));

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allVisibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allVisibleIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  function openBulkAssign() {
    if (staffOptions.length === 0) {
      ticketsApi
        .createOptions()
        .then((opts) => {
          setStaffOptions(opts.assignableStaff);
        })
        .catch(() => {});
    }
    setBulkAssignOpen(true);
  }

  async function handleBulkAssignSubmit() {
    setBulkSubmitting(true);
    setBulkFeedback(null);
    try {
      const targetStaffId = bulkStaffId ? parseInt(bulkStaffId, 10) : null;
      const res = await ticketsApi.bulkAssign({
        ticketIds: Array.from(selectedIds),
        staffId: targetStaffId,
      });
      setBulkAssignOpen(false);
      setSelectedIds(new Set());
      refresh();
      if (res.updatedCount < res.totalRequested) {
        const skipped = res.totalRequested - res.updatedCount;
        setBulkFeedback({
          variant: "info",
          message: `Se reasignaron ${res.updatedCount} de ${res.totalRequested} tickets (${skipped} omitidos por estar cerrados o no autorizados).`,
        });
      } else {
        setBulkFeedback({
          variant: "success",
          message: `Se asignaron exitosamente los ${res.updatedCount} tickets seleccionados.`,
        });
      }
    } catch (err) {
      setBulkFeedback({
        variant: "error",
        message: err instanceof Error ? err.message : "Error al asignar tickets en lote",
      });
    } finally {
      setBulkSubmitting(false);
    }
  }

  async function handleBulkPrioritySubmit() {
    setBulkSubmitting(true);
    setBulkFeedback(null);
    try {
      const res = await ticketsApi.bulkPriority({
        ticketIds: Array.from(selectedIds),
        priority: bulkPriority,
      });
      setBulkPriorityOpen(false);
      setSelectedIds(new Set());
      refresh();
      if (res.updatedCount < res.totalRequested) {
        const skipped = res.totalRequested - res.updatedCount;
        setBulkFeedback({
          variant: "info",
          message: `Se actualizó la prioridad a '${bulkPriority}' en ${res.updatedCount} de ${res.totalRequested} tickets (${skipped} omitidos por estar cerrados).`,
        });
      } else {
        setBulkFeedback({
          variant: "success",
          message: `Se actualizó la prioridad a '${bulkPriority}' en los ${res.updatedCount} tickets seleccionados.`,
        });
      }
    } catch (err) {
      setBulkFeedback({
        variant: "error",
        message: err instanceof Error ? err.message : "Error al cambiar prioridad en lote",
      });
    } finally {
      setBulkSubmitting(false);
    }
  }

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  return (
    <div className="flex h-full flex-col relative">
      <ModuleHeader
        title="Tickets"
        summary={
          counts
            ? `${counts.all} tickets · ${counts.open} abiertos · ${counts.overdue} vencidos · ${counts.waitingOnClient} en espera`
            : "Cargando bandeja de tickets…"
        }
        action={
          <Button size="sm" onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Nuevo ticket
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto pb-8">
        {/* Barra de criterios: búsqueda, filtros estructurales y pastillas RF-T2 */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar por número, asunto o cliente…"
            className="w-[260px]"
          />

          <Select
            size="sm"
            className="w-[200px]"
            aria-label="Filtrar por departamento"
            value={String(departmentId)}
            onChange={(next) => setDepartmentId(next === "todos" ? "todos" : Number(next))}
            options={[
              { value: "todos", label: "Todos los deptos." },
              ...departments.map((d) => ({
                value: String(d.id),
                label: d.name,
              })),
            ]}
          />

          <Select
            size="sm"
            className="w-[150px]"
            aria-label="Filtrar por prioridad"
            value={priority}
            onChange={(next) => setPriority(next)}
            options={[
              { value: "todas", label: "Todas las prioridades" },
              { value: "Emergencia", label: "Emergencia" },
              { value: "Alta", label: "Alta" },
              { value: "Normal", label: "Normal" },
              { value: "Baja", label: "Baja" },
            ]}
          />

          <span aria-hidden className="mx-1 h-5 w-px bg-line" />

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

        {bulkFeedback && (
          <div className="mb-3">
            <Alert variant={bulkFeedback.variant}>
              <div className="flex items-center justify-between w-full">
                <span>{bulkFeedback.message}</span>
                <button
                  type="button"
                  onClick={() => setBulkFeedback(null)}
                  className="ml-2 text-xs underline cursor-pointer hover:opacity-80"
                >
                  Cerrar
                </button>
              </div>
            </Alert>
          </div>
        )}

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
          <div className={`transition-opacity ${isStale ? "opacity-60" : ""}`}>
            <DataTable>
              <thead>
                <HeadRow>
                  <Th className="w-10 !px-3">
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todos los tickets visibles"
                      className="h-4 w-4 rounded-[2px] border-line text-brand-red focus:ring-brand-red cursor-pointer accent-brand-red"
                      checked={allVisibleSelected}
                      ref={(input) => {
                        if (input) {
                          input.indeterminate = someVisibleSelected && !allVisibleSelected;
                        }
                      }}
                      onChange={toggleSelectAll}
                    />
                  </Th>
                  {columns.map(({ key, label }) => (
                    <Th
                      key={key}
                      sort={{
                        dir: sort.key === key ? sort.dir : null,
                        onToggle: () => toggleSort(key),
                      }}
                    >
                      {label}
                    </Th>
                  ))}
                  <Th>Asignado</Th>
                </HeadRow>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 2} className="py-16 text-center text-subtle">
                      <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                        <TicketIcon className="h-8 w-8 text-subtle/50" />
                        <p className="text-[14px] font-medium text-ink">No se encontraron tickets</p>
                        <p className="text-[12.5px] text-subtle">
                          No hay registros que coincidan con los criterios de búsqueda o filtros seleccionados.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((t) => {
                    const sla = formatSlaRemaining(t.resolutionDueAt, Boolean(t.pausedAt));
                    return (
                      <Row
                        key={t.id}
                        onClick={() => navigate(`/tickets/${t.id}`)}
                        className={`cursor-pointer hover:bg-slate-50/80 transition-colors ${
                          selectedIds.has(t.id) ? "bg-red-50/30" : ""
                        }`}
                      >
                        {/* Selección */}
                        <Td
                          className="w-10 !px-3"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <input
                            type="checkbox"
                            aria-label={`Seleccionar ticket ${t.number}`}
                            className="h-4 w-4 rounded-[2px] border-line text-brand-red focus:ring-brand-red cursor-pointer accent-brand-red"
                            checked={selectedIds.has(t.id)}
                            onChange={() => toggleSelect(t.id)}
                          />
                        </Td>

                        {/* Número */}
                        <Td className="whitespace-nowrap font-mono text-[12px] font-semibold text-ink">
                          {t.number}
                        </Td>

                        {/* Asunto y Tema */}
                        <Td className="max-w-[280px]">
                          <div className="truncate font-medium text-ink" title={t.subject}>
                            {t.subject}
                          </div>
                          <div className="text-[11.5px] text-subtle">
                            {t.topicName || "Sin motivo"}
                            {t.productLineName && ` · ${t.productLineName}`}
                          </div>
                        </Td>

                        {/* Cliente */}
                        <Td className="max-w-[200px]">
                          <div className="truncate font-medium text-ink" title={t.clientName || "Sin cliente"}>
                            {t.clientName || "Sin cliente"}
                          </div>
                          <div className="text-[11.5px] text-subtle">
                            {t.contactName ?? t.clientCode ?? "—"}
                          </div>
                        </Td>

                        {/* Departamento */}
                        <Td className="whitespace-nowrap text-subtle">{t.departmentName || "Sin departamento"}</Td>

                        {/* Prioridad */}
                        <Td className="whitespace-nowrap">
                          <span
                            className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] border ${priorityBadgeClass(
                              t.priority,
                            )}`}
                          >
                            {t.priority}
                          </span>
                        </Td>

                        {/* Estado */}
                        <Td className="whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              aria-hidden
                              className={`h-[7px] w-[7px] shrink-0 rounded-full ${
                                t.status === "Abierto"
                                  ? "bg-brand-green"
                                  : t.status === "Cancelado"
                                  ? "bg-brand-red"
                                  : "bg-amber-400"
                              }`}
                            />
                            <span className="text-[12px] text-ink">{t.status}</span>
                          </span>
                        </Td>

                        {/* SLA (RF-T6) */}
                        <Td className="whitespace-nowrap">
                          {sla.tone === "overdue" ? (
                            <Badge tone="red">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {sla.text}
                              </span>
                            </Badge>
                          ) : sla.tone === "warning" ? (
                            <span className="inline-flex h-[22px] items-center whitespace-nowrap rounded-full bg-amber-500/10 px-2.5 text-[11.5px] font-semibold text-amber-800">
                              <Clock className="mr-1 h-3 w-3" />
                              {sla.text}
                            </span>
                          ) : sla.tone === "paused" ? (
                            <span className="inline-flex h-[22px] items-center whitespace-nowrap rounded-full bg-slate-100 px-2.5 text-[11.5px] font-semibold text-slate-600">
                              {sla.text}
                            </span>
                          ) : (
                            <span className="text-[11.5px] text-subtle">{sla.text}</span>
                          )}
                        </Td>

                        {/* Última actividad */}
                        <Td className="whitespace-nowrap text-[12px] text-subtle">
                          {formatDateTime(t.lastActivityAt)}
                        </Td>

                        {/* Asignado */}
                        <Td className="whitespace-nowrap text-[12px]">
                          {t.assignedStaffName ? (
                            <span className="font-medium text-ink">{t.assignedStaffName}</span>
                          ) : (
                            <span className="text-subtle/70 italic">Sin asignar</span>
                          )}
                        </Td>
                      </Row>
                    );
                  })
                )}
              </tbody>
            </DataTable>

            {data.total > 0 && (
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                total={data.total}
                pageSize={data.pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                noun="tickets"
              />
            )}
          </div>
        )}
      </div>

      {/* Barra flotante de acciones en lote (RF-T11) */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-[2px] border border-slate-700 bg-ink px-4 py-2.5 text-white shadow-2xl animate-plf-toast-in">
          <div className="flex items-center gap-2 text-[12.5px] font-medium text-slate-200">
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-red px-1.5 text-[10.5px] font-bold text-white">
              {selectedIds.size}
            </span>
            <span>{selectedIds.size === 1 ? "ticket seleccionado" : "tickets seleccionados"}</span>
          </div>
          <span className="h-4 w-px bg-slate-700" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openBulkAssign}
              className="flex items-center gap-1.5 rounded-[2px] bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-white/20 cursor-pointer"
            >
              <UserCheck className="h-3.5 w-3.5 text-brand-red" />
              Asignar en lote
            </button>
            <button
              type="button"
              onClick={() => setBulkPriorityOpen(true)}
              className="flex items-center gap-1.5 rounded-[2px] bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-white/20 cursor-pointer"
            >
              <Flag className="h-3.5 w-3.5 text-amber-400" />
              Cambiar prioridad
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="rounded-[2px] px-2.5 py-1.5 text-[12px] text-slate-400 transition hover:text-white cursor-pointer"
            >
              Deseleccionar
            </button>
          </div>
        </div>
      )}

      {/* Modal alta manual de ticket (RF-T10) */}
      {createModalOpen && (
        <CreateTicketModal
          onClose={() => setCreateModalOpen(false)}
          onCreated={(created) => {
            refresh();
            navigate(`/tickets/${created.id}`);
          }}
        />
      )}

      {/* Modal asignación en lote (RF-T11) */}
      {bulkAssignOpen && (
        <Modal
          eyebrow="Acciones en lote"
          title="Asignar tickets en lote"
          description={`Selecciona el colaborador al que deseas asignar los ${selectedIds.size} tickets seleccionados.`}
          onClose={() => {
            if (!bulkSubmitting) setBulkAssignOpen(false);
          }}
          footer={({ requestClose }) => (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={requestClose}
                disabled={bulkSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleBulkAssignSubmit}
                isLoading={bulkSubmitting}
              >
                Confirmar asignación
              </Button>
            </>
          )}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-ink">Colaborador asignado</label>
              <Select
                size="sm"
                value={bulkStaffId}
                onChange={(val) => setBulkStaffId(val)}
                options={[
                  { value: "", label: "— Sin asignar (desasignar) —" },
                  ...staffOptions.map((s) => ({
                    value: String(s.id),
                    label: `${s.fullName} (${s.email})`,
                  })),
                ]}
              />
            </div>
            <p className="text-[12px] text-subtle leading-relaxed">
              Se validará que el colaborador tenga acceso a los departamentos de cada ticket.
              Los tickets resueltos o cancelados se omitirán automáticamente.
            </p>
          </div>
        </Modal>
      )}

      {/* Modal cambio de prioridad en lote (RF-T11) */}
      {bulkPriorityOpen && (
        <Modal
          eyebrow="Acciones en lote"
          title="Cambiar prioridad en lote"
          description={`Selecciona la nueva prioridad para los ${selectedIds.size} tickets seleccionados.`}
          onClose={() => {
            if (!bulkSubmitting) setBulkPriorityOpen(false);
          }}
          footer={({ requestClose }) => (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={requestClose}
                disabled={bulkSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleBulkPrioritySubmit}
                isLoading={bulkSubmitting}
              >
                Actualizar prioridad
              </Button>
            </>
          )}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-ink">Nueva prioridad</label>
              <Select
                size="sm"
                value={bulkPriority}
                onChange={(val) => setBulkPriority(val)}
                options={[
                  { value: "Emergencia", label: "Emergencia" },
                  { value: "Alta", label: "Alta" },
                  { value: "Normal", label: "Normal" },
                  { value: "Baja", label: "Baja" },
                ]}
              />
            </div>
            <p className="text-[12px] text-subtle leading-relaxed">
              Se recalculará la fecha límite de SLA según la política correspondiente a la nueva prioridad.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
