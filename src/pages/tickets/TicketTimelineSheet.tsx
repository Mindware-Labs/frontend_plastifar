import {
  AlertTriangle,
  CheckCircle2,
  Download,
  History,
  Lock,
  Mail,
  Paperclip,
  User,
  X,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "../../components/ui/Button";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { formatDateTime } from "../../lib/format";
import type {
  TicketAttachmentResponse,
  TicketDetailResponse,
  TicketEventResponse,
  TicketMessageResponse,
} from "../../types/api";

export type TimelineItem =
  | { kind: "message"; data: TicketMessageResponse; createdAt: string }
  | { kind: "event"; data: TicketEventResponse; createdAt: string };

export interface TicketTimelineSheetProps {
  ticket: TicketDetailResponse;
  timeline: TimelineItem[];
  sortedMessages: TicketMessageResponse[];
  downloadingId: number | null;
  onDownloadAttachment: (att: TicketAttachmentResponse) => void;
  onClose: () => void;
  onSelectTab?: (tab: "general" | "respuestas" | "notas") => void;
}

export function TicketTimelineSheet({
  ticket,
  timeline,
  sortedMessages,
  downloadingId,
  onDownloadAttachment,
  onClose,
  onSelectTab,
}: TicketTimelineSheetProps) {
  // Coordinar animación suave de entrada y salida sincronizada con index.css (220ms)
  const { isExiting, requestClose } = useModalAnimation(onClose, 220);
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [filter, setFilter] = useState<"all" | "messages" | "events">("all");

  // Bloqueo de scroll de fondo y atajo de teclado Escape
  useEffect(() => {
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isExiting) {
        requestClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isExiting, requestClose]);

  const filteredTimeline = timeline.filter((item) => {
    if (filter === "messages") return item.kind === "message";
    if (filter === "events") return item.kind === "event";
    return true;
  });

  function renderTimelineEvent(evt: TicketEventResponse, idx: number) {
    const isBreach =
      evt.eventType === "SlaBreached" ||
      Boolean(evt.details?.toLowerCase().includes("incumplimiento de sla"));
    return (
      <div key={`tl-evt-${evt.id}-${idx}`} className="relative pb-5 pl-7 last:pb-0">
        <span
          className={`absolute left-0 top-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white ${
            isBreach ? "bg-red-600" : "bg-zinc-400"
          }`}
        >
          {isBreach ? (
            <AlertTriangle className="h-2.5 w-2.5 text-white" />
          ) : (
            <CheckCircle2 className="h-2.5 w-2.5 text-white" />
          )}
        </span>
        <div
          className={`rounded-lg border px-3 py-2 text-[11px] ${
            isBreach ? "border-red-200 bg-red-50" : "border-line-soft bg-canvas/50"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className={`font-medium ${isBreach ? "text-red-900" : "text-ink"}`}>
              {evt.actorStaffName ?? "Sistema"}
            </span>
            <span className="shrink-0 text-[10px] text-subtle">{formatDateTime(evt.createdAt)}</span>
          </div>
          <p className={`mt-0.5 ${isBreach ? "font-medium text-red-700" : "text-subtle"}`}>
            {evt.details ?? evt.eventType}
          </p>
        </div>
      </div>
    );
  }

  function renderTimelineMessage(msg: TicketMessageResponse) {
    const isInternal = msg.direction.toLowerCase() === "interna";
    const isOutbound = msg.direction.toLowerCase() === "saliente";
    const dotColor = isInternal ? "bg-amber-500" : isOutbound ? "bg-sky-600" : "bg-slate-700";

    return (
      <div key={`tl-msg-${msg.id}`} className="relative pb-5 pl-7 last:pb-0">
        <span
          className={`absolute left-0 top-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white ${dotColor}`}
        >
          {isInternal ? (
            <Lock className="h-2.5 w-2.5 text-white" />
          ) : isOutbound ? (
            <Mail className="h-2.5 w-2.5 text-white" />
          ) : (
            <User className="h-2.5 w-2.5 text-white" />
          )}
        </span>
        <div
          className={`rounded-lg border p-3 text-xs ${
            isInternal
              ? "border-amber-200 bg-amber-50/60"
              : isOutbound
              ? "border-line-soft bg-white"
              : "border-slate-200 bg-slate-50/80"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-semibold text-ink">
              {msg.authorStaffName ?? msg.authorContactName ?? ticket.requesterName ?? "Remitente"}
            </span>
            <span className="shrink-0 text-[10px] text-subtle">{formatDateTime(msg.createdAt)}</span>
          </div>
          <span
            className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white ${dotColor}`}
          >
            {isInternal ? "Nota interna" : isOutbound ? "Respuesta" : "Cliente"}
          </span>
          <p className="mt-2 whitespace-pre-wrap text-[11.5px] leading-relaxed text-ink">
            {msg.bodyText ?? msg.bodyHtml?.replace(/<[^>]*>?/gm, "")}
          </p>
          {msg.attachments && msg.attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line-soft/60 pt-2 text-[10.5px] text-subtle">
              {msg.attachments.map((att) => (
                <button
                  key={att.id}
                  type="button"
                  onClick={() => onDownloadAttachment(att)}
                  disabled={downloadingId === att.id}
                  className="inline-flex items-center gap-1.5 rounded border border-line-soft bg-white px-2 py-0.5 text-ink transition-colors hover:bg-slate-50"
                  title="Descargar adjunto"
                >
                  <Paperclip className="h-3 w-3 text-subtle" />
                  <span className="max-w-[140px] truncate">{att.fileName}</span>
                  <Download className="h-2.5 w-2.5 text-subtle" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return createPortal(
    <div
      inert={isExiting ? true : undefined}
      className={`fixed inset-0 z-50 flex justify-end bg-ink/45 backdrop-blur-[2px] transition-opacity ${
        isExiting ? "animate-plf-scrim-out pointer-events-none" : "animate-plf-scrim-in"
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isExiting) requestClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex h-full w-full flex-col bg-white shadow-[0_4px_32px_rgba(27,27,29,0.22)] sm:w-[540px] md:w-[600px] ${
          isExiting ? "animate-plf-drawer-out pointer-events-none" : "animate-plf-drawer-in"
        }`}
      >
        {/* Cabecera del Drawer */}
        <div className="flex shrink-0 items-center justify-between border-b border-line bg-slate-50/70 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-red/10 text-brand-red">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h2 id={titleId} className="font-heading text-sm font-bold text-ink">
                Historial de conversación y eventos
              </h2>
              <p className="text-[11.5px] text-subtle">
                {ticket.number} · {timeline.length} registro{timeline.length === 1 ? "" : "s"} cronológico{timeline.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={requestClose}
            className="cursor-pointer rounded-lg p-1.5 text-subtle transition-colors hover:bg-slate-200/60 hover:text-ink"
            title="Cerrar pestaña de historial (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filtros rápidos: Todos | Mensajes | Eventos */}
        <div className="flex shrink-0 items-center gap-1.5 border-b border-line bg-canvas/40 px-6 py-2.5 text-xs">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`cursor-pointer rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition-all ${
              filter === "all"
                ? "border border-line-soft bg-white text-ink shadow-2xs"
                : "text-subtle hover:text-ink"
            }`}
          >
            Todos ({timeline.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("messages")}
            className={`cursor-pointer rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition-all ${
              filter === "messages"
                ? "border border-line-soft bg-white text-ink shadow-2xs"
                : "text-subtle hover:text-ink"
            }`}
          >
            Mensajes ({sortedMessages.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("events")}
            className={`cursor-pointer rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition-all ${
              filter === "events"
                ? "border border-line-soft bg-white text-ink shadow-2xs"
                : "text-subtle hover:text-ink"
            }`}
          >
            Eventos ({ticket.events?.length ?? 0})
          </button>
        </div>

        {/* Lista cronológica scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {filteredTimeline.length === 0 ? (
            <div className="rounded-edge border border-dashed border-line-strong bg-canvas/40 p-8 text-center text-xs text-subtle">
              No hay registros en esta categoría.
            </div>
          ) : (
            <div className="relative">
              <div className="absolute bottom-1 left-[7px] top-1 w-px bg-line-soft" />
              {filteredTimeline.map((item, idx) =>
                item.kind === "event"
                  ? renderTimelineEvent(item.data, idx)
                  : renderTimelineMessage(item.data),
              )}
            </div>
          )}
        </div>

        {/* Pie del Drawer con atajo Esc y botones */}
        <div className="flex shrink-0 items-center justify-between border-t border-line bg-slate-50/80 px-6 py-3">
          <span className="text-[11px] text-subtle">
            Presiona <kbd className="rounded border border-line-strong bg-white px-1.5 py-0.5 text-[10px] font-semibold text-ink">Esc</kbd> para salir
          </span>
          <div className="flex items-center gap-2">
            {onSelectTab && (
              <button
                type="button"
                onClick={() => {
                  requestClose();
                  onSelectTab("respuestas");
                }}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-line-soft bg-white px-3 py-1.5 text-xs font-semibold text-brand-red shadow-2xs hover:bg-red-50"
              >
                <Mail className="h-3.5 w-3.5" />
                Responder al cliente
              </button>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={requestClose}
            >
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
