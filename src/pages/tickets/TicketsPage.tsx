import { Clock, Ticket as TicketIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { departmentsApi } from "../../api/departments";
import { ticketsApi } from "../../api/tickets";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { DataTable, HeadRow, Row, Td, Th, type SortDir } from "../../components/ui/DataTable";
import { FilterChip } from "../../components/ui/FilterChip";
import { Pagination } from "../../components/ui/Pagination";
import { SearchInput } from "../../components/ui/SearchInput";
import { Select } from "../../components/ui/Select";
import { Spinner } from "../../components/ui/Spinner";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { formatDateTime, formatSlaRemaining } from "../../lib/format";
import type {
  DepartmentResponse,
  TicketCounts,
  TicketListItemResponse,
  TicketListResponse,
  TicketQuery,
} from "../../types/api";

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

  useEffect(() => {
    departmentsApi
      .list()
      .then(setDepartments)
      .catch(() => setDepartments([]));
  }, []);

  const { data, isStale, error, setPage } = usePagedList<TicketQuery, TicketListResponse>({
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

  const rows: TicketListItemResponse[] = data?.items ?? [];
  const counts = data?.counts;

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        title="Tickets"
        summary={
          counts
            ? `${counts.all} tickets · ${counts.open} abiertos · ${counts.overdue} vencidos · ${counts.waitingOnClient} en espera`
            : "Cargando bandeja de tickets…"
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
                    <td colSpan={columns.length + 1} className="py-16 text-center text-subtle">
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
                      <Row key={t.id}>
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
                            {t.topicName}
                            {t.productLineName && ` · ${t.productLineName}`}
                          </div>
                        </Td>

                        {/* Cliente */}
                        <Td className="max-w-[200px]">
                          <div className="truncate font-medium text-ink" title={t.clientName}>
                            {t.clientName}
                          </div>
                          <div className="text-[11.5px] text-subtle">
                            {t.contactName ?? t.clientCode}
                          </div>
                        </Td>

                        {/* Departamento */}
                        <Td className="whitespace-nowrap text-subtle">{t.departmentName}</Td>

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
    </div>
  );
}
