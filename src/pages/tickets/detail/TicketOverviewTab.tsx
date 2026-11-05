import { Eye, FileText, Paperclip, Users } from "lucide-react";
import { Avatar } from "../../../components/ui/Avatar";
import { DetailCard } from "../../../components/ui/DetailCard";
import { formatBytes, formatDateTime, type formatSlaRemaining } from "../../../lib/format";
import type { TicketAttachmentResponse, TicketDetailResponse } from "../../../types/api";
import { FormattedTicketBody } from "../FormattedTicketBody";
import { AttachmentChip } from "../TicketMessageCard";
import { AlignedClampBody } from "./AlignedClampBody";
import { TicketActivityCard } from "./TicketActivityCard";
import { TicketClassificationCard } from "./TicketClassificationCard";
import { TicketClientCard } from "./TicketClientCard";
import { TicketKpiTiles } from "./TicketKpiTiles";
import { TicketSlaCard } from "./TicketSlaCard";
import { ACTIVITY_CARD_ID } from "./ticketDetailShared";

interface TicketOverviewTabProps {
  ticket: TicketDetailResponse;
  sla: ReturnType<typeof formatSlaRemaining>;
  departmentLabel: string | null | undefined;
  originMessage: TicketDetailResponse["messages"][number] | undefined;
  recipientEmail: string | null;
  isClosed: boolean;
  canAssign: boolean;
  messagesCount: number;
  tasksCount: number;
  notesCount: number;
  timelineCount: number;
  onOpenAssign: () => void;
  onOpenEdit: () => void;
  onOpenAttachment: (attachments: TicketAttachmentResponse[], attachmentId: number) => void;
  onOpenConversation: () => void;
  onOpenTasks: () => void;
  onOpenNotes: () => void;
  onShowTimeline: () => void;
}

/** TAB: DATOS / RESUMEN. */
export function TicketOverviewTab({
  ticket,
  sla,
  departmentLabel,
  originMessage,
  recipientEmail,
  isClosed,
  canAssign,
  messagesCount,
  tasksCount,
  notesCount,
  timelineCount,
  onOpenAssign,
  onOpenEdit,
  onOpenAttachment,
  onOpenConversation,
  onOpenTasks,
  onOpenNotes,
  onShowTimeline,
}: TicketOverviewTabProps) {
  return (
    <div className="space-y-3.5">
      {/* 1. Métricas rápidas superiores (4 tarjetas compactas tipo SaaS) */}
      <TicketKpiTiles ticket={ticket} sla={sla} canAssign={canAssign} onOpenAssign={onOpenAssign} />

      {/* 2. Grilla principal (2/3 + 1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        {/* Columna Izquierda (lg:col-span-2) */}
        <div className="lg:col-span-2 space-y-3.5">
          <TicketClassificationCard
            ticket={ticket}
            departmentLabel={departmentLabel}
            isClosed={isClosed}
            onEdit={onOpenEdit}
          />

          {/* Card: Detalle Inicial del Caso (Mensaje de apertura) */}
          {originMessage && (
            <DetailCard
              icon={FileText}
              title="Descripción Inicial del Caso"
              aside={
                <span className="text-[11px] text-zinc-400 font-mono tabular-nums">
                  {formatDateTime(originMessage.createdAt)}
                </span>
              }
            >
              <AlignedClampBody alignToId={ACTIVITY_CARD_ID} onExpand={onOpenConversation}>
                <div className="space-y-3">
                  <div className="text-[13px] leading-relaxed text-zinc-800">
                    <FormattedTicketBody html={originMessage.bodyHtml} text={originMessage.bodyText} />
                  </div>

                  {originMessage.attachments && originMessage.attachments.length > 0 && (
                    <div className="pt-2 border-t border-zinc-100">
                      <span className="text-[10.5px] font-heading font-semibold uppercase tracking-wider text-zinc-400 block mb-2">
                        Adjuntos incluidos ({originMessage.attachments.length})
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {originMessage.attachments.map((att) => (
                          <AttachmentChip
                            key={att.id}
                            attachment={att}
                            onOpen={() => onOpenAttachment(originMessage.attachments, att.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </AlignedClampBody>
            </DetailCard>
          )}

          {/* Card: Adjuntos generales del ticket */}
          {ticket.attachments.length > 0 && (
            <DetailCard icon={Paperclip} title={<>Adjuntos del Ticket ({ticket.attachments.length})</>}>
              <div className="divide-y divide-zinc-100/80 px-4 py-1">
                {ticket.attachments.map((att) => (
                  <button
                    key={att.id}
                    type="button"
                    onClick={() => onOpenAttachment(ticket.attachments, att.id)}
                    title={`Abrir ${att.fileName}`}
                    className="group flex w-full cursor-pointer items-center justify-between gap-3 py-2 text-left outline-none transition-colors hover:text-brand-red focus-visible:ring-2 focus-visible:ring-brand-red/25"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-500 transition-colors group-hover:bg-brand-red/10 group-hover:text-brand-red">
                        <FileText className="size-3.5" strokeWidth={2.25} />
                      </span>
                      <span className="truncate text-[12.5px] font-medium text-zinc-700 group-hover:text-zinc-900">
                        {att.fileName}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 font-heading text-[11px] font-bold tabular-nums text-zinc-400">
                      <span>{formatBytes(att.sizeBytes)}</span>
                      <Eye className="size-3.5 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  </button>
                ))}
              </div>
            </DetailCard>
          )}

          {/* Card: Observadores (si existen) */}
          {ticket.watchers.length > 0 && (
            <DetailCard icon={Users} title={<>Observadores ({ticket.watchers.length})</>}>
              <div className="p-4 flex flex-wrap gap-2">
                {ticket.watchers.map((watcher) => (
                  <div
                    key={watcher.id}
                    className="inline-flex h-7 items-center gap-2 rounded-md border border-zinc-200 bg-white pl-1.5 pr-2.5 text-[12px] text-zinc-800 shadow-2xs"
                    title={`${watcher.staffName} (${watcher.staffEmail})`}
                  >
                    <Avatar name={watcher.staffName} seed={watcher.id} size={18} />
                    <span className="font-medium">{watcher.staffName}</span>
                  </div>
                ))}
              </div>
            </DetailCard>
          )}
        </div>

        {/* Columna Derecha (lg:col-span-1) */}
        <div className="space-y-3.5">
          <TicketClientCard ticket={ticket} recipientEmail={recipientEmail} />
          <TicketSlaCard ticket={ticket} sla={sla} />
          <TicketActivityCard
            messagesCount={messagesCount}
            tasksCount={tasksCount}
            notesCount={notesCount}
            timelineCount={timelineCount}
            onOpenConversation={onOpenConversation}
            onOpenTasks={onOpenTasks}
            onOpenNotes={onOpenNotes}
            onShowTimeline={onShowTimeline}
          />
        </div>
      </div>
    </div>
  );
}
