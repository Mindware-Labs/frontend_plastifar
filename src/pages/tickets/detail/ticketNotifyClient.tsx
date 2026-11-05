import type { ReactNode } from "react";
import type { UpdateCategory } from "./ticketTransitions";

/** Asunto del hilo de correo al responder o notificar (misma regla que TicketReplySender). */
export function buildTicketReplySubject(subject: string | null | undefined): string | undefined {
  const trimmed = subject?.trim();
  if (!trimmed) return undefined;
  return trimmed.toLowerCase().startsWith("re:") ? trimmed : `Re: ${trimmed}`;
}

export function NotifyClientCheckboxDescription({
  recipientEmail,
  ticketSubject,
}: {
  recipientEmail: string | null;
  ticketSubject?: string | null;
}): ReactNode {
  if (!recipientEmail) {
    return "Este ticket no tiene un correo de contacto registrado.";
  }

  const replySubject = buildTicketReplySubject(ticketSubject);

  return (
    <span className="text-zinc-600">
      Se enviará a <span className="font-medium text-zinc-900">{recipientEmail}</span>
      {replySubject ? (
        <>
          {" "}
          con asunto <span className="font-semibold text-zinc-900">{replySubject}</span>
        </>
      ) : null}
      .
    </span>
  );
}

export function ticketUpdateCelebrationCopy(
  category: UpdateCategory | undefined,
  options: {
    verdictAttachmentsCount: number;
    notifyClient: boolean;
    recipientEmail: string | null;
    ticketSubject?: string | null;
  },
): { title: string; detail: string; subject?: string } {
  const { verdictAttachmentsCount, notifyClient, recipientEmail, ticketSubject } = options;

  if (category === "veredicto") {
    const attachmentNote =
      verdictAttachmentsCount > 0
        ? `Se registró el veredicto con ${verdictAttachmentsCount} ${
            verdictAttachmentsCount === 1 ? "archivo adjunto" : "archivos adjuntos"
          }.`
        : "El veredicto quedó registrado en el historial del ticket.";

    return {
      title: "El ticket se completó correctamente",
      detail: notifyClient && recipientEmail
        ? `Aviso enviado a ${recipientEmail}. ${attachmentNote}`
        : attachmentNote,
      subject: notifyClient ? buildTicketReplySubject(ticketSubject) : undefined,
    };
  }

  if (category === "pausar") {
    return {
      title: "El ticket ha sido pausado",
      detail: "El cómputo de SLA quedó pausado mientras se espera al cliente.",
    };
  }

  if (category === "cancelar") {
    return {
      title: "El ticket ha sido cancelado",
      detail: notifyClient && recipientEmail
        ? `Se notificó la cancelación a ${recipientEmail}.`
        : "El ticket fue anulado y registrado en el historial.",
      subject: notifyClient ? buildTicketReplySubject(ticketSubject) : undefined,
    };
  }

  return {
    title: "El ticket se actualizó correctamente",
    detail: "Los cambios ya están visibles en el detalle del ticket.",
  };
}
