import { Clock, Pencil, Tag } from "lucide-react";
import { Avatar } from "../../../components/ui/Avatar";
import { StatTile } from "../../../components/ui/StatTile";
import { formatDateTime, type formatSlaRemaining } from "../../../lib/format";
import type { TicketDetailResponse } from "../../../types/api";
import { PriorityCell, SlaCell } from "../ticketCells";

interface TicketKpiTilesProps {
  ticket: TicketDetailResponse;
  sla: ReturnType<typeof formatSlaRemaining>;
  canAssign: boolean;
  onOpenAssign: () => void;
}

/** Métricas rápidas superiores (4 tarjetas compactas tipo SaaS). */
export function TicketKpiTiles({ ticket, sla, canAssign, onOpenAssign }: TicketKpiTilesProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {/* 1.1 Estado */}
      <StatTile
        label="Estado"
        indicator={
          <span
            className={`h-2 w-2 rounded-full ${
              ticket.status === "Cerrado" || ticket.status === "Solucionado"
                ? "bg-emerald-500"
                : ticket.status === "Cancelado"
                ? "bg-zinc-400"
                : ticket.pausedAt
                ? "bg-amber-500"
                : "bg-blue-500"
            }`}
          />
        }
      >
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-heading text-[15px] font-bold text-zinc-900 truncate">
            {ticket.status}
          </span>
          {ticket.pausedAt ? (
            <span className="text-[11px] font-medium text-amber-600 truncate">
              Pausa ({ticket.pausedMinutes}m)
            </span>
          ) : ticket.verdictName ? (
            <span className="text-[11px] font-medium text-emerald-700 truncate" title={ticket.verdictName}>
              {ticket.verdictName}
            </span>
          ) : null}
        </div>
      </StatTile>

      {/* 1.2 Prioridad */}
      <StatTile label="Prioridad" indicator={<Tag className="h-3.5 w-3.5 text-zinc-400" />}>
        <div className="mt-1 flex items-center justify-between">
          <PriorityCell priority={ticket.priority} />
          <span className="text-[10px] font-heading font-semibold uppercase tracking-wider text-zinc-400">
            {ticket.channel}
          </span>
        </div>
      </StatTile>

      {/* 1.3 Compromiso SLA */}
      <StatTile label="SLA Resolución" indicator={<Clock className="h-3.5 w-3.5 text-zinc-400" />}>
        <div className="mt-1 flex items-center justify-between">
          <SlaCell sla={sla} />
          {ticket.resolutionDueAt && (
            <span className="text-[11px] text-zinc-400 truncate tabular-nums">
              {formatDateTime(ticket.resolutionDueAt)}
            </span>
          )}
        </div>
      </StatTile>

      {/* 1.4 Responsable */}
      <StatTile
        label="Responsable"
        indicator={
          canAssign && (
            <button
              type="button"
              onClick={onOpenAssign}
              title={ticket.assignedStaffId ? "Cambiar responsable" : "Asignar responsable"}
              className="text-zinc-400 hover:text-zinc-700 transition-colors p-0.5 rounded hover:bg-zinc-100 cursor-pointer"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )
        }
      >
        <div className="mt-1 flex items-center gap-2">
          {ticket.assignedStaffName && ticket.assignedStaffId !== null ? (
            <>
              <Avatar name={ticket.assignedStaffName} seed={ticket.assignedStaffId} size={20} />
              <span className="font-heading text-[13.5px] font-bold text-zinc-900 truncate">
                {ticket.assignedStaffName}
              </span>
            </>
          ) : (
            <span className="font-heading text-[13.5px] font-bold text-amber-600 italic">
              Sin asignar
            </span>
          )}
        </div>
      </StatTile>
    </div>
  );
}
