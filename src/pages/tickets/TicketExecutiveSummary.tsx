import { Building2, Clock, Ticket as TicketIcon, User } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "../../components/ui/Skeleton";
import { formatDateTime, formatSlaRemaining } from "../../lib/format";
import type { TicketDetailResponse } from "../../types/api";
import { PriorityCell, SlaCell, StatusCell } from "./ticketCells";

interface TicketExecutiveSummaryProps {
  ticket: TicketDetailResponse;
  tasksCount: number;
}

export function TicketExecutiveSummary({ ticket, tasksCount }: TicketExecutiveSummaryProps) {
  const sla = formatSlaRemaining(
    ticket.resolutionDueAt,
    Boolean(ticket.pausedAt),
    ticket.status,
    ticket.closedAt,
  );
  const messageCount = ticket.messages.length;
  const eventCount = ticket.events.length;

  const metaParts = [
    ticket.topicName ? `Motivo ${ticket.topicName}` : null,
    ticket.departmentName ? ticket.departmentName : null,
    ticket.channel,
  ].filter(Boolean);

  return (
    <div className="space-y-3 text-xs">
      <div className="rounded-xl border border-zinc-200/90 bg-gradient-to-b from-zinc-50/80 to-white p-3 shadow-2xs">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center rounded-md border border-zinc-200/90 bg-white px-1.5 py-0.5 font-mono text-[11px] font-semibold text-brand-red tabular-nums shadow-2xs">
                {ticket.number}
              </span>
              <StatusCell status={ticket.status} />
              <PriorityCell priority={ticket.priority} />
            </div>
            <h3
              className="font-heading text-[14px] font-bold leading-snug tracking-[-0.01em] text-zinc-900 line-clamp-2"
              title={ticket.subject}
            >
              {ticket.subject}
            </h3>
            {metaParts.length > 0 && (
              <p className="truncate text-[11px] text-zinc-500" title={metaParts.join(" · ")}>
                {metaParts.join(" · ")}
              </p>
            )}
          </div>
          <div className="shrink-0 pt-0.5">
            <SlaCell sla={sla} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Mensajes", value: messageCount },
          { label: "Eventos", value: eventCount },
          { label: "Tareas", value: tasksCount },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-2 text-center"
          >
            <span className="font-heading text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              {label}
            </span>
            <span className="mt-0.5 block font-heading text-[16px] font-bold tabular-nums text-zinc-900">
              {value}
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-200/90 bg-white shadow-2xs overflow-hidden">
        <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50/50 px-4 py-2.5">
          <TicketIcon className="size-4 text-zinc-400" />
          <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            Operación
          </span>
        </div>
        <div className="divide-y divide-zinc-100 px-4 py-1 text-[12.5px]">
          <div className="flex items-center justify-between gap-3 py-2">
            <span className="font-medium text-zinc-500">Departamento</span>
            <span className="font-medium text-zinc-900">{ticket.departmentName ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between gap-3 py-2">
            <span className="flex items-center gap-1.5 font-medium text-zinc-500">
              <User className="size-3 text-zinc-400" />
              Asignado a
            </span>
            <span className="font-medium text-zinc-900">{ticket.assignedStaffName ?? "Sin asignar"}</span>
          </div>
          <div className="flex items-center justify-between gap-3 py-2">
            <span className="font-medium text-zinc-500">Canal</span>
            <span className="font-medium text-zinc-800">{ticket.channel}</span>
          </div>
          <div className="flex items-center justify-between gap-3 py-2">
            <span className="font-medium text-zinc-500">Creado</span>
            <span className="whitespace-nowrap tabular-nums text-zinc-800">
              {formatDateTime(ticket.createdAt)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 py-2">
            <span className="font-medium text-zinc-500">Última actividad</span>
            <span className="whitespace-nowrap tabular-nums text-zinc-800">
              {formatDateTime(ticket.lastActivityAt)}
            </span>
          </div>
        </div>
      </div>

      {ticket.clientName && (
        <div className="rounded-xl border border-zinc-200/90 bg-white shadow-2xs overflow-hidden">
          <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50/50 px-4 py-2.5">
            <Building2 className="size-4 text-zinc-400" />
            <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              Cliente
            </span>
          </div>
          <div className="divide-y divide-zinc-100 px-4 py-1 text-[12.5px]">
            <div className="flex items-center justify-between gap-3 py-2">
              <span className="font-medium text-zinc-500">Organización</span>
              {ticket.clientId ? (
                <Link
                  to={`/clientes/${ticket.clientId}`}
                  className="truncate font-semibold text-brand-red hover:underline max-w-[60%] text-right"
                  title={ticket.clientName}
                >
                  {ticket.clientName}
                </Link>
              ) : (
                <span className="font-semibold text-zinc-900">{ticket.clientName}</span>
              )}
            </div>
            {ticket.contactName && (
              <div className="flex items-center justify-between gap-3 py-2">
                <span className="font-medium text-zinc-500">Contacto</span>
                <span className="truncate text-zinc-900 max-w-[60%] text-right">{ticket.contactName}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-zinc-200/90 bg-white shadow-2xs overflow-hidden">
        <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50/50 px-4 py-2.5">
          <Clock className="size-4 text-zinc-400" />
          <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            SLA
          </span>
        </div>
        <div className="divide-y divide-zinc-100 px-4 py-1 text-[12.5px]">
          <div className="flex items-center justify-between gap-3 py-2">
            <span className="font-medium text-zinc-500">Compromiso resolución</span>
            <span className="whitespace-nowrap tabular-nums text-zinc-900">
              {ticket.resolutionDueAt ? formatDateTime(ticket.resolutionDueAt) : "Sin compromiso"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 py-2">
            <span className="font-medium text-zinc-500">1.ª respuesta</span>
            <span className="whitespace-nowrap tabular-nums text-zinc-800 text-right max-w-[65%] truncate">
              {ticket.firstResponseAt
                ? `Lograda · ${formatDateTime(ticket.firstResponseAt)}`
                : ticket.firstResponseDueAt
                  ? `Límite · ${formatDateTime(ticket.firstResponseDueAt)}`
                  : "Pendiente"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TicketSummarySectionHeadSkeleton({ blockIndex }: { blockIndex: number }) {
  const base = blockIndex * 80;
  return (
    <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50/50 px-3 py-2">
      <Skeleton className="size-4 shrink-0 rounded" delay={base} />
      <Skeleton className="h-2.5 w-20 shrink-0 rounded" delay={base + 20} />
    </div>
  );
}

/** Esqueleto del resumen ejecutivo del ticket (misma rejilla que el contenido cargado). */
export function TicketExecutiveSummarySkeleton() {
  return (
    <div
      role="status"
      aria-label="Cargando resumen del ticket"
      className="space-y-3 pb-2 select-none"
    >
      <div className="space-y-2 rounded-xl border border-zinc-200/90 bg-zinc-50/40 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Skeleton className="h-5 w-[88px] shrink-0 rounded-md" />
              <Skeleton className="h-5 w-16 shrink-0 rounded-md" delay={30} />
              <Skeleton className="h-5 w-12 shrink-0 rounded-md" delay={60} />
            </div>
            <Skeleton className="h-4 w-full max-w-md rounded" delay={80} />
            <Skeleton className="h-4 w-full max-w-xs rounded" delay={100} />
            <Skeleton className="h-3 w-full max-w-[11rem] rounded" delay={120} />
          </div>
          <Skeleton className="h-5 w-20 shrink-0 rounded-md" delay={90} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-2 text-center space-y-1.5">
            <Skeleton className="mx-auto h-2 w-12 shrink-0 rounded" delay={i * 40} />
            <Skeleton className="mx-auto h-5 w-8 shrink-0 rounded" delay={i * 40 + 40} />
          </div>
        ))}
      </div>

      {[0, 1, 2].map((block) => (
        <div key={block} className="overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-2xs">
          <TicketSummarySectionHeadSkeleton blockIndex={block} />
          <div className="space-y-0 divide-y divide-zinc-100 px-3 py-1">
            {Array.from({ length: block === 1 ? 2 : 4 }).map((_, row) => (
              <div key={row} className="flex items-center justify-between gap-3 py-2">
                <Skeleton className="h-3 w-24 shrink-0 rounded" delay={block * 80 + row * 35} />
                <Skeleton className="h-3 w-32 max-w-[45%] shrink-0 rounded" delay={block * 80 + row * 35 + 20} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
