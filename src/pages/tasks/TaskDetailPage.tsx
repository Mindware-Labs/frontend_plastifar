import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Check,
  ClipboardList,
  Clock,
  Copy,
  FileText,
  History,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  Tag,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { tasksApi } from "../../api/tasks";
import { ticketsApi } from "../../api/tickets";
import { ModuleHeader, type ModuleHeaderSection } from "../../components/app/ModuleHeader";
import { TaskEvidenceUpload } from "../../components/app/TaskEvidenceUpload";
import { Alert } from "../../components/ui/Alert";
import { TextAreaField } from "../../components/ui/Field";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ErrorRetry } from "../../components/ui/ErrorRetry";
import { TaskDetailSkeleton, TicketFormsSkeleton } from "../../components/ui/Skeleton";
import { Modal } from "../../components/ui/Modal";
import { useAuth } from "../../context/useAuth";
import { useReceipts } from "../../context/useReceipts";
import { usePermissions } from "../../hooks/usePermissions";
import type { TicketDetailResponse } from "../../types/api";
import { TaskFormDocumentView } from "./TaskFormDocumentView";
import { TaskFormsTab, type RegisteredFormItem } from "./TaskFormsTab";
import { InternalNoteThread } from "../../components/notes/InternalNoteThread";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { autoResizeTextarea } from "../../lib/autoResizeTextarea";
import { formatDateTime } from "../../lib/format";
import { PriorityCell } from "../tickets/ticketCells";
import type { TaskDetail } from "../../types/tasks";
import { TaskUpdateModal } from "./TaskUpdateModal";
import { TaskFormModal } from "./TaskFormModal";
import { TaskReasonModal } from "./TaskReasonModal";
import { TaskStatusCell, taskStatusLabel } from "./taskCells";
import { TaskTimelineSheet, type TaskDetailTab, type TaskTimelineItem } from "./TaskTimelineSheet";
import {
  TaskAttachmentInlineList,
  attachmentsByKind,
  mapSeguimientoAttachmentsToComments,
} from "./taskAttachments";

function formatDue(value: string | null) {
  if (!value) return "Sin fecha límite";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "Sin fecha límite";
  const hasTime = !value.includes("T00:00:00") && !value.includes("T23:59:59");
  return hasTime
    ? date.toLocaleString("es-DO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : date.toLocaleDateString("es-DO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

/** Limita la altura del cuerpo al borde inferior de otro elemento y ofrece expandir si excede. */
function AlignedClampBody({
  alignToId,
  onExpand,
  children,
}: {
  alignToId: string;
  onExpand: () => void;
  children: React.ReactNode;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState<number | null>(null);

  useEffect(() => {
    const body = bodyRef.current;
    const inner = innerRef.current;
    const target = document.getElementById(alignToId);
    if (!body || !inner || !target) return;
    const mq = window.matchMedia("(min-width: 1024px)");

    const measure = () => {
      if (!mq.matches) {
        setMaxHeight(null);
        return;
      }
      // -1: el borde inferior (1px) de la tarjeta contenedora queda fuera del cuerpo.
      const available = Math.round(target.getBoundingClientRect().bottom - body.getBoundingClientRect().top - 1);
      const needed = inner.offsetHeight;
      setMaxHeight(available > 80 && needed > available ? available : null);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(inner);
    ro.observe(target);
    for (let el: HTMLElement | null = body.parentElement; el && !el.contains(target); el = el.parentElement) {
      ro.observe(el);
    }
    for (let el: HTMLElement | null = target.parentElement; el && !el.contains(body); el = el.parentElement) {
      ro.observe(el);
    }
    ro.observe(document.body);
    window.addEventListener("resize", measure);
    void document.fonts?.ready.then(measure);
    mq.addEventListener("change", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      mq.removeEventListener("change", measure);
    };
  }, [alignToId]);

  const clamped = maxHeight !== null;

  return (
    <div
      ref={bodyRef}
      style={clamped ? { maxHeight } : undefined}
      className={clamped ? "relative overflow-hidden" : "relative"}
    >
      <div ref={innerRef} className="p-4">
        {children}
      </div>
      {clamped && (
        <button
          type="button"
          onClick={onExpand}
          className="absolute inset-x-0 bottom-0 flex h-20 cursor-pointer items-end justify-center bg-gradient-to-t from-white via-white/95 to-transparent pb-3 outline-none focus-visible:ring-2 focus-visible:ring-brand-red/25"
        >
          <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[11.5px] font-medium text-zinc-600 shadow-2xs transition-colors hover:border-zinc-300 hover:text-zinc-900">
            Haz clic para ver las instrucciones completas
            <ArrowRight className="size-3" />
          </span>
        </button>
      )}
    </div>
  );
}

function FormDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 pt-1 pb-0.5">
      <span className="font-heading text-[10.5px] font-bold uppercase tracking-wider text-zinc-400">
        {title}
      </span>
      <span className="h-px flex-1 bg-zinc-100" />
    </div>
  );
}

export function TaskDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const receipts = useReceipts();
  const { user } = useAuth();
  const id = Number(params.id);
  const { can } = usePermissions();
  const [searchParams] = useSearchParams();
  const initialUrlTab = searchParams.get("tab") as TaskDetailTab | null;

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(Number.isFinite(id));
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TaskDetailTab>(
    initialUrlTab && ["datos", "notas", "formularios", "reclamacion"].includes(initialUrlTab)
      ? initialUrlTab
      : "datos",
  );
  const [hasForms, setHasForms] = useState<boolean | null>(null);
  const [formTicket, setFormTicket] = useState<TicketDetailResponse | null>(null);
  const [formTicketLoading, setFormTicketLoading] = useState(false);
  const [formTicketError, setFormTicketError] = useState<string | null>(null);
  const [viewingDocumentForm, setViewingDocumentForm] = useState<RegisteredFormItem | null>(null);

  // Modals state
  const [editing, setEditing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [reason, setReason] = useState<"cancel" | "reopen" | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showFullInstructions, setShowFullInstructions] = useState(false);

  // Note modal state
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const { isExiting: noteModalExiting, requestClose: requestNoteModalClose, reset: resetNoteModalMotion } =
    useModalAnimation();
  const fullInstructionsAnimation = useModalAnimation();
  const noteTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (showNoteModal && noteTextareaRef.current) {
      autoResizeTextarea(noteTextareaRef.current, 40);
    }
  }, [showNoteModal, newComment]);

  useEffect(() => {
    if (!showNoteModal) return;
    resetNoteModalMotion();
    setNoteFiles([]);
    setCommentError(null);
  }, [showNoteModal, resetNoteModalMotion]);

  const [noteFiles, setNoteFiles] = useState<File[]>([]);

  function load(options?: { silent?: boolean }) {
    setError(null);
    if (!options?.silent) {
      setLoading(true);
      setTask(null);
    }
    return tasksApi
      .get(id)
      .then(setTask)
      .catch((err) => {
        setTask(null);
        setError(err instanceof ApiError ? err.message : "No se pudo cargar la tarea");
      })
      .finally(() => {
        if (!options?.silent) setLoading(false);
      });
  }

  useEffect(() => {
    if (!Number.isFinite(id)) return;
    let active = true;
    setLoading(true);
    setTask(null);
    setError(null);
    tasksApi
      .get(id)
      .then((data) => {
        if (!active) return;
        setTask(data);
      })
      .catch((err) => {
        if (!active) return;
        setTask(null);
        setError(err instanceof ApiError ? err.message : "No se pudo cargar la tarea");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    const tab = searchParams.get("tab") as TaskDetailTab | null;
    if (tab && ["datos", "notas", "formularios", "reclamacion"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!viewingDocumentForm) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewingDocumentForm(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewingDocumentForm]);

  const refreshFormTicket = useCallback(
    ({ force = false }: { force?: boolean } = {}) => {
      if (!Number.isFinite(id)) return Promise.resolve();

      const linkedTicketId = task?.ticketId ?? null;
      if (!force && linkedTicketId != null && formTicket?.id === linkedTicketId) {
        return Promise.resolve();
      }

      const initialFormTicketLoad = formTicket == null;
      if (initialFormTicketLoad) {
        setFormTicketLoading(true);
        setFormTicketError(null);
      }

      const ensureLinkedTicket = () =>
        tasksApi.ensureFormTicket(id).then((ensured) => {
          setTask((prev) =>
            prev && prev.ticketId !== ensured.ticketId
              ? { ...prev, ticketId: ensured.ticketId, ticketNumber: ensured.ticketNumber }
              : prev,
          );
          return ensured.ticketId;
        });

      const resolveTicketId = (): Promise<number> => {
        if (linkedTicketId != null) return Promise.resolve(linkedTicketId);
        return ensureLinkedTicket();
      };

      const loadTicketDetail = (ticketId: number) =>
        ticketsApi.getById(ticketId).catch(async (err) => {
          if (linkedTicketId != null && err instanceof ApiError && err.status === 404) {
            const freshId = await ensureLinkedTicket();
            return ticketsApi.getById(freshId);
          }
          throw err;
        });

      return resolveTicketId()
        .then(loadTicketDetail)
        .then(setFormTicket)
        .catch((err) => {
          setFormTicket(null);
          setFormTicketError(
            err instanceof ApiError ? err.message : "No se pudieron cargar los formularios de la tarea",
          );
        })
        .finally(() => {
          if (initialFormTicketLoad) setFormTicketLoading(false);
        });
    },
    [id, task?.ticketId, formTicket?.id],
  );

  /** Precarga el ticket de formularios en cuanto hay tarea (no esperar a abrir la pestaña). */
  useEffect(() => {
    if (!task) return;
    const deptId = task.departmentId;
    const canPrefetch =
      can("claims.read", deptId) ||
      can("withdrawals.read") ||
      can("discrepancies.read") ||
      can("quality.read");
    if (!canPrefetch) return;
    void refreshFormTicket();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- permisos estables; evitar re-fetch en cada render de `can`
  }, [task?.id, task?.departmentId, refreshFormTicket]);

  async function replyToTaskNote(parentId: number, body: string) {
    if (!task) return;
    await tasksApi.comment(task.id, body, parentId);
    await load({ silent: true });
    receipts.done({
      action: "nota-tarea-respuesta",
      title: "Respuesta guardada",
      detail: task.number,
    });
  }

  async function handleSaveNote() {
    if (!task) return;
    const trimmed = newComment.trim();
    if (!trimmed) return;

    try {
      setSubmittingComment(true);
      setCommentError(null);
      await tasksApi.comment(task.id, trimmed);
      if (noteFiles.length > 0) {
        const form = new FormData();
        for (const file of noteFiles) form.append("Files", file);
        const withFiles = await tasksApi.addAttachments(task.id, form);
        setTask(withFiles);
      } else {
        await load({ silent: true });
      }
      setNewComment("");
      setNoteFiles([]);
      receipts.done({
        action: "nota-tarea",
        title: "Nota interna guardada",
        detail: task.number,
      });
      requestNoteModalClose();
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : "Error al guardar la nota");
    } finally {
      setSubmittingComment(false);
    }
  }

  async function openAttachment(attachmentId: number, download = false) {
    if (!task) return;
    try {
      const link = await tasksApi.attachmentLink(task.id, attachmentId, download);
      window.open(link.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      receipts.failed({
        action: "abrir-adjunto",
        title: "Error al abrir archivo",
        detail: err instanceof Error ? err.message : "No se pudo generar el enlace de descarga.",
      });
    }
  }

  if (!Number.isFinite(id)) {
    return (
      <div className="mx-auto w-full max-w-2xl py-6">
        <Alert variant="error">El identificador de la tarea no es válido.</Alert>
        <Button variant="secondary" size="sm" onClick={() => navigate("/tareas")} className="mt-3">
          Volver al listado
        </Button>
      </div>
    );
  }

  if (loading) {
    return <TaskDetailSkeleton />;
  }

  if (error || !task) {
    return (
      <div className="mx-auto w-full max-w-2xl py-6">
        <ErrorRetry className="mb-3" onRetry={() => void load()}>{error ?? "No se pudo cargar la tarea"}</ErrorRetry>
        <Button variant="secondary" size="sm" onClick={() => navigate("/tareas")}>
          Volver a tareas
        </Button>
      </div>
    );
  }

  const isClosed = task.status === "Completada" || task.status === "Cancelada";
  const canUpdateTask = !isClosed && (task.canComplete || task.canComment);

  const byDate = (a: { createdAt: string }, b: { createdAt: string }) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

  const pureEvents = task.events.filter((e) => e.eventType !== "Comentario");
  const timeline: TaskTimelineItem[] = [
    ...pureEvents.map((e): TaskTimelineItem => ({ kind: "event", data: e, createdAt: e.createdAt })),
    ...task.comments.map((c): TaskTimelineItem => ({ kind: "comment", data: c, createdAt: c.createdAt })),
  ].sort(byDate);

  const initialAttachments = attachmentsByKind(task.attachments, "Inicial");
  const evidenceAttachments = attachmentsByKind(task.attachments, "Evidencia");
  const noteAttachmentsMap = mapSeguimientoAttachmentsToComments(task.comments, task.attachments);

  const deptId = task.departmentId;
  const canReadForms =
    can("claims.read", deptId) ||
    can("withdrawals.read") ||
    can("discrepancies.read") ||
    can("quality.read");

  const sections: ModuleHeaderSection[] = [
    {
      label: "Datos",
      active: activeTab === "datos",
      onClick: () => setActiveTab("datos"),
    },
    {
      label: `Notas (${task.comments.length})`,
      active: activeTab === "notas",
      onClick: () => setActiveTab("notas"),
    },
    ...(canReadForms
      ? [
          {
            label: (
              <span className="inline-flex items-center gap-1.5">
                Formularios
                {hasForms && (
                  <span className="size-1.5 rounded-full bg-brand-red" title="Tiene formularios registrados" />
                )}
              </span>
            ),
            active: activeTab === "formularios" || activeTab === "reclamacion",
            onClick: () => setActiveTab("formularios"),
          },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {viewingDocumentForm ? (
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden animate-plf-receipt-in">
          <TaskFormDocumentView
            form={viewingDocumentForm}
            taskNumber={task.number}
            onBack={() => setViewingDocumentForm(null)}
          />
        </div>
      ) : (
        <>
      <ModuleHeader
        backTo="/tareas"
        backLabel="Volver al listado de tareas"
        title={task.number}
        badge={
          <div className="flex items-center gap-1.5">
            <TaskStatusCell status={task.status} />
            {!isClosed && <PriorityCell priority={task.priority} />}
          </div>
        }
        sections={sections}
        action={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowTimeline(true)}
            >
              <History className="h-[15px] w-[15px]" />
              Historial
              <span className="tabular-nums text-subtle">{timeline.length}</span>
            </Button>

            {canUpdateTask && (
              <Button
                type="button"
                size="sm"
                onClick={() => setUpdating(true)}
                className="group font-heading font-semibold tracking-[-0.01em] shadow-xs hover:shadow-sm transition-all active:scale-[0.98]"
              >
                <ClipboardList className="h-3.5 w-3.5" />
                Actualizar
              </Button>
            )}

            {task.canCancel && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => setReason("cancel")}
              >
                <X className="h-3.5 w-3.5" />
                Cancelar
              </Button>
            )}

            {task.canReopen && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setReason("reopen")}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reabrir tarea
              </Button>
            )}

            {!task.canComplete && !task.canCancel && !task.canReopen && isClosed && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200/80 bg-zinc-50/80 px-2.5 py-1 text-[11.5px] font-semibold text-zinc-600 shadow-2xs">
                <Lock className="size-3 text-zinc-400" strokeWidth={2.25} />
                <span>Cierre definitivo</span>
              </span>
            )}
          </div>
        }
      />

      {/* Zona de contenido con scroll vertical */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 pb-8">
        <div className="mx-auto w-full max-w-6xl">
          <div className="pt-2">
            {/* Encabezado: Título y Metadatos */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 max-w-full lg:max-w-2xl">
                <h1
                  className="font-heading text-[18px] sm:text-[20px] font-bold leading-snug tracking-[-0.02em] text-ink truncate"
                  title={task.title}
                >
                  {task.title}
                </h1>
              </div>

              <p className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-zinc-500 shrink-0">
                <span>Creada el {formatDateTime(task.createdAt)} por</span>
                <span className="font-medium text-zinc-800">{task.createdByName}</span>
                <span aria-hidden className="text-zinc-300">·</span>
                <span className="font-heading text-[9.5px] font-bold uppercase tracking-[0.08em] text-zinc-400">
                  {task.origin === "Correo" ? "Correo" : "Manual"}
                </span>
              </p>
            </div>

            <div className="mt-3.5">
              <div key={activeTab} className="animate-plf-apple-tab">
                {activeTab === "datos" && (
                  <div className="space-y-3.5">
                    {/* 1. Métricas rápidas superiores (4 tarjetas compactas tipo SaaS) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {/* 1.1 Estado */}
                      <div className="rounded-card border border-zinc-200/80 bg-white p-3 shadow-2xs">
                        <div className="flex items-center justify-between text-zinc-400">
                          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Estado</span>
                          <span
                            className={`h-2 w-2 rounded-full ${
                              task.status === "Completada"
                                ? "bg-emerald-500"
                                : task.status === "Cancelada"
                                ? "bg-zinc-400"
                                : task.status === "EnProgreso"
                                ? "bg-amber-500"
                                : "bg-blue-500"
                            }`}
                          />
                        </div>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="font-heading text-[15px] font-bold text-zinc-900 truncate">
                            {taskStatusLabel(task.status)}
                          </span>
                          {task.isOverdue && !isClosed && (
                            <span className="text-[11px] font-medium text-red-600 truncate">
                              Vencida
                            </span>
                          )}
                          {task.completedAt && (
                            <span className="text-[11px] font-medium text-emerald-700 truncate">
                              Completada
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 1.2 Prioridad */}
                      <div className="rounded-card border border-zinc-200/80 bg-white p-3 shadow-2xs">
                        <div className="flex items-center justify-between text-zinc-400">
                          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Prioridad</span>
                          <Tag className="h-3.5 w-3.5 text-zinc-400" />
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <PriorityCell priority={task.priority} />
                          <span className="text-[10px] font-heading font-semibold uppercase tracking-wider text-zinc-400">
                            {task.origin}
                          </span>
                        </div>
                      </div>

                      {/* 1.3 Fecha límite */}
                      <div className="rounded-card border border-zinc-200/80 bg-white p-3 shadow-2xs">
                        <div className="flex items-center justify-between text-zinc-400">
                          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Fecha límite</span>
                          <Clock className="h-3.5 w-3.5 text-zinc-400" />
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <span className={`text-[12px] font-medium tabular-nums truncate ${task.isOverdue && !isClosed ? "text-red-700 font-semibold" : "text-zinc-800"}`}>
                            {formatDue(task.dueDate)}
                          </span>
                          {task.isOverdue && !isClosed ? (
                            <span className="text-[10.5px] font-bold uppercase tracking-wider text-red-700">
                              Vencida
                            </span>
                          ) : task.dueDate ? (
                            <span className="text-[10px] font-heading font-semibold uppercase tracking-wider text-emerald-700">
                              A tiempo
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* 1.4 Responsable */}
                      <div className="rounded-card border border-zinc-200/80 bg-white p-3 shadow-2xs">
                        <div className="flex items-center justify-between text-zinc-400">
                          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Responsable</span>
                          {task.canEdit && (
                            <button
                              type="button"
                              onClick={() => setEditing(true)}
                              title="Cambiar responsable"
                              className="text-zinc-400 hover:text-zinc-700 transition-colors p-0.5 rounded hover:bg-zinc-100 cursor-pointer"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          {task.assignedStaffName ? (
                            <>
                              <Avatar name={task.assignedStaffName} seed={task.assignedStaffId ?? task.id} size={20} />
                              <span className="font-heading text-[13.5px] font-bold text-zinc-900 truncate">
                                {task.assignedStaffName}
                              </span>
                            </>
                          ) : (
                            <span className="font-heading text-[13.5px] font-bold text-amber-600 italic">
                              Sin asignar
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 2. Grilla principal (2 columnas: lg:col-span-2 + lg:col-span-1) */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
                      {/* Columna Izquierda (lg:col-span-2) */}
                      <div className="lg:col-span-2 space-y-3.5">
                        {/* Card: Clasificación y Detalles */}
                        <div className="rounded-card border border-line bg-white shadow-card overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 bg-zinc-50/50">
                            <div className="flex items-center gap-2">
                              <Tag className="h-4 w-4 text-zinc-500" />
                              <h3 className="font-heading text-[11.5px] font-bold uppercase tracking-wider text-zinc-800">
                                Clasificación y Detalles
                              </h3>
                            </div>
                            {task.canEdit && (
                              <button
                                type="button"
                                onClick={() => setEditing(true)}
                                className="inline-flex h-6 cursor-pointer items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 text-[11px] font-medium text-zinc-600 shadow-2xs outline-none transition-colors hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 active:scale-95"
                              >
                                <Pencil className="size-3 text-zinc-400" />
                                <span>Editar tarea</span>
                              </button>
                            )}
                          </div>

                          <div className="px-4 py-1 divide-y divide-zinc-100">
                            <div className="flex items-center justify-between py-2 text-[12.5px]">
                              <span className="text-zinc-500 font-medium">Título</span>
                              <div className="flex items-center gap-1.5 max-w-[70%]">
                                <span className="font-semibold text-zinc-900 text-right truncate" title={task.title}>
                                  {task.title}
                                </span>
                                <CopyButton text={task.title} label="Copiar título" />
                              </div>
                            </div>

                            <div className="flex items-center justify-between py-2 text-[12.5px]">
                              <span className="text-zinc-500 font-medium">Código / Número</span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-zinc-800 tabular-nums font-semibold">
                                  {task.number}
                                </span>
                                <CopyButton text={task.number} label="Copiar código" />
                              </div>
                            </div>

                            <div className="flex items-center justify-between py-2 text-[12.5px]">
                              <span className="text-zinc-500 font-medium">Departamento</span>
                              <span className="text-zinc-800 font-medium text-right truncate max-w-[65%]">
                                {task.departmentName}
                              </span>
                            </div>

                            <div className="flex items-center justify-between py-2 text-[12.5px]">
                              <span className="text-zinc-500 font-medium">Prioridad</span>
                              <PriorityCell priority={task.priority} />
                            </div>

                            <div className="flex items-center justify-between py-2 text-[12.5px]">
                              <span className="text-zinc-500 font-medium">Estado</span>
                              <TaskStatusCell status={task.status} />
                            </div>

                            <div className="flex items-center justify-between py-2 text-[12.5px]">
                              <span className="text-zinc-500 font-medium">Canal de origen</span>
                              <span className="capitalize text-zinc-800 font-medium bg-zinc-100 border border-zinc-200/80 px-2 py-0.5 rounded text-[11.5px]">
                                {task.origin}
                              </span>
                            </div>

                            {task.emailId != null && (
                              <div className="flex items-center justify-between py-2 text-[12.5px]">
                                <span className="text-zinc-500 font-medium">Correo de origen</span>
                                <Link
                                  to={`/bandeja?correo=${task.emailId}`}
                                  className="inline-flex items-center gap-1 text-brand-red font-medium hover:underline truncate max-w-[65%]"
                                  title={task.emailSubject ?? "Ver correo original"}
                                >
                                  <span className="truncate">{task.emailSubject ?? "Ver correo original"}</span>
                                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                                </Link>
                              </div>
                            )}

                            <div className="flex items-center justify-between py-2 text-[12.5px]">
                              <span className="text-zinc-500 font-medium">Creado por</span>
                              <span className="text-zinc-800 font-medium">
                                {task.createdByName}
                                <span className="text-zinc-400 font-normal ml-1.5">({formatDateTime(task.createdAt)})</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Card: Instrucciones de la Tarea */}
                        <div className="rounded-card border border-line bg-white shadow-card overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 bg-zinc-50/50">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-zinc-500" />
                              <h3 className="font-heading text-[11.5px] font-bold uppercase tracking-wider text-zinc-800">
                                Instrucciones de la Tarea
                              </h3>
                            </div>
                            <span className="text-[11px] text-zinc-400 font-mono tabular-nums">
                              {formatDateTime(task.createdAt)}
                            </span>
                          </div>

                          <AlignedClampBody
                            alignToId="task-activity-summary-card"
                            onExpand={() => setShowFullInstructions(true)}
                          >
                            <div className="space-y-3">
                              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-800">
                                {task.instructions}
                              </p>

                              {/* Banner de Resolución / Cierre */}
                              {task.completionComment && (
                                <div className="rounded-md border border-emerald-200/80 bg-emerald-50/70 p-3 mt-3">
                                  <p className="font-heading text-[10.5px] font-semibold uppercase tracking-[0.06em] text-emerald-700">
                                    Cierre · {task.completedByName ?? "Completado"} · {task.completedAt ? formatDateTime(task.completedAt) : ""}
                                  </p>
                                  <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-emerald-950">
                                    {task.completionComment}
                                  </p>
                                  <TaskAttachmentInlineList
                                    attachments={evidenceAttachments}
                                    onOpen={(id) => void openAttachment(id, false)}
                                    compact
                                  />
                                </div>
                              )}

                              <TaskAttachmentInlineList
                                attachments={initialAttachments}
                                onOpen={(id) => void openAttachment(id, false)}
                              />

                              {/* Banner de Cancelación */}
                              {task.cancelReason && (
                                <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 mt-3">
                                  <p className="font-heading text-[10.5px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
                                    Cancelación · {task.cancelledByName ?? "Cancelado"} · {task.cancelledAt ? formatDateTime(task.cancelledAt) : ""}
                                  </p>
                                  <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-700">
                                    {task.cancelReason}
                                  </p>
                                </div>
                              )}
                            </div>
                          </AlignedClampBody>
                        </div>
                      </div>

                      {/* Columna Derecha (lg:col-span-1) */}
                      <div className="space-y-3.5">
                        {/* Card: Cliente y Contacto */}
                        <div className="rounded-card border border-line bg-white shadow-card overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 bg-zinc-50/50">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-zinc-500" />
                              <h3 className="font-heading text-[11.5px] font-bold uppercase tracking-wider text-zinc-800">
                                Cliente y Contacto
                              </h3>
                            </div>
                          </div>

                          <div className="p-4 space-y-3">
                            {task.clientName ? (
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 font-heading text-[11px] font-bold tracking-[0.04em] text-zinc-700">
                                    {task.clientName.slice(0, 2).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <span
                                      className="block truncate text-[13.5px] font-bold text-zinc-900 leading-tight"
                                      title={task.clientName}
                                    >
                                      {task.clientName}
                                    </span>
                                    {task.clientId && (
                                      <Link
                                        to={`/clientes/${task.clientId}`}
                                        className="inline-flex items-center gap-1 text-[11.5px] text-brand-red font-medium hover:underline mt-0.5"
                                      >
                                        <span>Ver ficha de cliente</span>
                                        <ArrowRight className="size-3" />
                                      </Link>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="py-2 text-[12.5px] text-zinc-400 italic">
                                Sin cliente vinculado
                              </div>
                            )}

                            <div className="pt-2 border-t border-zinc-100 divide-y divide-zinc-100 text-[12.5px]">
                              <div className="flex items-center justify-between py-2">
                                <span className="text-zinc-500 font-medium">Contacto</span>
                                <span
                                  className="font-semibold text-zinc-800 text-right truncate max-w-[65%]"
                                  title={task.contactName ?? undefined}
                                >
                                  {task.contactName ?? <span className="text-zinc-400 font-normal">Sin contacto</span>}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Card: Fechas y Plazos */}
                        <div className="rounded-card border border-line bg-white shadow-card overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 bg-zinc-50/50">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-zinc-500" />
                              <h3 className="font-heading text-[11.5px] font-bold uppercase tracking-wider text-zinc-800">
                                Fechas y Plazos
                              </h3>
                            </div>
                          </div>

                          <div className="px-4 py-1 divide-y divide-zinc-100 text-[12.5px]">
                            <div className="flex items-center justify-between py-2">
                              <span className="text-zinc-500 font-medium">Fecha límite</span>
                              <span
                                className={`tabular-nums font-medium ${
                                  task.isOverdue && !isClosed ? "text-brand-red font-semibold" : "text-zinc-900"
                                }`}
                              >
                                {formatDue(task.dueDate)}
                              </span>
                            </div>

                            <div className="flex items-center justify-between py-2">
                              <span className="text-zinc-500 font-medium">Creada</span>
                              <span className="tabular-nums text-zinc-800 font-medium">
                                {formatDateTime(task.createdAt)}
                              </span>
                            </div>

                            <div className="flex items-center justify-between py-2">
                              <span className="text-zinc-500 font-medium">Última actualización</span>
                              <span className="tabular-nums text-zinc-800 font-medium">
                                {formatDateTime(task.updatedAt)}
                              </span>
                            </div>

                            {task.completedAt && (
                              <div className="flex items-center justify-between py-2">
                                <span className="text-zinc-500 font-medium">Completada</span>
                                <span className="tabular-nums text-emerald-800 font-medium">
                                  {formatDateTime(task.completedAt)}
                                </span>
                              </div>
                            )}

                            {task.cancelledAt && (
                              <div className="flex items-center justify-between py-2">
                                <span className="text-zinc-500 font-medium">Cancelada</span>
                                <span className="tabular-nums text-zinc-700 font-medium">
                                  {formatDateTime(task.cancelledAt)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Card: Resumen de actividad e hitos */}
                        <div
                          id="task-activity-summary-card"
                          className="rounded-card border border-line bg-white shadow-card overflow-hidden"
                        >
                          <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 bg-zinc-50/50">
                            <div className="flex items-center gap-2">
                              <History className="h-4 w-4 text-zinc-500" />
                              <h3 className="font-heading text-[11.5px] font-bold uppercase tracking-wider text-zinc-800">
                                Resumen de Actividad
                              </h3>
                            </div>
                          </div>

                          <div className="p-3.5 space-y-2.5">
                            <div className="grid grid-cols-2 gap-2 text-center">
                              <button
                                type="button"
                                onClick={() => setActiveTab("notas")}
                                className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-2 text-left hover:border-zinc-300 hover:bg-zinc-100/70 transition-colors cursor-pointer group"
                              >
                                <span className="text-[10px] font-heading font-semibold uppercase tracking-wider text-zinc-400 group-hover:text-zinc-600 block">
                                  Notas
                                </span>
                                <span className="font-heading text-[16px] font-bold text-zinc-900 tabular-nums">
                                  {task.comments.length}
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setShowTimeline(true)}
                                className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-2 text-left hover:border-zinc-300 hover:bg-zinc-100/70 transition-colors cursor-pointer group"
                              >
                                <span className="text-[10px] font-heading font-semibold uppercase tracking-wider text-zinc-400 group-hover:text-zinc-600 block">
                                  Historial
                                </span>
                                <span className="font-heading text-[16px] font-bold text-zinc-900 tabular-nums">
                                  {timeline.length}
                                </span>
                              </button>
                            </div>

                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => setShowTimeline(true)}
                              className="w-full justify-center"
                            >
                              <History className="size-3.5" />
                              <span>Ver historial de eventos ({timeline.length})</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {canReadForms && (
                  <div
                    className={
                      activeTab === "formularios" || activeTab === "reclamacion"
                        ? "block space-y-3.5"
                        : "hidden"
                    }
                  >
                    {formTicketError ? (
                      <div className="space-y-3">
                        <Alert variant="error">{formTicketError}</Alert>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => void refreshFormTicket({ force: true })}
                        >
                          Reintentar
                        </Button>
                      </div>
                    ) : formTicket ? (
                      <TaskFormsTab
                        task={task}
                        formHostTicket={formTicket}
                        onHasFormsChanged={(has) => setHasForms(has)}
                        onFormsChanged={() => {
                          void refreshFormTicket({ force: true });
                          void load({ silent: true });
                        }}
                        onViewDocument={(form) => setViewingDocumentForm(form)}
                      />
                    ) : (
                      <TicketFormsSkeleton />
                    )}
                  </div>
                )}

                {activeTab === "notas" && (
                  <div className="space-y-3.5">
                    {task.comments.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-amber-200/80 bg-amber-50/20 px-6 py-8 text-center">
                        <div className="mx-auto flex size-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                          <Lock className="size-4" strokeWidth={2.25} />
                        </div>
                        <p className="mt-2.5 font-heading text-[14px] font-semibold text-zinc-800">
                          {isClosed ? "Sin notas registradas" : "Nada anotado todavía"}
                        </p>
                        <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-zinc-500">
                          {isClosed
                            ? task.status === "Completada"
                              ? "Esta tarea se completó sin registrar notas de seguimiento durante su ciclo de vida."
                              : "Esta tarea fue cancelada sin registrar notas de seguimiento durante su ciclo de vida."
                            : "Aquí queda lo que el equipo necesita saber sobre el avance de la tarea: cómo fue la llamada, qué se intentó ya, con quién quedó pendiente."}
                        </p>
                        {!isClosed && task.canComment && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setNewComment("");
                              setCommentError(null);
                              setShowNoteModal(true);
                            }}
                            className="mt-4"
                          >
                            <Plus className="h-[14px] w-[14px]" />
                            Añadir nota
                          </Button>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 font-heading text-[10px] font-bold uppercase tracking-[0.08em] tabular-nums text-zinc-400">
                            <Lock className="h-3 w-3 text-amber-600" />
                            <span>
                              {task.comments.length} {task.comments.length === 1 ? "nota interna" : "notas internas"}
                            </span>
                          </div>
                          <span aria-hidden className="h-px flex-1 bg-zinc-200/70" />
                          {!isClosed && task.canComment && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                setNewComment("");
                                setCommentError(null);
                                setShowNoteModal(true);
                              }}
                            >
                              <Plus className="h-[14px] w-[14px]" />
                              Añadir nota
                            </Button>
                          )}
                        </div>

                        <InternalNoteThread
                          notes={task.comments.map((comment) => ({
                            id: comment.id,
                            parentId: comment.parentId ?? null,
                            authorStaffId: comment.authorStaffId,
                            authorName: comment.authorName,
                            body: comment.comment,
                            createdAt: comment.createdAt,
                          }))}
                          currentStaffId={user?.staffId}
                          canReply={!isClosed && task.canComment}
                          onReply={replyToTaskNote}
                          renderExtra={(note) => (
                            <TaskAttachmentInlineList
                              attachments={noteAttachmentsMap.get(note.id) ?? []}
                              onOpen={(attachmentId) => void openAttachment(attachmentId, false)}
                              compact
                            />
                          )}
                        />
                      </>
                    )}
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      </div>
        </>
      )}

      {editing && (
        <TaskFormModal
          task={task}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setEditing(false);
            setTask(saved);
            if (saved.ticketId !== task.ticketId) {
              void refreshFormTicket({ force: true });
            }
            receipts.done({
              action: "editar-tarea",
              title: "Tarea actualizada",
              detail: `${saved.number} · ${saved.title}`,
            });
          }}
        />
      )}

      {updating && (
        <TaskUpdateModal
          task={task}
          onClose={() => setUpdating(false)}
          onUpdated={(saved, mode) => {
            setUpdating(false);
            setTask(saved);
            if (mode === "complete") {
              receipts.done({
                action: "completar-tarea",
                title: "Tarea completada",
                detail: `${saved.number} quedó registrada como completada.`,
              });
            } else {
              receipts.done({
                action: "editar-tarea",
                title: "Avance registrado",
                detail: `${saved.number} · seguimiento guardado en el historial.`,
              });
            }
          }}
        />
      )}

      {reason && (
        <TaskReasonModal
          task={task}
          mode={reason}
          onClose={() => setReason(null)}
          onSaved={(saved) => {
            const isReopen = reason === "reopen";
            setReason(null);
            setTask(saved);
            receipts.done({
              action: isReopen ? "reabrir-tarea" : "cancelar-tarea",
              title: isReopen ? "Tarea reabierta" : "Tarea cancelada",
              detail: `${saved.number} actualizada correctamente.`,
            });
          }}
        />
      )}

      {showNoteModal && (
        <Modal
          maxWidth="max-w-xl"
          eyebrow={task.number}
          title="Añadir nota interna"
          description={
            <span className="inline-flex flex-wrap items-center gap-2">
              <Badge tone="amber">
                <Lock aria-hidden className="mr-1 h-3 w-3" />
                Privada
              </Badge>
              <span>Solo la ve el personal del equipo. El cliente no recibe copia.</span>
            </span>
          }
          onClose={() => {
            if (!submittingComment) {
              setShowNoteModal(false);
              resetNoteModalMotion();
            }
          }}
          isExiting={noteModalExiting}
          onRequestClose={requestNoteModalClose}
          footer={
            <div className="flex w-full items-center justify-between gap-3">
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-zinc-400 select-none">
                <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 text-[10px] font-mono text-zinc-500">
                  Ctrl
                </kbd>
                <span>+</span>
                <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 text-[10px] font-mono text-zinc-500">
                  Enter
                </kbd>
                <span className="ml-0.5">para guardar</span>
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={submittingComment}
                  onClick={requestNoteModalClose}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  isLoading={submittingComment}
                  disabled={!newComment.trim()}
                  onClick={() => void handleSaveNote()}
                >
                  Guardar nota
                </Button>
              </div>
            </div>
          }
        >
          <div className="flex flex-col gap-3 text-left">
            {commentError && <Alert variant="error">{commentError}</Alert>}

            <FormDivider title="Nota de seguimiento" />

            <TextAreaField
              label="Mensaje interno"
              required
              autoFocus
              rows={1}
              maxLength={4000}
              value={newComment}
              placeholder="Escribe lo que el equipo deba saber: cómo fue la llamada, qué se intentó ya, con quién quedó pendiente…"
              onChange={(e) => {
                setNewComment(e.target.value);
                if (commentError) setCommentError(null);
                autoResizeTextarea(e.target, 52);
              }}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  void handleSaveNote();
                }
              }}
              className="min-h-0 resize-none overflow-hidden text-[12.5px] py-2 leading-relaxed [field-sizing:content]"
              hint={
                newComment.length > 0 ? (
                  <span
                    className={`block text-right text-[11px] tabular-nums text-zinc-400 ${newComment.length > 3800 ? "text-brand-red font-medium" : ""}`}
                  >
                    {newComment.length} / 4000
                  </span>
                ) : undefined
              }
              ref={(el) => {
                noteTextareaRef.current = el;
                if (el) autoResizeTextarea(el, 52);
              }}
            />

            <TaskEvidenceUpload
              files={noteFiles}
              onFilesChange={setNoteFiles}
              onReportError={setCommentError}
              label="Adjuntos (opcional)"
              dropzoneTitle="Adjuntar archivos"
              dropzoneHint="Máx. 10 MB por archivo"
            />
          </div>
        </Modal>
      )}

      {showFullInstructions && (
        <Modal
          maxWidth="max-w-xl"
          title="Instrucciones de la tarea"
          eyebrow={`${task.number} · Apertura`}
          description={`Registrado por ${task.createdByName} el ${formatDateTime(task.createdAt)}`}
          onClose={() => setShowFullInstructions(false)}
          isExiting={fullInstructionsAnimation.isExiting}
          onRequestClose={fullInstructionsAnimation.requestClose}
          footer={
            <div className="flex w-full items-center justify-between gap-3">
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-zinc-400 select-none">
                Instrucciones registradas en la apertura
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <CopyButton text={task.instructions} label="Copiar texto completo" />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={fullInstructionsAnimation.requestClose}
                >
                  Cerrar
                </Button>
              </div>
            </div>
          }
        >
          <div className="flex flex-col gap-3 text-left">
            <FormDivider title="Texto de las instrucciones" />
            <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-zinc-200/90 bg-zinc-50/60 p-3.5 text-left">
              <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-zinc-800 selection:bg-brand-red/10 font-normal">
                {task.instructions}
              </p>
            </div>
            <TaskAttachmentInlineList
              attachments={initialAttachments}
              onOpen={(id) => void openAttachment(id, false)}
            />
          </div>
        </Modal>
      )}

      {showTimeline && (
        <TaskTimelineSheet
          task={task}
          timeline={timeline}
          onClose={() => setShowTimeline(false)}
          onSelectTab={setActiveTab}
        />
      )}
    </div>
  );
}
