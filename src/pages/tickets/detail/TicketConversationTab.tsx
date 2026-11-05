import { CornerUpLeft, Mail } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import type { TicketAttachmentResponse, TicketDetailResponse } from "../../../types/api";
import { TicketThread } from "./TicketThread";

interface TicketConversationTabProps {
  ticket: TicketDetailResponse;
  clientThread: TicketDetailResponse["messages"];
  recipientEmail: string | null;
  onReply: () => void;
  onOpenAttachment: (attachments: TicketAttachmentResponse[], attachmentId: number) => void;
}

/** TAB: CONVERSACIÓN. */
export function TicketConversationTab({
  ticket,
  clientThread,
  recipientEmail,
  onReply,
  onOpenAttachment,
}: TicketConversationTabProps) {
  return (
    <div className="space-y-2.5">
      {/* La accion encabeza el hilo; el editor se pide, no esta siempre puesto. */}
      <div className="flex items-center gap-3">
        <span className="shrink-0 font-heading text-[10px] font-bold uppercase tracking-[0.08em] tabular-nums text-zinc-400">
          {clientThread.length} {clientThread.length === 1 ? "mensaje" : "mensajes"}
        </span>
        <span aria-hidden className="h-px flex-1 bg-zinc-200/70" />
        <Button
          type="button"
          size="sm"
          onClick={onReply}
          disabled={!recipientEmail}
          title={recipientEmail ? undefined : "Sin correo de contacto no se puede enviar la respuesta."}
        >
          <CornerUpLeft className="h-[14px] w-[14px]" />
          Responder
        </Button>
      </div>

      {clientThread.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50 px-6 py-8 text-center">
          <div className="mx-auto flex size-9 items-center justify-center rounded-lg bg-brand-red/10 text-brand-red">
            <Mail className="size-4" strokeWidth={2.25} />
          </div>
          <p className="mt-2.5 font-heading text-[14px] font-semibold text-zinc-800">
            Todavía no hay conversación
          </p>
          <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-zinc-500">
            Ni el cliente ha escrito ni se le ha respondido. Lo que envíes desde aquí le llegará por correo y
            quedará registrado en este hilo.
          </p>
        </div>
      ) : (
        <TicketThread
          messages={clientThread}
          channel={ticket.channel}
          requesterName={ticket.requesterName}
          onOpenAttachment={onOpenAttachment}
        />
      )}
    </div>
  );
}
