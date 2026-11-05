import { ComposerSendSuccessLayer } from "../../bandeja/ComposerSendSuccessLayer";
import { ticketUpdateCelebrationCopy } from "./ticketNotifyClient";
import type { UpdateCategory } from "./ticketTransitions";

const CELEBRATION_MS = 3200;

interface TicketStatusUpdateCelebrationProps {
  category: UpdateCategory | undefined;
  recipientEmail: string | null;
  ticketSubject?: string | null;
  notifyClient: boolean;
  verdictAttachmentsCount: number;
  exiting?: boolean;
}

/** Confirmación cinética al cerrar el flujo Actualizar ticket (misma gramática que envío en bandeja). */
export function TicketStatusUpdateCelebration({
  category,
  recipientEmail,
  ticketSubject,
  notifyClient,
  verdictAttachmentsCount,
  exiting = false,
}: TicketStatusUpdateCelebrationProps) {
  const copy = ticketUpdateCelebrationCopy(category, {
    verdictAttachmentsCount,
    notifyClient,
    recipientEmail,
    ticketSubject,
  });

  const layerDetail =
    notifyClient && recipientEmail
      ? recipientEmail
      : copy.detail;

  return (
    <ComposerSendSuccessLayer
      fillPanel
      exiting={exiting}
      title={copy.title}
      detail={layerDetail}
      subject={copy.subject}
      attachmentsCount={category === "veredicto" ? verdictAttachmentsCount : undefined}
      showProgress={!exiting}
      progressDurationMs={CELEBRATION_MS}
      kind="compose"
    />
  );
}

export const TICKET_UPDATE_CELEBRATION_MS = CELEBRATION_MS;
