import { Lock, Plus } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import type { TicketAttachmentResponse, TicketDetailResponse } from "../../../types/api";
import { TicketThread } from "./TicketThread";

interface TicketNotesTabProps {
  ticket: TicketDetailResponse;
  internalNotes: TicketDetailResponse["messages"];
  onAddNote: () => void;
  onOpenAttachment: (attachments: TicketAttachmentResponse[], attachmentId: number) => void;
}

/** TAB: NOTAS INTERNAS. */
export function TicketNotesTab({ ticket, internalNotes, onAddNote, onOpenAttachment }: TicketNotesTabProps) {
  return (
    <div className="space-y-2.5">
      {internalNotes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-amber-200/80 bg-amber-50/20 px-6 py-8 text-center">
          <div className="mx-auto flex size-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <Lock className="size-4" strokeWidth={2.25} />
          </div>
          <p className="mt-2.5 font-heading text-[14px] font-semibold text-zinc-800">
            Nada anotado todavía
          </p>
          <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-zinc-500">
            Aquí queda lo que el equipo necesita saber y el cliente no: cómo fue la llamada, qué se intentó
            ya, con quién quedó pendiente. Nunca sale por correo.
          </p>
          <Button type="button" size="sm" onClick={onAddNote} className="mt-4">
            <Plus className="h-[14px] w-[14px]" />
            Añadir nota
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 font-heading text-[10px] font-bold uppercase tracking-[0.08em] tabular-nums text-zinc-400">
              <Lock className="h-3 w-3 text-amber-600" />
              <span>{internalNotes.length} {internalNotes.length === 1 ? "nota interna" : "notas internas"}</span>
            </div>
            <span aria-hidden className="h-px flex-1 bg-zinc-200/70" />
            <Button type="button" size="sm" onClick={onAddNote}>
              <Plus className="h-[14px] w-[14px]" />
              Añadir nota
            </Button>
          </div>
          <TicketThread
            messages={internalNotes}
            channel={ticket.channel}
            requesterName={ticket.requesterName}
            onOpenAttachment={onOpenAttachment}
          />
        </>
      )}
    </div>
  );
}
