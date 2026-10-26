import { History } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { DetailCard } from "../../../components/ui/DetailCard";
import { ACTIVITY_CARD_ID } from "./ticketDetailShared";

interface TicketActivityCardProps {
  messagesCount: number;
  tasksCount: number;
  notesCount: number;
  timelineCount: number;
  onOpenConversation: () => void;
  onOpenTasks: () => void;
  onOpenNotes: () => void;
  onShowTimeline: () => void;
}

/** Card: Resumen de actividad e hitos. */
export function TicketActivityCard({
  messagesCount,
  tasksCount,
  notesCount,
  timelineCount,
  onOpenConversation,
  onOpenTasks,
  onOpenNotes,
  onShowTimeline,
}: TicketActivityCardProps) {
  return (
    <DetailCard id={ACTIVITY_CARD_ID} icon={History} title="Resumen de Actividad">
      <div className="p-3.5 space-y-2.5">
        <div className="grid grid-cols-3 gap-2 text-center">
          <button
            type="button"
            onClick={onOpenConversation}
            className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-2 text-left hover:border-zinc-300 hover:bg-zinc-100/70 transition-colors cursor-pointer group"
          >
            <span className="text-[10px] font-heading font-semibold uppercase tracking-wider text-zinc-400 group-hover:text-zinc-600 block">
              Mensajes
            </span>
            <span className="font-heading text-[16px] font-bold text-zinc-900 tabular-nums">
              {messagesCount}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenTasks}
            className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-2 text-left hover:border-zinc-300 hover:bg-zinc-100/70 transition-colors cursor-pointer group"
          >
            <span className="text-[10px] font-heading font-semibold uppercase tracking-wider text-zinc-400 group-hover:text-zinc-600 block">
              Tareas
            </span>
            <span className="font-heading text-[16px] font-bold text-zinc-900 tabular-nums">
              {tasksCount}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenNotes}
            className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-2 text-left hover:border-zinc-300 hover:bg-zinc-100/70 transition-colors cursor-pointer group"
          >
            <span className="text-[10px] font-heading font-semibold uppercase tracking-wider text-zinc-400 group-hover:text-zinc-600 block">
              Notas
            </span>
            <span className="font-heading text-[16px] font-bold text-zinc-900 tabular-nums">
              {notesCount}
            </span>
          </button>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onShowTimeline}
          className="w-full justify-center"
        >
          <History className="size-3.5" />
          <span>Ver historial de eventos ({timelineCount})</span>
        </Button>
      </div>
    </DetailCard>
  );
}
