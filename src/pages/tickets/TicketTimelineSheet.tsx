import { AlertTriangle, Check, Lock, Mail, User, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { FilterChip } from "../../components/ui/FilterChip";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { formatDateTime } from "../../lib/format";
import type {
  TicketAttachmentResponse,
  TicketDetailResponse,
  TicketEventResponse,
  TicketMessageResponse,
} from "../../types/api";
import { FormattedTicketBody } from "./FormattedTicketBody";
import { AttachmentChip } from "./TicketMessageCard";
import { originLabel } from "./ticketOrigin";

export type TimelineItem =
  | { kind: "message"; data: TicketMessageResponse; createdAt: string }
  | { kind: "event"; data: TicketEventResponse; createdAt: string };

export type TicketDetailTab = "conversacion" | "notas";

type TimelineFilter = "all" | "messages" | "events";

export interface TicketTimelineSheetProps {
  ticket: TicketDetailResponse;
  timeline: TimelineItem[];
  /** Abre el visor; desde ahi se decide si ademas se descarga. */
  onOpenAttachment: (attachments: TicketAttachmentResponse[], attachmentId: number) => void;
  onClose: () => void;
  onSelectTab?: (tab: TicketDetailTab) => void;
  initialFilter?: TimelineFilter;
}

/** Cronologia completa del ticket, mensajes y eventos entrelazados, en un cajon lateral. */
export function TicketTimelineSheet({
  ticket,
  timeline,
  onOpenAttachment,
  onClose,
  onSelectTab,
  initialFilter = "all",
}: TicketTimelineSheetProps) {
  const { isExiting, requestClose } = useModalAnimation(onClose, 220);
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [filter, setFilter] = useState<TimelineFilter>(initialFilter);

  useEffect(() => {
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isExiting) requestClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isExiting, requestClose]);

  const messageCount = timeline.filter((item) => item.kind === "message").length;
  const eventCount = timeline.length - messageCount;
  const filtered = timeline.filter((item) =>
    filter === "messages" ? item.kind === "message" : filter === "events" ? item.kind === "event" : true,
  );
  const origin = originLabel(ticket.channel);

  function renderEvent(event: TicketEventResponse, index: number) {
    const isBreach =
      event.eventType === "SlaBreached" || Boolean(event.details?.toLowerCase().includes("incumplimiento de sla"));

    return (
      <li key={`evt-${event.id}-${index}`} className="relative pb-5 pl-8 last:pb-0">
        <span
          aria-hidden
          className={`absolute left-0 top-0 flex h-[18px] w-[18px] items-center justify-center rounded-full ring-4 ring-white ${
            isBreach ? "bg-brand-red text-white" : "bg-line-strong text-brand-gray"
          }`}
        >
          {isBreach ? <AlertTriangle className="h-2.5 w-2.5" /> : <Check className="h-2.5 w-2.5" strokeWidth={3} />}
        </span>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[12.5px] font-medium text-ink">{event.actorStaffName ?? "Sistema"}</span>
          <time dateTime={event.createdAt} className="shrink-0 text-[11px] tabular-nums text-subtle">
            {formatDateTime(event.createdAt)}
          </time>
        </div>
        <p className={`mt-0.5 text-[12px] ${isBreach ? "font-medium text-brand-red-dark" : "text-subtle"}`}>
          {event.details ?? event.eventType}
        </p>
      </li>
    );
  }

  function renderMessage(message: TicketMessageResponse) {
    const direction = message.direction.toLowerCase();
    const isInternal = direction === "interna";
    const isOutbound = direction === "saliente";
    const author = message.authorStaffName ?? message.authorContactName ?? ticket.requesterName ?? "Remitente";
    const role = isInternal ? "Nota interna" : isOutbound ? "Respuesta" : "Cliente";
    const Icon = isInternal ? Lock : isOutbound ? Mail : User;
    const dotClass = isInternal ? "bg-warn" : isOutbound ? "bg-ink" : "bg-brand-gray";

    return (
      <li key={`msg-${message.id}`} className="relative pb-5 pl-8 last:pb-0">
        <span
          aria-hidden
          className={`absolute left-0 top-0 flex h-[18px] w-[18px] items-center justify-center rounded-full text-white ring-4 ring-white ${dotClass}`}
        >
          <Icon className="h-2.5 w-2.5" />
        </span>
        <div
          className={`rounded-edge border p-3 ${
            isInternal ? "border-warn/30 bg-warn/[0.045]" : isOutbound ? "border-line bg-white" : "border-line bg-canvas/60"
          }`}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[12.5px] font-semibold text-ink">{author}</span>
            <time dateTime={message.createdAt} className="shrink-0 text-[11px] tabular-nums text-subtle">
              {formatDateTime(message.createdAt)}
            </time>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-subtle">
            {role}
            {/* En una lista cronologica el primero se confunde con uno mas: aqui se nombra. */}
            {message.isOrigin && (
              <span title={`${origin.hint} ${formatDateTime(message.createdAt)}`}>
                <Badge>{origin.label}</Badge>
              </span>
            )}
          </div>
          <div className="mt-2 text-[12.5px] leading-relaxed text-ink">
            <FormattedTicketBody text={message.bodyText} html={message.bodyHtml} />
          </div>
          {message.attachments.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-line/70 pt-2.5">
              {message.attachments.map((attachment) => (
                <AttachmentChip
                  key={attachment.id}
                  attachment={attachment}
                  onOpen={() => onOpenAttachment(message.attachments, attachment.id)}
                />
              ))}
            </div>
          )}
        </div>
      </li>
    );
  }

  return createPortal(
    <div
      inert={isExiting ? true : undefined}
      className={`fixed inset-0 z-50 flex justify-end bg-ink/45 backdrop-blur-[2px] ${
        isExiting ? "animate-plf-scrim-out pointer-events-none" : "animate-plf-scrim-in"
      }`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isExiting) requestClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex h-full w-full flex-col bg-white shadow-[0_4px_32px_rgba(27,27,29,0.22)] sm:w-[560px] ${
          isExiting ? "animate-plf-drawer-out pointer-events-none" : "animate-plf-drawer-in"
        }`}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="font-heading text-[17px] font-bold tracking-[-0.01em] text-ink">
              Historial
            </h2>
            <p className="mt-0.5 text-[12px] tabular-nums text-subtle">
              {ticket.number} · {timeline.length} {timeline.length === 1 ? "registro" : "registros"}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={requestClose}
            aria-label="Cerrar el historial (Esc)"
            title="Cerrar (Esc)"
            className="-mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-edge text-subtle outline-none
              transition-colors hover:bg-fill hover:text-ink focus-visible:ring-3 focus-visible:ring-brand-red/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-line px-6 py-2.5">
          <FilterChip label="Todos" count={timeline.length} active={filter === "all"} onClick={() => setFilter("all")} />
          <FilterChip
            label="Mensajes"
            count={messageCount}
            active={filter === "messages"}
            onClick={() => setFilter("messages")}
          />
          <FilterChip label="Eventos" count={eventCount} active={filter === "events"} onClick={() => setFilter("events")} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-[12.5px] text-faint">No hay registros de este tipo.</p>
          ) : (
            <ol className="relative">
              <span aria-hidden className="absolute bottom-2 left-[8.5px] top-2 w-px bg-line" />
              {filtered.map((item, index) =>
                item.kind === "event" ? renderEvent(item.data, index) : renderMessage(item.data),
              )}
            </ol>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line px-6 py-3">
          <span className="text-[11.5px] text-subtle">
            <kbd className="rounded-edge border border-line-strong bg-white px-1.5 py-0.5 font-heading text-[10px] font-semibold text-ink">
              Esc
            </kbd>{" "}
            para cerrar
          </span>
          <div className="flex items-center gap-2">
            {onSelectTab && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  requestClose();
                  onSelectTab("conversacion");
                }}
              >
                Ir a la conversación
              </Button>
            )}
            <Button type="button" size="sm" onClick={requestClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
