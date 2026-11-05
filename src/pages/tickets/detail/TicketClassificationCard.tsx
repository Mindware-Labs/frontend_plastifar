import { Pencil, Tag } from "lucide-react";
import { CopyButton } from "../../../components/ui/CopyButton";
import { DetailCard } from "../../../components/ui/DetailCard";
import { formatDateTime } from "../../../lib/format";
import type { TicketDetailResponse } from "../../../types/api";

interface TicketClassificationCardProps {
  ticket: TicketDetailResponse;
  departmentLabel: string | null | undefined;
  isClosed: boolean;
  onEdit: () => void;
}

/** Card: Clasificación y Enrutamiento. */
export function TicketClassificationCard({ ticket, departmentLabel, isClosed, onEdit }: TicketClassificationCardProps) {
  return (
    <DetailCard
      icon={Tag}
      title="Clasificación y Enrutamiento"
      aside={
        !isClosed && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-6 cursor-pointer items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 text-[11px] font-medium text-zinc-600 shadow-2xs outline-none transition-colors hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-red/25 motion-reduce:active:scale-100"
          >
            <Pencil className="size-3 text-zinc-400" />
            <span>Editar clasificación</span>
          </button>
        )
      }
    >
      <div className="px-4 py-1 divide-y divide-zinc-100">
        <div className="flex items-center justify-between py-2 text-[12.5px]">
          <span className="text-zinc-500 font-medium">Asunto</span>
          <div className="flex items-center gap-1.5 max-w-[70%]">
            <span className="font-semibold text-zinc-900 text-right truncate" title={ticket.subject}>
              {ticket.subject}
            </span>
            <CopyButton text={ticket.subject} label="Copiar asunto" className="cursor-pointer" />
          </div>
        </div>

        <div className="flex items-center justify-between py-2 text-[12.5px]">
          <span className="text-zinc-500 font-medium">Código / Número</span>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-zinc-800 tabular-nums font-semibold">
              {ticket.number}
            </span>
            <CopyButton text={ticket.number} label="Copiar código" className="cursor-pointer" />
          </div>
        </div>

        <div className="flex items-center justify-between py-2 text-[12.5px]">
          <span className="text-zinc-500 font-medium">Departamento</span>
          <span className="text-zinc-800 font-medium text-right truncate max-w-[65%]" title={departmentLabel ?? undefined}>
            {departmentLabel ?? "—"}
          </span>
        </div>

        <div className="flex items-center justify-between py-2 text-[12.5px]">
          <span className="text-zinc-500 font-medium">Motivo</span>
          <span className="text-zinc-800 font-medium text-right truncate max-w-[65%]" title={ticket.topicName ?? undefined}>
            {ticket.topicName ?? "—"}
          </span>
        </div>

        <div className="flex items-center justify-between py-2 text-[12.5px]">
          <span className="text-zinc-500 font-medium">Línea de producto</span>
          <span className="text-zinc-800 font-medium text-right truncate max-w-[65%]" title={ticket.productLineName ?? undefined}>
            {ticket.productLineName ?? <span className="text-zinc-400 font-normal">No aplica</span>}
          </span>
        </div>

        <div className="flex items-center justify-between py-2 text-[12.5px]">
          <span className="text-zinc-500 font-medium">Canal de origen</span>
          <span className="capitalize text-zinc-800 font-medium bg-zinc-100 border border-zinc-200/80 px-2 py-0.5 rounded text-[11.5px]">
            {ticket.channel}
          </span>
        </div>

        <div className="flex items-center justify-between py-2 text-[12.5px]">
          <span className="text-zinc-500 font-medium">Creado por</span>
          <span className="text-zinc-800 font-medium">
            {ticket.createdByStaffName ?? ticket.requesterName ?? "Sistema"}
            <span className="text-zinc-400 font-normal ml-1.5">({formatDateTime(ticket.createdAt)})</span>
          </span>
        </div>
      </div>
    </DetailCard>
  );
}
