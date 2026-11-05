import { Clock } from "lucide-react";
import { DetailCard } from "../../../components/ui/DetailCard";
import { formatDateTime, type formatSlaRemaining } from "../../../lib/format";
import type { TicketDetailResponse } from "../../../types/api";
import { SlaCell } from "../ticketCells";

interface TicketSlaCardProps {
  ticket: TicketDetailResponse;
  sla: ReturnType<typeof formatSlaRemaining>;
}

/** Card: SLA y Tiempos. */
export function TicketSlaCard({ ticket, sla }: TicketSlaCardProps) {
  return (
    <DetailCard icon={Clock} title="SLA y Tiempos" aside={<SlaCell sla={sla} />}>
      <div className="px-4 py-1 divide-y divide-zinc-100 text-[12.5px]">
        <div className="flex items-center justify-between py-2">
          <span className="text-zinc-500 font-medium">Compromiso resolución</span>
          <span className={`tabular-nums font-medium ${sla.tone === "overdue" ? "text-brand-red font-semibold" : "text-zinc-900"}`}>
            {ticket.resolutionDueAt ? formatDateTime(ticket.resolutionDueAt) : "Sin compromiso"}
          </span>
        </div>

        <div className="flex items-center justify-between py-2">
          <span className="text-zinc-500 font-medium">1.ª respuesta</span>
          {ticket.firstResponseAt ? (
            <span className="text-emerald-700 font-medium tabular-nums text-right truncate max-w-[60%]" title={`Lograda el ${formatDateTime(ticket.firstResponseAt)}`}>
              Lograda · {formatDateTime(ticket.firstResponseAt)}
            </span>
          ) : ticket.firstResponseDueAt ? (
            <span className="tabular-nums text-zinc-800 text-right truncate max-w-[60%]">
              Límite · {formatDateTime(ticket.firstResponseDueAt)}
            </span>
          ) : (
            <span className="text-zinc-400 font-normal">Pendiente</span>
          )}
        </div>

        {ticket.pausedAt && (
          <div className="flex items-center justify-between py-2">
            <span className="text-zinc-500 font-medium">En pausa desde</span>
            <span className="font-medium text-amber-700 tabular-nums">
              {formatDateTime(ticket.pausedAt)}
            </span>
          </div>
        )}

        {ticket.pausedMinutes > 0 && (
          <div className="flex items-center justify-between py-2">
            <span className="text-zinc-500 font-medium">Tiempo total pausado</span>
            <span className="tabular-nums text-zinc-800 font-medium">{ticket.pausedMinutes} min</span>
          </div>
        )}

        {ticket.reopenedCount > 0 && (
          <div className="flex items-center justify-between py-2">
            <span className="text-zinc-500 font-medium">Reaperturas</span>
            <span className="font-bold tabular-nums text-amber-700">{ticket.reopenedCount}</span>
          </div>
        )}

        {ticket.resolvedAt && (
          <div className="flex items-center justify-between py-2">
            <span className="text-zinc-500 font-medium">Resuelto</span>
            <span className="tabular-nums text-zinc-800 font-medium">{formatDateTime(ticket.resolvedAt)}</span>
          </div>
        )}

        {ticket.verdictName && (
          <div className="flex items-center justify-between py-2">
            <span className="text-zinc-500 font-medium">Veredicto</span>
            <span className="font-semibold text-emerald-800 truncate max-w-[60%]" title={ticket.verdictName}>
              {ticket.verdictName}
            </span>
          </div>
        )}

        {ticket.closedAt && (
          <div className="flex items-center justify-between py-2">
            <span className="text-zinc-500 font-medium">Cerrado definitivamente</span>
            <span className="tabular-nums text-zinc-800 font-medium">{formatDateTime(ticket.closedAt)}</span>
          </div>
        )}

        <div className="flex items-center justify-between py-2">
          <span className="text-zinc-500 font-medium">Última actividad</span>
          <span className="tabular-nums text-zinc-600 font-medium">{formatDateTime(ticket.lastActivityAt)}</span>
        </div>
      </div>
    </DetailCard>
  );
}
