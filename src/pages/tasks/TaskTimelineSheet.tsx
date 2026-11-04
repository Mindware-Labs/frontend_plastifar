import {
  Check,
  History,
  ListTodo,
  Lock,
  Paperclip,
  RotateCcw,
  User,
  X,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { dialogHeaderShellClass, dialogHeaderStackClass } from "../../components/ui/dialogHeaderStyles";
import { Button } from "../../components/ui/Button";
import { SegmentedFilter } from "../../components/ui/SegmentedFilter";
import { useDialogMotion } from "../../hooks/useDialogMotion";
import { openOverlay } from "../../hooks/overlayStack";
import { formatDateTime } from "../../lib/format";
import type { TaskComment, TaskDetail, TaskEvent, TaskEventType } from "../../types/tasks";

export type TaskTimelineItem =
  | { kind: "comment"; data: TaskComment; createdAt: string }
  | { kind: "event"; data: TaskEvent; createdAt: string };

export type TaskDetailTab = "datos" | "notas";

type TimelineFilter = "all" | "comments" | "events";

export const taskEventLabel: Record<TaskEventType, string> = {
  Creacion: "Creación",
  Asignacion: "Asignación",
  CambioEstado: "Cambio de estado",
  Comentario: "Nota de seguimiento",
  AdjuntoSubido: "Archivo adjuntado",
  Completada: "Completada",
  Reabierta: "Reabierta",
  Cancelada: "Cancelada",
};

export interface TaskTimelineSheetProps {
  task: TaskDetail;
  timeline: TaskTimelineItem[];
  onClose: () => void;
  onSelectTab?: (tab: TaskDetailTab) => void;
  initialFilter?: TimelineFilter;
}

/** Cronología completa de la tarea, notas internas y eventos entrelazados, en un cajón lateral (estilo tickets). */
export function TaskTimelineSheet({
  task,
  timeline,
  onClose,
  onSelectTab,
  initialFilter = "all",
}: TaskTimelineSheetProps) {
  const { isExiting, requestClose, scrimRef, panelRef } = useDialogMotion(onClose, { variant: "drawer" });
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [filter, setFilter] = useState<TimelineFilter>(initialFilter);

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

  const commentCount = timeline.filter((item) => item.kind === "comment").length;
  const eventCount = timeline.length - commentCount;
  const filtered = timeline.filter((item) =>
    filter === "comments" ? item.kind === "comment" : filter === "events" ? item.kind === "event" : true,
  );

  function renderEvent(event: TaskEvent, index: number) {
    const isCancel = event.eventType === "Cancelada";
    const isComplete = event.eventType === "Completada";
    const isReopen = event.eventType === "Reabierta";
    const isAssign = event.eventType === "Asignacion";
    const isAttachment = event.eventType === "AdjuntoSubido";

    let iconNode = <Check className="size-3" strokeWidth={3} />;
    let badgeClass = "bg-zinc-100 text-zinc-500";

    if (isCancel) {
      iconNode = <X className="size-3" strokeWidth={2.5} />;
      badgeClass = "bg-brand-red text-white";
    } else if (isComplete) {
      iconNode = <Check className="size-3" strokeWidth={3} />;
      badgeClass = "bg-emerald-100 text-emerald-700";
    } else if (isReopen) {
      iconNode = <RotateCcw className="size-3" strokeWidth={2.5} />;
      badgeClass = "bg-amber-100 text-amber-700";
    } else if (isAssign) {
      iconNode = <User className="size-3" strokeWidth={2.5} />;
      badgeClass = "bg-blue-100 text-blue-700";
    } else if (isAttachment) {
      iconNode = <Paperclip className="size-3" strokeWidth={2.5} />;
      badgeClass = "bg-zinc-100 text-zinc-600";
    }

    return (
      <li key={`evt-${event.id}-${index}`} className="relative pb-5 pl-9 last:pb-0">
        <span
          aria-hidden
          className={`absolute left-0 top-0 flex size-5 items-center justify-center rounded-md ring-4 ring-white ${badgeClass}`}
        >
          {iconNode}
        </span>
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-1.5">
            <span className="font-heading text-[12.5px] font-bold text-ink">
              {taskEventLabel[event.eventType] ?? event.eventType}
            </span>
            <span className="text-[12px] text-zinc-500">· {event.actorName ?? "Sistema"}</span>
          </div>
          <time
            dateTime={event.createdAt}
            className="shrink-0 font-heading text-[10px] font-bold tabular-nums text-zinc-400"
          >
            {formatDateTime(event.createdAt)}
          </time>
        </div>
        {event.details && (
          <p className="mt-1.5 whitespace-pre-wrap rounded-md border border-zinc-100 bg-zinc-50/80 p-2.5 text-[12px] leading-relaxed text-zinc-600">
            {event.details}
          </p>
        )}
      </li>
    );
  }

  function renderComment(comment: TaskComment) {
    return (
      <li key={`cmt-${comment.id}`} className="relative pb-5 pl-9 last:pb-0">
        <span
          aria-hidden
          className="absolute left-0 top-0 flex size-5 items-center justify-center rounded-md ring-4 ring-white bg-amber-100 text-amber-700"
        >
          <Lock className="size-3" strokeWidth={2.25} />
        </span>
        <div className="rounded-lg border border-amber-200/80 bg-amber-50/30 p-3 shadow-2xs">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[12.5px] font-semibold text-ink">{comment.authorName}</span>
            <time
              dateTime={comment.createdAt}
              className="shrink-0 font-heading text-[10px] font-bold tabular-nums text-zinc-400"
            >
              {formatDateTime(comment.createdAt)}
            </time>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-200/70 px-1.5 py-0.5 font-heading text-[9.5px] font-bold uppercase leading-none tracking-[0.06em] text-amber-900">
              <Lock className="size-2.5" />
              Nota interna
            </span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink">
            {comment.comment}
          </p>
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
        className={`relative flex h-full w-full flex-col bg-white shadow-[0_4px_32px_rgba(27,27,29,0.22)] sm:w-[560px] will-change-[transform,opacity] ${
          isExiting ? "pointer-events-none" : ""
        }`}
      >
        <div className={dialogHeaderShellClass}>
          <div className={dialogHeaderStackClass}>
            <p className="font-heading text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400">
              Tareas · Cronología
            </p>
            <h2 id={titleId} className="font-heading text-[17px] font-bold tracking-[-0.01em] text-ink">
              Historial
            </h2>
            <p className="flex items-center gap-2 text-[12px] text-zinc-500">
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="flex size-4 shrink-0 items-center justify-center rounded-[5px] bg-brand-red/10 text-brand-red"
                >
                  <ListTodo className="size-2.5" strokeWidth={2.25} />
                </span>
                <span className="font-heading text-[11px] font-bold tabular-nums text-zinc-900">{task.number}</span>
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

        <div className="shrink-0 border-b border-line px-6 py-2.5">
          <SegmentedFilter
            fullWidth
            aria-label="Filtro del historial"
            value={filter}
            onChange={setFilter}
            items={[
              { key: "all", label: "Todos", count: timeline.length },
              { key: "comments", label: "Notas", count: commentCount },
              { key: "events", label: "Eventos", count: eventCount },
            ]}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div key={filter} className="animate-plf-apple-tab">
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
                  item.kind === "event" ? renderEvent(item.data, index) : renderComment(item.data),
                )}
              </ol>
            )}
          </div>
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
                  onSelectTab("notas");
                }}
              >
                Ir a notas
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
