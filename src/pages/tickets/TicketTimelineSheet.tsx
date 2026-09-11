import { AlertTriangle, Check, History, Lock, Mail, Ticket as TicketIcon, User, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { FilterChip } from "../../components/ui/FilterChip";
import { useDialogMotion } from "../../hooks/useDialogMotion";
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
  const { isExiting, requestClose, scrimRef, panelRef } = useDialogMotion(onClose, { variant: "drawer" });
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
      <li key={`evt-${event.id}-${index}`} className="relative pb-5 pl-9 last:pb-0">
        <span
          aria-hidden
          className={`absolute left-0 top-0 flex size-5 items-center justify-center rounded-md ring-4 ring-white ${
            isBreach ? "bg-brand-red text-white" : "bg-zinc-100 text-zinc-500"
          }`}
        >
          {isBreach ? (
            <AlertTriangle className="size-3" strokeWidth={2.5} />
          ) : (
            <Check className="size-3" strokeWidth={3} />
          )}
        </span>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[12.5px] font-medium text-ink">{event.actorStaffName ?? "Sistema"}</span>
          <time
            dateTime={event.createdAt}
            className="shrink-0 font-heading text-[10px] font-bold tabular-nums text-zinc-400"
          >
            {formatDateTime(event.createdAt)}
          </time>
        </div>
        <p className={`mt-0.5 text-[12px] leading-relaxed ${isBreach ? "font-medium text-brand-red-dark" : "text-zinc-500"}`}>
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
    // Nosotros en tinta, el cliente en gris, lo interno en ámbar: se distingue también sin leer.
    const sealClass = isInternal
      ? "bg-amber-100 text-amber-700"
      : isOutbound
        ? "bg-zinc-900 text-white"
        : "bg-zinc-100 text-zinc-500";
    const roleClass = isInternal ? "bg-amber-200/70 text-amber-900" : "bg-zinc-100 text-zinc-600";

    return (
      <li key={`msg-${message.id}`} className="relative pb-5 pl-9 last:pb-0">
        <span
          aria-hidden
          className={`absolute left-0 top-0 flex size-5 items-center justify-center rounded-md ring-4 ring-white ${sealClass}`}
        >
          <Icon className="size-3" strokeWidth={2.25} />
        </span>
        <div
          className={`rounded-lg border p-3 shadow-2xs ${
            isInternal ? "border-amber-200/80 bg-amber-50/30" : "border-zinc-200 bg-white"
          }`}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[12.5px] font-semibold text-ink">{author}</span>
            <time
              dateTime={message.createdAt}
              className="shrink-0 font-heading text-[10px] font-bold tabular-nums text-zinc-400"
            >
              {formatDateTime(message.createdAt)}
            </time>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center rounded-md px-1.5 py-0.5 font-heading text-[9.5px] font-bold uppercase leading-none tracking-[0.06em] ${roleClass}`}
            >
              {role}
            </span>
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
            <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-zinc-100 pt-2.5">
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
      ref={scrimRef}
      inert={isExiting ? true : undefined}
      className={`fixed inset-0 z-50 flex justify-end bg-ink/45 backdrop-blur-[2px] ${
        isExiting ? "pointer-events-none" : ""
      }`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isExiting) requestClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex h-full w-full flex-col bg-white shadow-[0_4px_32px_rgba(27,27,29,0.22)] sm:w-[560px] ${
          isExiting ? "pointer-events-none" : ""
        }`}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <p className="font-heading text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400">
              Tickets · Cronología
            </p>
            <h2 id={titleId} className="mt-1 font-heading text-[17px] font-bold tracking-[-0.01em] text-ink">
              Historial
            </h2>
            <p className="mt-1 flex items-center gap-2 text-[12px] text-zinc-500">
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="flex size-4 shrink-0 items-center justify-center rounded-[5px] bg-brand-red/10 text-brand-red"
                >
                  <TicketIcon className="size-2.5" strokeWidth={2.25} />
                </span>
                <span className="font-heading text-[11px] font-bold tabular-nums text-zinc-900">{ticket.number}</span>
              </span>
              <span aria-hidden className="text-zinc-300">·</span>
              <span className="tabular-nums">
                {timeline.length} {timeline.length === 1 ? "registro" : "registros"}
              </span>
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={requestClose}
            aria-label="Cerrar el historial (Esc)"
            title="Cerrar (Esc)"
            className="-mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-subtle outline-none
              transition-colors hover:bg-fill hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-red/25"
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
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <span
                aria-hidden
                className="flex size-9 items-center justify-center rounded-lg bg-brand-red/10 text-brand-red"
              >
                <History className="size-4" strokeWidth={2.25} />
              </span>
              <p className="text-[13px] font-medium text-zinc-700">No hay registros de este tipo.</p>
            </div>
          ) : (
            <ol className="relative">
              <span aria-hidden className="absolute bottom-2 left-[9.5px] top-2 w-px bg-zinc-200" />
              {filtered.map((item, index) =>
                item.kind === "event" ? renderEvent(item.data, index) : renderMessage(item.data),
              )}
            </ol>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line bg-white px-6 py-3">
          <span className="inline-flex items-center gap-1.5 text-[11.5px] text-zinc-400">
            <kbd className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-zinc-600">
              Esc
            </kbd>
            <span>para cerrar</span>
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
