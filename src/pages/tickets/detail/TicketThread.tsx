import type { TicketAttachmentResponse, TicketDetailResponse } from "../../../types/api";
import { TicketMessageCard } from "../TicketMessageCard";

interface TicketThreadProps {
  messages: TicketDetailResponse["messages"];
  channel: TicketDetailResponse["channel"];
  requesterName: TicketDetailResponse["requesterName"];
  onOpenAttachment: (attachments: TicketAttachmentResponse[], attachmentId: number) => void;
}

/** Hilo de mensajes en orden; el ultimo se marca como el mas reciente si hay mas de uno. */
export function TicketThread({ messages, channel, requesterName, onOpenAttachment }: TicketThreadProps) {
  return messages.map((message, index) => (
    <TicketMessageCard
      key={message.id}
      message={message}
      channel={channel}
      requesterName={requesterName}
      isLatest={messages.length > 1 && index === messages.length - 1}
      onOpenAttachment={onOpenAttachment}
    />
  ));
}
