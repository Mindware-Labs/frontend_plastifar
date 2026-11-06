import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CornerUpLeft,
  History,
  Lock,
  Mail,
  Plus,
  RotateCcw,
  Send,
  Tag,
  User,
  UserCheck,
  Workflow,
  X,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { dialogHeaderShellClass, dialogHeaderStackClass } from "../../components/ui/dialogHeaderStyles";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { SegmentedFilter } from "../../components/ui/SegmentedFilter";
import { useDialogMotion } from "../../hooks/useDialogMotion";
import { openOverlay } from "../../hooks/overlayStack";
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
import { PriorityCell, StatusCell } from "./ticketCells";

export type TimelineItem =
  | { kind: "message"; data: TicketMessageResponse; createdAt: string }
  | { kind: "event"; data: TicketEventResponse; createdAt: string };

export type TicketDetailTab = "datos" | "conversacion" | "tareas" | "notas" | "formularios" | "reclamacion";

type TimelineFilter = "all" | "messages" | "events";
type TimelineSortOrder = "asc" | "desc";

export interface TicketTimelineSheetProps {
  ticket: TicketDetailResponse;
  timeline: TimelineItem[];
  /** Abre el visor; desde ahí se decide si además se descarga. */
  onOpenAttachment: (attachments: TicketAttachmentResponse[], attachmentId: number) => void;
  onClose: () => void;
  onSelectTab?: (tab: TicketDetailTab) => void;
  initialFilter?: TimelineFilter;
}

function getDayKey(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "unknown";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDayHeader(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Fecha desconocida";
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const formatted = d.toLocaleDateString("es-419", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });

  const capitalized = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  if (isToday) return `Hoy · ${capitalized}`;
  if (isYesterday) return `Ayer · ${capitalized}`;
  return capitalized;
}

function formatTimeOnly(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("es-419", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Cronología editorial completa del ticket, con simetría visual y narrativa de origen clara. */
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
  const [sortOrder, setSortOrder] = useState<TimelineSortOrder>("asc");
  const [copiedNumber, setCopiedNumber] = useState(false);

  useEffect(() => {
    const overlay = openOverlay();
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isExiting && overlay.isTop()) requestClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      overlay.close();
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isExiting, requestClose]);

  const origin = originLabel(ticket.channel);

  // Estadísticas globales del historial
  const messageCount = useMemo(() => timeline.filter((item) => item.kind === "message").length, [timeline]);
  const eventCount = timeline.length - messageCount;
  const internalNotesCount = useMemo(
    () => timeline.filter((item) => item.kind === "message" && item.data.direction.toLowerCase() === "interna").length,
    [timeline],
  );

  // 1. Asignar orden cronológico inmutable (paso #1, #2, #3...) independientemente de cómo se ordene la vista
  const chronologicallyIndexed = useMemo(() => {
    const sorted = [...timeline].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    return sorted.map((item, index) => ({
      ...item,
      stepNumber: index + 1,
    }));
  }, [timeline]);

  // 2. Filtrar según la pestaña seleccionada
  const filtered = useMemo(() => {
    return chronologicallyIndexed.filter((item) => {
      if (filter === "messages") return item.kind === "message";
      if (filter === "events") return item.kind === "event";
      return true;
    });
  }, [chronologicallyIndexed, filter]);

  // 3. Ordenar según la dirección seleccionada (cronológico 'asc' o reciente primero 'desc')
  const sortedItems = useMemo(() => {
    if (sortOrder === "asc") return filtered;
    return [...filtered].reverse();
  }, [filtered, sortOrder]);

  // 4. Agrupar por bloques de día para lectura editorial
  const groupedByDay = useMemo(() => {
    const groups: { dayKey: string; dayLabel: string; items: typeof sortedItems }[] = [];
    let currentKey = "";
    let currentGroup: (typeof sortedItems)[number][] = [];

    for (const item of sortedItems) {
      const key = getDayKey(item.createdAt);
      if (key !== currentKey) {
        if (currentGroup.length > 0) {
          groups.push({
            dayKey: currentKey,
            dayLabel: formatDayHeader(currentGroup[0].createdAt),
            items: currentGroup,
          });
        }
        currentKey = key;
        currentGroup = [item];
      } else {
        currentGroup.push(item);
      }
    }

    if (currentGroup.length > 0) {
      groups.push({
        dayKey: currentKey,
        dayLabel: formatDayHeader(currentGroup[0].createdAt),
        items: currentGroup,
      });
    }

    return groups;
  }, [sortedItems]);

  const handleCopyTicketNumber = () => {
    if (!ticket.number) return;
    void navigator.clipboard.writeText(ticket.number);
    setCopiedNumber(true);
    setTimeout(() => setCopiedNumber(false), 1600);
  };

  /** Renderiza un evento del sistema dentro de la arquitectura simétrica. */
  function renderEventItem(event: TicketEventResponse, stepNumber: number) {
    const isBreach =
      event.eventType === "SlaBreached" || Boolean(event.details?.toLowerCase().includes("incumplimiento de sla"));
    const isWarning = event.eventType === "SlaWarning";
    const isStatusChange = event.eventType === "StatusChanged";
    const isAssign = event.eventType === "Assigned" || event.eventType === "Reassigned";
    const isPriority = event.eventType === "PriorityChanged";
    const isCreated = event.eventType === "Created";
    const isClosed = event.eventType === "Closed";
    const isReopened = event.eventType === "Reopened";
    const isTask = event.eventType === "TaskCreated" || event.eventType === "TaskCompleted" || event.eventType === "TaskUpdated";

    let nodeStyle = "border-zinc-300 bg-zinc-50 text-zinc-600";
    let icon = <Check className="size-3.5" strokeWidth={2.75} />;
    let badgeTone: "slate" | "neutral" | "amber" | "red" | "green" = "slate";
    let badgeLabel = "Evento";

    if (isBreach) {
      nodeStyle = "border-brand-red bg-red-50 text-brand-red";
      icon = <AlertTriangle className="size-3.5" strokeWidth={2.5} />;
      badgeTone = "red";
      badgeLabel = "Incumplimiento SLA";
    } else if (isWarning) {
      nodeStyle = "border-amber-400 bg-amber-50 text-amber-700";
      icon = <Clock className="size-3.5" strokeWidth={2.5} />;
      badgeTone = "amber";
      badgeLabel = "Alerta SLA";
    } else if (isCreated) {
      nodeStyle = "border-emerald-500 bg-emerald-50 text-emerald-600";
      icon = <Plus className="size-3.5" strokeWidth={2.5} />;
      badgeTone = "green";
      badgeLabel = "Creación";
    } else if (isStatusChange) {
      nodeStyle = "border-blue-400 bg-blue-50 text-blue-600";
      icon = <Workflow className="size-3.5" strokeWidth={2.25} />;
      badgeTone = "neutral";
      badgeLabel = "Cambio de Estado";
    } else if (isAssign) {
      nodeStyle = "border-violet-400 bg-violet-50 text-violet-600";
      icon = <UserCheck className="size-3.5" strokeWidth={2.25} />;
      badgeTone = "neutral";
      badgeLabel = event.eventType === "Reassigned" ? "Reasignación" : "Asignación";
    } else if (isPriority) {
      nodeStyle = "border-amber-400 bg-amber-50 text-amber-600";
      icon = <Tag className="size-3.5" strokeWidth={2.25} />;
      badgeTone = "amber";
      badgeLabel = "Prioridad";
    } else if (isClosed) {
      nodeStyle = "border-emerald-600 bg-emerald-100 text-emerald-800";
      icon = <CheckCircle2 className="size-3.5" strokeWidth={2.5} />;
      badgeTone = "green";
      badgeLabel = "Resolución";
    } else if (isReopened) {
      nodeStyle = "border-orange-500 bg-orange-50 text-orange-600";
      icon = <RotateCcw className="size-3.5" strokeWidth={2.5} />;
      badgeTone = "amber";
      badgeLabel = "Reapertura";
    } else if (isTask) {
      nodeStyle = "border-teal-500 bg-teal-50 text-teal-700";
      icon = <Check className="size-3.5" strokeWidth={2.5} />;
      badgeTone = "neutral";
      badgeLabel = "Tarea";
    }

    const actor = event.actorStaffName ?? "Sistema";

    return (
      <li key={`evt-${event.id}-${stepNumber}`} className="group relative pb-5 pl-11 last:pb-0">
        {/* Riel vertical */}
        <span
          aria-hidden
          className="absolute left-[15px] top-4 -bottom-4 w-[2px] bg-zinc-200/80 group-last:hidden"
        />

        {/* Nodo en el riel */}
        <span
          aria-hidden
          className={`absolute left-0 top-1.5 z-10 flex size-[32px] items-center justify-center rounded-full border-2 ring-4 ring-white shadow-2xs transition-transform group-hover:scale-105 ${nodeStyle}`}
        >
          {icon}
        </span>

        {/* Tarjeta simétrica */}
        <div
          className={`rounded-xl border p-3.5 shadow-2xs transition-all hover:shadow-xs ${
            isBreach
              ? "border-red-200 bg-red-50/20"
              : isCreated
                ? "border-emerald-200/90 bg-emerald-50/20"
                : "border-zinc-200/90 bg-white"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span className="font-mono text-[10px] font-bold text-zinc-500 bg-zinc-100 border border-zinc-200/80 px-1.5 py-0.5 rounded">
                #{stepNumber}
              </span>
              <span className="font-heading text-[12.5px] font-bold text-zinc-900 truncate">
                {actor}
              </span>
              <Badge tone={badgeTone} className="text-[10px] px-1.5 py-0.5">
                {badgeLabel}
              </Badge>
            </div>
            <time
              dateTime={event.createdAt}
              className="shrink-0 font-heading text-[11px] font-semibold tabular-nums text-zinc-400"
              title={formatDateTime(event.createdAt)}
            >
              {formatTimeOnly(event.createdAt)}
            </time>
          </div>

          {/* Transición visual para cambios de estado */}
          {isStatusChange && (event.oldValue || event.newValue) ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className="text-[11.5px] font-medium text-zinc-500">Transición:</span>
              {event.oldValue && (
                <span className="rounded-md border border-zinc-200 bg-zinc-100 px-2 py-0.5 font-heading text-[11px] font-medium text-zinc-600 line-through opacity-75">
                  {event.oldValue}
                </span>
              )}
              <ArrowRight className="size-3 text-zinc-400" />
              {event.newValue && (
                <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 font-heading text-[11px] font-bold text-blue-700">
                  {event.newValue}
                </span>
              )}
            </div>
          ) : null}

          {/* Transición visual para asignaciones */}
          {isAssign && event.newValue ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[12px]">
              <span className="text-zinc-500 font-medium">Colaborador asignado:</span>
              <span className="rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 font-heading font-bold text-violet-800">
                {event.newValue}
              </span>
            </div>
          ) : null}

          {/* Transición visual para prioridades */}
          {isPriority && (event.oldValue || event.newValue) ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className="text-[11.5px] font-medium text-zinc-500">Prioridad:</span>
              {event.oldValue && (
                <span className="rounded-md border border-zinc-200 bg-zinc-100 px-2 py-0.5 font-heading text-[11px] font-medium text-zinc-600 line-through opacity-75">
                  {event.oldValue}
                </span>
              )}
              <ArrowRight className="size-3 text-zinc-400" />
              {event.newValue && (
                <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 font-heading text-[11px] font-bold text-amber-800">
                  {event.newValue}
                </span>
              )}
            </div>
          ) : null}

          {/* Detalle textual o descripción complementaria */}
          {event.details && (
            <p
              className={`mt-2 text-[12px] leading-relaxed ${
                isBreach ? "font-medium text-brand-red-dark" : "text-zinc-600"
              }`}
            >
              {event.details}
            </p>
          )}
        </div>
      </li>
    );
  }

  /** Renderiza un mensaje dentro de la arquitectura simétrica. */
  function renderMessageItem(message: TicketMessageResponse, stepNumber: number) {
    const direction = message.direction.toLowerCase();
    const isInternal = direction === "interna";
    const isOutbound = direction === "saliente";
    const isOrigin = Boolean(message.isOrigin);
    const author = isOrigin
      ? (message.authorContactName ?? ticket.requesterName ?? ticket.clientName ?? message.authorStaffName ?? "Cliente")
      : (message.authorStaffName ?? message.authorContactName ?? ticket.requesterName ?? "Remitente");

    let nodeStyle = "border-zinc-300 bg-zinc-50 text-zinc-700";
    let icon = <User className="size-3.5" strokeWidth={2.25} />;
    let badgeTone: "slate" | "amber" | "green" = "slate";
    let badgeLabel = "Cliente";

    if (isInternal) {
      nodeStyle = "border-amber-400 bg-amber-100 text-amber-800";
      icon = <Lock className="size-3.5" strokeWidth={2.25} />;
      badgeTone = "amber";
      badgeLabel = "Nota interna";
    } else if (isOutbound) {
      nodeStyle = "border-zinc-900 bg-zinc-900 text-white";
      icon = <Send className="size-3.5" strokeWidth={2.25} />;
      badgeTone = "slate";
      badgeLabel = "Respuesta del equipo";
    } else if (isOrigin) {
      const isEmail = ticket.channel.toLowerCase() === "correo";
      nodeStyle = "border-emerald-500 bg-emerald-50 text-emerald-700";
      icon = isEmail ? (
        <Mail className="size-3.5" strokeWidth={2.25} />
      ) : (
        <User className="size-3.5" strokeWidth={2.25} />
      );
      badgeTone = "green";
      badgeLabel = origin.label;
    }

    return (
      <li key={`msg-${message.id}`} className="group relative pb-5 pl-11 last:pb-0">
        {/* Riel vertical */}
        <span
          aria-hidden
          className="absolute left-[15px] top-4 -bottom-4 w-[2px] bg-zinc-200/80 group-last:hidden"
        />

        {/* Nodo en el riel */}
        <span
          aria-hidden
          className={`absolute left-0 top-1.5 z-10 flex size-[32px] items-center justify-center rounded-full border-2 ring-4 ring-white shadow-2xs transition-transform group-hover:scale-105 ${nodeStyle}`}
        >
          {icon}
        </span>

        {/* Tarjeta simétrica */}
        <div
          className={`rounded-xl border p-3.5 shadow-2xs transition-all hover:shadow-xs ${
            message.isOrigin
              ? "border-emerald-200/90 bg-emerald-50/20"
              : isInternal
                ? "border-amber-200/80 bg-amber-50/30"
                : isOutbound
                  ? "border-zinc-200/90 bg-zinc-50/40"
                  : "border-zinc-200/90 bg-white"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span className="font-mono text-[10px] font-bold text-zinc-500 bg-zinc-100 border border-zinc-200/80 px-1.5 py-0.5 rounded">
                #{stepNumber}
              </span>
              <span className="font-heading text-[12.5px] font-bold text-zinc-900 truncate">
                {author}
              </span>
              <Badge tone={badgeTone} className="text-[10px] px-1.5 py-0.5">
                {badgeLabel}
              </Badge>
              {isOrigin && (ticket.createdByStaffName || ticket.channel.toLowerCase() === "manual") && (
                <span className="text-[11.5px] text-zinc-500 font-normal">
                  · {ticket.createdByStaffName ? `Registrado por ${ticket.createdByStaffName}` : "Alta manual"}
                </span>
              )}
            </div>
            <time
              dateTime={message.createdAt}
              className="shrink-0 font-heading text-[11px] font-semibold tabular-nums text-zinc-400"
              title={formatDateTime(message.createdAt)}
            >
              {formatTimeOnly(message.createdAt)}
            </time>
          </div>

          {/* Cuerpo del mensaje */}
          <div className="mt-2 text-[12.5px] leading-relaxed text-zinc-800">
            <FormattedTicketBody text={message.bodyText} html={message.bodyHtml} />
          </div>

          {/* Adjuntos del mensaje */}
          {message.attachments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-zinc-100/90 pt-2.5">
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
      className={`fixed inset-0 z-50 flex justify-end bg-ink/45 backdrop-blur-[2px] will-change-[opacity] ${
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
        className={`relative flex h-full w-full flex-col bg-white shadow-[0_4px_32px_rgba(27,27,29,0.22)] sm:w-[620px] will-change-[transform,opacity] ${
          isExiting ? "pointer-events-none" : ""
        }`}
      >
        {/* Cabecera Principal */}
        <div className={dialogHeaderShellClass}>
          <div className={dialogHeaderStackClass}>
            <p className="font-heading text-[11px] font-medium text-zinc-400">
              Tickets · Auditoría y cronología
            </p>
            <div className="flex items-center gap-2">
              <h2 id={titleId} className="font-heading text-[18px] font-bold tracking-[-0.01em] text-ink">
                Historial de actividad
              </h2>
              <button
                type="button"
                onClick={handleCopyTicketNumber}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[11px] font-bold text-zinc-700 hover:border-zinc-300 hover:bg-zinc-100 transition-colors"
                title="Copiar número de ticket"
              >
                <span>{ticket.number}</span>
                {copiedNumber ? (
                  <Check className="size-3 text-emerald-600" />
                ) : (
                  <Copy className="size-3 text-zinc-400" />
                )}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[12px] text-zinc-500">
              <StatusCell status={ticket.status} />
              <PriorityCell priority={ticket.priority} />
              <span aria-hidden className="text-zinc-300">·</span>
              <span className="tabular-nums font-heading text-[11.5px] font-semibold text-zinc-600">
                {timeline.length} {timeline.length === 1 ? "registro total" : "registros totales"}
              </span>
              {internalNotesCount > 0 && (
                <>
                  <span aria-hidden className="text-zinc-300">·</span>
                  <span className="tabular-nums font-heading text-[11.5px] font-semibold text-amber-700">
                    {internalNotesCount} {internalNotesCount === 1 ? "nota interna" : "notas internas"}
                  </span>
                </>
              )}
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={requestClose}
            aria-label="Cerrar el historial (Esc)"
            title="Cerrar (Esc)"
            className="-mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-subtle outline-none
              transition-colors hover:bg-fill hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-red/25 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Barra de Filtros y Estadísticas */}
        <div className="shrink-0 border-b border-line bg-zinc-50/50 px-6 py-2.5">
          <SegmentedFilter
            fullWidth
            aria-label="Filtro del historial"
            value={filter}
            onChange={setFilter}
            items={[
              { key: "all", label: "Todos", count: timeline.length },
              { key: "messages", label: "Mensajes", count: messageCount },
              { key: "events", label: "Eventos", count: eventCount },
            ]}
          />
        </div>

        {/* Barra de Orden y Claridad de Cronología */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-white px-6 py-2">
          <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-zinc-500">
            <Clock className="size-3.5 text-zinc-400" />
            <span>
              {sortOrder === "asc" ? (
                <>
                  <strong className="text-zinc-800">Cronológico:</strong> Del origen al evento más reciente
                </>
              ) : (
                <>
                  <strong className="text-zinc-800">Inverso:</strong> Del evento más reciente al origen
                </>
              )}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-700 shadow-2xs hover:border-zinc-300 hover:bg-zinc-50 active:scale-95 transition-all cursor-pointer"
            title={sortOrder === "asc" ? "Cambiar a más recientes primero" : "Cambiar a qué pasó primero"}
          >
            {sortOrder === "asc" ? (
              <>
                <ArrowDown className="size-3 text-brand-red" />
                <span>Ver más recientes primero</span>
              </>
            ) : (
              <>
                <ArrowUp className="size-3 text-brand-red" />
                <span>Ver qué pasó primero (#1)</span>
              </>
            )}
          </button>
        </div>

        {/* Contenido Desplazable del Historial */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {/* Lista Cronológica de Eventos y Mensajes */}
          <div key={`${filter}-${sortOrder}`} className="animate-plf-apple-tab">
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
              <div className="space-y-6">
                {groupedByDay.map((group) => (
                  <div key={group.dayKey} className="space-y-3">
                    {/* Divisor editorial de fecha */}
                    <div className="flex items-center gap-3 py-1">
                      <span className="h-px flex-1 bg-zinc-200" />
                      <span className="rounded-full border border-zinc-200/90 bg-zinc-100/90 px-3 py-0.5 font-heading text-[11px] font-semibold text-zinc-600 shadow-3xs">
                        {group.dayLabel} ({group.items.length})
                      </span>
                      <span className="h-px flex-1 bg-zinc-200" />
                    </div>

                    <ol className="relative">
                      {group.items.map((item) =>
                        item.kind === "event"
                          ? renderEventItem(item.data, item.stepNumber)
                          : renderMessageItem(item.data, item.stepNumber),
                      )}
                    </ol>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pie del Cajón Lateral (Footer) */}
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
                <CornerUpLeft className="size-3.5 mr-1" />
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
