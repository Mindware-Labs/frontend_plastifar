import {
  Archive,
  ArrowDown,
  ArrowRightCircle,
  ArrowUp,
  ArrowUpCircle,
  CheckCircle2,
  Circle,
  Clock3,
  Eye,
  Flame,
  Minus,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import { useMemo, useState, type ComponentType } from "react";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ColumnPicker, type ColumnOption } from "../../components/ui/ColumnPicker";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { FilterChip } from "../../components/ui/FilterChip";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { Select } from "../../components/ui/Select";
import { Tooltip } from "../../components/ui/Tooltip";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type SlaState,
  type TicketPriority,
  type TicketRow,
  type TicketStatus,
} from "../../types/dashboard";
import { DashboardCard } from "./DashboardCard";

const priorityStyle: Record<TicketPriority, { icon: ComponentType<{ className?: string }>; tone: "red" | "warn" | "neutral" }> = {
  "Crítica": { icon: Flame, tone: "red" },
  Alta: { icon: ArrowUp, tone: "warn" },
  Media: { icon: Minus, tone: "neutral" },
  Baja: { icon: ArrowDown, tone: "neutral" },
};

const statusStyle: Record<TicketStatus, { icon: ComponentType<{ className?: string }>; tone: "neutral" | "warn" | "red" | "green" }> = {
  Abierto: { icon: Circle, tone: "neutral" },
  "En progreso": { icon: ArrowRightCircle, tone: "neutral" },
  "Esperando respuesta": { icon: Clock3, tone: "warn" },
  Escalado: { icon: ArrowUpCircle, tone: "red" },
  Resuelto: { icon: CheckCircle2, tone: "green" },
  Cerrado: { icon: Archive, tone: "neutral" },
};

const slaStyle: Record<SlaState, { icon: ComponentType<{ className?: string }>; tone: "green" | "warn" | "red" }> = {
  "A tiempo": { icon: CheckCircle2, tone: "green" },
  "En riesgo": { icon: Clock3, tone: "warn" },
  Vencido: { icon: Flame, tone: "red" },
};

function timeAgo(minutes: number): string {
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
}

const COLUMNS: ColumnOption[] = [
  { id: "ticket", label: "Ticket", locked: true },
  { id: "solicitante", label: "Solicitante" },
  { id: "categoria", label: "Categoría" },
  { id: "prioridad", label: "Prioridad" },
  { id: "estado", label: "Estado" },
  { id: "agente", label: "Agente asignado" },
  { id: "sla", label: "SLA" },
  { id: "actualizado", label: "Última actualización" },
];

type ChipKey = "todos" | "urgentes" | "sinAsignar" | "slaRiesgo";

interface TicketsTableProps {
  tickets: TicketRow[];
}

/**
 * La bandeja: centro visual del dashboard. Estado y prioridad llevan icono
 * ademas de color — nunca solo color — y las acciones de fila se revelan al
 * pasar el mouse en vez de competir con el contenido todo el tiempo.
 */
export function TicketsTable({ tickets }: TicketsTableProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("todos");
  const [priority, setPriority] = useState("todos");
  const [category, setCategory] = useState("todos");
  const [assignee, setAssignee] = useState("todos");
  const [chip, setChip] = useState<ChipKey>("todos");
  const [visibleColumns, setVisibleColumns] = useState<string[]>(COLUMNS.map((c) => c.id));

  const debouncedSearch = useDebouncedValue(search).trim().toLowerCase();

  const categories = useMemo(() => [...new Set(tickets.map((t) => t.category))].sort(), [tickets]);
  const assignees = useMemo(
    () => [...new Set(tickets.map((t) => t.assigneeName).filter((n): n is string => n !== null))].sort(),
    [tickets],
  );

  const urgentCount = tickets.filter((t) => t.priority === "Crítica" || t.priority === "Alta").length;
  const unassignedCount = tickets.filter((t) => t.assigneeName === null).length;
  const slaRiskCount = tickets.filter((t) => t.sla !== "A tiempo").length;

  function isVisible(id: string) {
    return visibleColumns.includes(id);
  }

  const rows = tickets.filter((ticket) => {
    const byChip =
      chip === "todos" ||
      (chip === "urgentes" && (ticket.priority === "Crítica" || ticket.priority === "Alta")) ||
      (chip === "sinAsignar" && ticket.assigneeName === null) ||
      (chip === "slaRiesgo" && ticket.sla !== "A tiempo");

    const byStatus = status === "todos" || ticket.status === status;
    const byPriority = priority === "todos" || ticket.priority === priority;
    const byCategory = category === "todos" || ticket.category === category;
    const byAssignee =
      assignee === "todos" ||
      (assignee === "sin-asignar" ? ticket.assigneeName === null : ticket.assigneeName === assignee);

    const bySearch =
      debouncedSearch === "" ||
      ticket.subject.toLowerCase().includes(debouncedSearch) ||
      ticket.number.includes(debouncedSearch) ||
      ticket.requesterName.toLowerCase().includes(debouncedSearch);

    return byChip && byStatus && byPriority && byCategory && byAssignee && bySearch;
  });

  return (
    <DashboardCard padding="sm" className="flex min-h-0 flex-col">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-[13px] font-bold tracking-[-0.01em] text-ink">
            Bandeja de tickets
          </h2>
          <p className="mt-0.5 text-[12px] text-muted">
            {rows.length} de {tickets.length} tickets · datos de demostración
          </p>
        </div>

        <Tooltip content="Se habilita cuando la Bandeja de tickets exista de verdad">
          <Button size="sm" disabled>
            <Plus className="h-[15px] w-[15px]" />
            Nuevo ticket
          </Button>
        </Tooltip>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-line-soft pb-3.5">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por ticket, asunto o solicitante…"
          className="w-[240px]"
        />

        <Select
          size="sm"
          className="w-[150px]"
          aria-label="Filtrar por estado"
          value={status}
          onChange={setStatus}
          options={[
            { value: "todos", label: "Todos los estados" },
            ...TICKET_STATUSES.map((value) => ({ value, label: value })),
          ]}
        />

        <Select
          size="sm"
          className="w-[140px]"
          aria-label="Filtrar por prioridad"
          value={priority}
          onChange={setPriority}
          options={[
            { value: "todos", label: "Toda prioridad" },
            ...TICKET_PRIORITIES.map((value) => ({ value, label: value })),
          ]}
        />

        <Select
          size="sm"
          className="w-[150px]"
          aria-label="Filtrar por categoría"
          value={category}
          onChange={setCategory}
          options={[
            { value: "todos", label: "Toda categoría" },
            ...categories.map((value) => ({ value, label: value })),
          ]}
        />

        <Select
          size="sm"
          className="w-[150px]"
          aria-label="Filtrar por agente"
          value={assignee}
          onChange={setAssignee}
          options={[
            { value: "todos", label: "Todo agente" },
            { value: "sin-asignar", label: "Sin asignar" },
            ...assignees.map((value) => ({ value, label: value })),
          ]}
        />

        <div className="ml-auto">
          <ColumnPicker columns={COLUMNS} visible={visibleColumns} onChange={setVisibleColumns} />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <FilterChip label="Todos" count={tickets.length} active={chip === "todos"} onClick={() => setChip("todos")} />
        <FilterChip
          label="Urgentes"
          count={urgentCount}
          active={chip === "urgentes"}
          onClick={() => setChip("urgentes")}
        />
        <FilterChip
          label="Sin asignar"
          count={unassignedCount}
          active={chip === "sinAsignar"}
          onClick={() => setChip("sinAsignar")}
        />
        <FilterChip
          label="SLA en riesgo"
          count={slaRiskCount}
          active={chip === "slaRiesgo"}
          onClick={() => setChip("slaRiesgo")}
        />
      </div>

      {rows.length === 0 ? (
        <p className="py-14 text-center text-[13.5px] text-faint">
          Ningún ticket coincide con este filtro o búsqueda.
        </p>
      ) : (
        <>
          {/* Escritorio: tabla completa. */}
          <div className="hidden overflow-x-auto lg:block">
            <DataTable>
              <thead>
                <HeadRow>
                  <Th className="w-[280px]">Ticket</Th>
                  {isVisible("solicitante") && <Th>Solicitante</Th>}
                  {isVisible("categoria") && <Th>Categoría</Th>}
                  {isVisible("prioridad") && <Th>Prioridad</Th>}
                  {isVisible("estado") && <Th>Estado</Th>}
                  {isVisible("agente") && <Th>Agente</Th>}
                  {isVisible("sla") && <Th>SLA</Th>}
                  {isVisible("actualizado") && <Th>Actualizado</Th>}
                  <Th className="w-16 text-right">Acciones</Th>
                </HeadRow>
              </thead>

              <tbody>
                {rows.map((ticket) => {
                  const priorityInfo = priorityStyle[ticket.priority];
                  const statusInfo = statusStyle[ticket.status];
                  const slaInfo = slaStyle[ticket.sla];

                  return (
                    <Row key={ticket.id} className="group">
                      <Td>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-[10.5px] text-faint">#{ticket.number}</span>
                          <span className="max-w-[260px] truncate text-[13px] font-medium text-ink">
                            {ticket.subject}
                          </span>
                        </div>
                      </Td>

                      {isVisible("solicitante") && (
                        <Td>
                          <div className="flex items-center gap-2">
                            <Avatar name={ticket.requesterName} seed={ticket.id} size={24} />
                            <div className="flex flex-col leading-tight">
                              <span className="whitespace-nowrap text-[12.5px] font-medium text-ink">
                                {ticket.requesterName}
                              </span>
                              <span className="whitespace-nowrap text-[10.5px] text-faint">
                                {ticket.requesterCompany}
                              </span>
                            </div>
                          </div>
                        </Td>
                      )}

                      {isVisible("categoria") && (
                        <Td className="whitespace-nowrap text-[12.5px] text-brand-gray">{ticket.category}</Td>
                      )}

                      {isVisible("prioridad") && (
                        <Td>
                          <Badge tone={priorityInfo.tone}>
                            <priorityInfo.icon className="mr-1 -ml-0.5 h-3 w-3" />
                            {ticket.priority}
                          </Badge>
                        </Td>
                      )}

                      {isVisible("estado") && (
                        <Td>
                          <Badge tone={statusInfo.tone}>
                            <statusInfo.icon className="mr-1 -ml-0.5 h-3 w-3" />
                            {ticket.status}
                          </Badge>
                        </Td>
                      )}

                      {isVisible("agente") && (
                        <Td>
                          {ticket.assigneeName ? (
                            <div className="flex items-center gap-2">
                              <Avatar name={ticket.assigneeName} seed={ticket.id + 97} size={22} />
                              <span className="whitespace-nowrap text-[12.5px] text-brand-gray">
                                {ticket.assigneeName}
                              </span>
                            </div>
                          ) : (
                            <span className="whitespace-nowrap text-[12px] font-medium text-warn">
                              Sin asignar
                            </span>
                          )}
                        </Td>
                      )}

                      {isVisible("sla") && (
                        <Td>
                          <Badge tone={slaInfo.tone}>
                            <slaInfo.icon className="mr-1 -ml-0.5 h-3 w-3" />
                            {ticket.sla}
                          </Badge>
                        </Td>
                      )}

                      {isVisible("actualizado") && (
                        <Td className="whitespace-nowrap text-[12px] text-faint">
                          {timeAgo(ticket.updatedMinutesAgo)}
                        </Td>
                      )}

                      <Td>
                        <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                          <RowAction label={`Ver ${ticket.subject}`} icon={Eye} onClick={() => {}} disabled />
                          <RowAction label={`Más acciones para ${ticket.subject}`} icon={MoreHorizontal} onClick={() => {}} disabled />
                        </div>
                      </Td>
                    </Row>
                  );
                })}
              </tbody>
            </DataTable>
          </div>

          {/* Movil / tablet: una tarjeta por ticket, sin perder la info clave. */}
          <div className="flex flex-col gap-2.5 lg:hidden">
            {rows.map((ticket) => {
              const priorityInfo = priorityStyle[ticket.priority];
              const statusInfo = statusStyle[ticket.status];
              const slaInfo = slaStyle[ticket.sla];

              return (
                <div key={ticket.id} className="rounded-xl border border-line-soft p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-mono text-[10.5px] text-faint">#{ticket.number}</span>
                      <p className="truncate text-[13px] font-medium text-ink">{ticket.subject}</p>
                    </div>
                    <RowAction label="Más acciones" icon={MoreHorizontal} onClick={() => {}} disabled />
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <Avatar name={ticket.requesterName} seed={ticket.id} size={22} />
                    <span className="text-[12px] text-brand-gray">
                      {ticket.requesterName} · {ticket.requesterCompany}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <Badge tone={priorityInfo.tone}>
                      <priorityInfo.icon className="mr-1 -ml-0.5 h-3 w-3" />
                      {ticket.priority}
                    </Badge>
                    <Badge tone={statusInfo.tone}>
                      <statusInfo.icon className="mr-1 -ml-0.5 h-3 w-3" />
                      {ticket.status}
                    </Badge>
                    <Badge tone={slaInfo.tone}>
                      <slaInfo.icon className="mr-1 -ml-0.5 h-3 w-3" />
                      {ticket.sla}
                    </Badge>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-line-soft pt-2.5 text-[11.5px] text-faint">
                    <span>{ticket.assigneeName ?? "Sin asignar"}</span>
                    <span>{timeAgo(ticket.updatedMinutesAgo)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </DashboardCard>
  );
}
