import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Check,
  Clock,
  Copy,
  Eye,
  FileText,
  History,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  Tag,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { tasksApi } from "../../api/tasks";
import { ModuleHeader, type ModuleHeaderSection } from "../../components/app/ModuleHeader";
import { TaskEvidenceUpload } from "../../components/app/TaskEvidenceUpload";
import { Alert } from "../../components/ui/Alert";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ErrorRetry } from "../../components/ui/ErrorRetry";
import { Modal } from "../../components/ui/Modal";
import { useReceipts } from "../../context/useReceipts";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { autoResizeTextarea } from "../../lib/autoResizeTextarea";
import { formatBytes, formatDateTime } from "../../lib/format";
import { PriorityCell } from "../tickets/ticketCells";
import type { TaskDetail } from "../../types/tasks";
import { TaskCompleteModal } from "./TaskCompleteModal";
import { TaskFormModal } from "./TaskFormModal";
import { TaskReasonModal } from "./TaskReasonModal";
import { TaskStatusCell } from "./taskCells";
import { TaskTimelineSheet, type TaskDetailTab, type TaskTimelineItem } from "./TaskTimelineSheet";

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

/**
 * Limita la altura del cuerpo al borde inferior de otro elemento (`alignToId`).
 * Si el contenido no excede ese límite se muestra completo; si lo excede, se recorta
 * con un aviso para hacer clic y ver las instrucciones completas (`onExpand`).
 */
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

export function TaskDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const receipts = useReceipts();
  const id = Number(params.id);

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TaskDetailTab>("datos");

  // Modals state
  const [editing, setEditing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [reason, setReason] = useState<"cancel" | "reopen" | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showFullInstructions, setShowFullInstructions] = useState(false);

  // Note modal state
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const noteModalAnimation = useModalAnimation();
  const noteTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (showNoteModal && noteTextareaRef.current) {
      autoResizeTextarea(noteTextareaRef.current, 40);
    }
  }, [showNoteModal, newComment]);

  // File upload state
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  function load() {
    setError(null);
    return tasksApi.get(id).then(setTask).catch((err) => {
      setTask(null);
      setError(err instanceof ApiError ? err.message : "No se pudo cargar la tarea");
    });
  }

  useEffect(() => {
    if (!Number.isFinite(id)) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSaveNote() {
    if (!task) return;
    const trimmed = newComment.trim();
    if (!trimmed) return;

    try {
      setSubmittingComment(true);
      setCommentError(null);
      await tasksApi.comment(task.id, trimmed);
      setNewComment("");
      setShowNoteModal(false);
      receipts.done({
        action: "nota-tarea",
        title: "Nota interna guardada",
        detail: task.number,
      });
      await load();
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : "Error al guardar la nota");
    } finally {
      setSubmittingComment(false);
    }
  }

  async function handleUploadFiles() {
    if (!task || pendingFiles.length === 0) return;
    try {
      setIsUploading(true);
      setUploadError(null);
      const form = new FormData();
      for (const file of pendingFiles) form.append("Files", file);
      const updated = await tasksApi.addAttachments(task.id, form);
      setTask(updated);
      setPendingFiles([]);
      receipts.done({
        action: "subir-adjuntos-tarea",
        title: "Archivos adjuntados",
        detail: `${pendingFiles.length} ${pendingFiles.length === 1 ? "archivo añadido" : "archivos añadidos"} a la tarea.`,
      });
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "No se pudieron adjuntar los archivos.");
    } finally {
      setIsUploading(false);
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

  if (error) {
    return (
      <div className="mx-auto w-full max-w-2xl py-6">
        <ErrorRetry className="mb-3" onRetry={() => void load()}>{error}</ErrorRetry>
        <Button variant="secondary" size="sm" onClick={() => navigate("/tareas")}>
          Volver a tareas
        </Button>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex flex-1 items-center justify-center py-20 text-zinc-400">
        <span className="inline-flex items-center gap-2 text-[13px]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-300" />
          Cargando detalle de la tarea…
        </span>
      </div>
    );
  }

  const isClosed = task.status === "Completada" || task.status === "Cancelada";

  const byDate = (a: { createdAt: string }, b: { createdAt: string }) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

  const pureEvents = task.events.filter((e) => e.eventType !== "Comentario");
  const timeline: TaskTimelineItem[] = [
    ...pureEvents.map((e): TaskTimelineItem => ({ kind: "event", data: e, createdAt: e.createdAt })),
    ...task.comments.map((c): TaskTimelineItem => ({ kind: "comment", data: c, createdAt: c.createdAt })),
  ].sort(byDate);

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
    {
      label: `Adjuntos (${task.attachments.length})`,
      active: activeTab === "adjuntos",
      onClick: () => setActiveTab("adjuntos"),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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

            {task.canEdit && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-[15px] w-[15px]" />
                Editar
              </Button>
            )}

            {task.canComplete && (
              <Button
                type="button"
                size="sm"
                onClick={() => setCompleting(true)}
                className="group font-heading font-semibold tracking-[-0.01em] shadow-xs hover:shadow-sm transition-all active:scale-[0.98]"
              >
                <Check className="h-3.5 w-3.5" />
                Completar
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
                {/* ─────────────────────────────────────────────────────────────
                    TAB 1: DATOS / RESUMEN
                ─────────────────────────────────────────────────────────────── */}
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
                            {task.status}
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
                                </div>
                              )}

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
                            <div className="grid grid-cols-3 gap-2 text-center">
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
                                onClick={() => setActiveTab("adjuntos")}
                                className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-2 text-left hover:border-zinc-300 hover:bg-zinc-100/70 transition-colors cursor-pointer group"
                              >
                                <span className="text-[10px] font-heading font-semibold uppercase tracking-wider text-zinc-400 group-hover:text-zinc-600 block">
                                  Adjuntos
                                </span>
                                <span className="font-heading text-[16px] font-bold text-zinc-900 tabular-nums">
                                  {task.attachments.length}
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

                {/* ─────────────────────────────────────────────────────────────
                    TAB 2: NOTAS
                ─────────────────────────────────────────────────────────────── */}
                {activeTab === "notas" && (
                  <div className="space-y-2.5">
                    {task.comments.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-amber-200/80 bg-amber-50/20 px-6 py-8 text-center">
                        <div className="mx-auto flex size-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                          <Lock className="size-4" strokeWidth={2.25} />
                        </div>
                        <p className="mt-2.5 font-heading text-[14px] font-semibold text-zinc-800">
                          Nada anotado todavía
                        </p>
                        <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-zinc-500">
                          Aquí queda lo que el equipo necesita saber sobre el avance de la tarea: cómo fue la llamada, qué
                          se intentó ya, con quién quedó pendiente.
                        </p>
                        {task.canComment && (
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
                          {task.canComment && (
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

                        <div className="space-y-2.5">
                          {task.comments.map((comment) => (
                            <article
                              key={comment.id}
                              className="overflow-hidden rounded-lg border border-amber-200/90 bg-amber-50/30 shadow-2xs"
                            >
                              <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-amber-200/70 px-3.5 py-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  <Avatar name={comment.authorName} seed={comment.authorStaffId} size={24} />
                                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                                    <span
                                      className="truncate text-[12.5px] font-semibold text-zinc-900 leading-tight"
                                      title={comment.authorName}
                                    >
                                      {comment.authorName}
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-200/70 px-1.5 py-0.5 font-heading text-[9.5px] font-bold uppercase leading-none tracking-[0.06em] text-amber-900">
                                      <Lock aria-hidden className="size-2.5" />
                                      Nota interna
                                    </span>
                                    <span aria-hidden className="text-zinc-300">·</span>
                                    <time dateTime={comment.createdAt} className="text-[11px] tabular-nums text-zinc-400">
                                      {formatDateTime(comment.createdAt)}
                                    </time>
                                  </div>
                                </div>
                              </header>

                              <div className="p-3.5 text-[13px] leading-relaxed text-zinc-800">
                                <p className="whitespace-pre-wrap">{comment.comment}</p>
                              </div>
                            </article>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* ─────────────────────────────────────────────────────────────
                    TAB 3: ADJUNTOS
                ─────────────────────────────────────────────────────────────── */}
                {activeTab === "adjuntos" && (
                  <div className="rounded-card border border-line bg-white shadow-card p-6 space-y-6">
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                      <div>
                        <h2 className="font-heading text-[15px] font-bold text-zinc-900">
                          Archivos Adjuntos y Evidencias
                        </h2>
                        <p className="text-[12.5px] text-zinc-500">
                          Documentos, imágenes y respaldos asociados a esta tarea.
                        </p>
                      </div>
                      <span className="inline-flex h-5 items-center rounded-full bg-zinc-100 px-2.5 text-[11px] font-semibold text-zinc-600">
                        {task.attachments.length} {task.attachments.length === 1 ? "archivo" : "archivos"}
                      </span>
                    </div>

                    {uploadError && <Alert variant="error">{uploadError}</Alert>}

                    <TaskEvidenceUpload
                      files={pendingFiles}
                      onFilesChange={setPendingFiles}
                      onReportError={setUploadError}
                      label="Cargar nuevos archivos a la tarea"
                      dropzoneTitle="Haz clic o arrastra archivos para adjuntarlos"
                      dropzoneHint="Soporta imágenes, PDFs, hojas de cálculo o documentos (máx. 10 MB por archivo)"
                    />

                    {pendingFiles.length > 0 && (
                      <div className="flex justify-end gap-2 pt-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setPendingFiles([])}
                          disabled={isUploading}
                        >
                          Limpiar seleccionados
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void handleUploadFiles()}
                          isLoading={isUploading}
                        >
                          <Upload className="h-3.5 w-3.5" />
                          Subir {pendingFiles.length} {pendingFiles.length === 1 ? "archivo" : "archivos"}
                        </Button>
                      </div>
                    )}

                    <div className="pt-4 border-t border-zinc-100">
                      <h3 className="font-heading text-[12px] font-bold uppercase tracking-wider text-zinc-600 mb-3">
                        Archivos ya guardados
                      </h3>
                      {task.attachments.length === 0 ? (
                        <p className="text-[12.5px] text-zinc-400 italic">No hay archivos registrados.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {task.attachments.map((att) => (
                            <div
                              key={att.id}
                              className="flex items-center justify-between gap-3 p-3 rounded-lg border border-zinc-200 bg-white hover:border-zinc-300 transition-all shadow-2xs"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
                                  <FileText className="size-4" />
                                </span>
                                <div className="min-w-0">
                                  <span className="block truncate text-[12.5px] font-bold text-zinc-900" title={att.fileName}>
                                    {att.fileName}
                                  </span>
                                  <span className="block text-[11px] text-zinc-400 tabular-nums">
                                    {formatBytes(att.sizeBytes)} · {att.uploadedByName ?? "Sistema"}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => void openAttachment(att.id, false)}
                                >
                                  <Eye className="size-3" />
                                  Ver
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modales de Edición, Cierre y Cancelación/Reapertura */}
      {editing && (
        <TaskFormModal
          task={task}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setEditing(false);
            setTask(saved);
            receipts.done({
              action: "editar-tarea",
              title: "Tarea actualizada",
              detail: `${saved.number} · ${saved.title}`,
            });
            void load();
          }}
        />
      )}

      {completing && (
        <TaskCompleteModal
          task={task}
          onClose={() => setCompleting(false)}
          onCompleted={(saved) => {
            setCompleting(false);
            setTask(saved);
            receipts.done({
              action: "completar-tarea",
              title: "Tarea completada",
              detail: `${saved.number} quedó registrada como completada.`,
            });
            void load();
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
            void load();
          }}
        />
      )}

      {showNoteModal && (
        <Modal
          maxWidth="max-w-2xl"
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
            if (!submittingComment) setShowNoteModal(false);
          }}
          isExiting={noteModalAnimation.isExiting}
          onRequestClose={noteModalAnimation.requestClose}
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
                  onClick={noteModalAnimation.requestClose}
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
          <div className="space-y-3">
            {commentError && <Alert variant="error">{commentError}</Alert>}
            <textarea
              ref={(el) => {
                noteTextareaRef.current = el;
                if (el) autoResizeTextarea(el, 40);
              }}
              autoFocus
              rows={1}
              value={newComment}
              placeholder="Escribe lo que el equipo deba saber: cómo fue la llamada, qué se intentó ya, con quién quedó pendiente…"
              onChange={(e) => {
                setNewComment(e.target.value);
                if (commentError) setCommentError(null);
                autoResizeTextarea(e.target, 40);
              }}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  void handleSaveNote();
                }
              }}
              className="w-full resize-none overflow-hidden rounded-edge border border-line-strong bg-white px-3 py-2 text-[13px] leading-relaxed text-ink outline-none transition-colors placeholder:text-faint hover:border-hairline-hover focus:border-brand-red focus:ring-3 focus:ring-brand-red/10"
            />
          </div>
        </Modal>
      )}

      {showFullInstructions && (
        <Modal
          title="Instrucciones de la Tarea"
          eyebrow={`${task.number} · Apertura`}
          description={`Registrado por ${task.createdByName} el ${formatDateTime(task.createdAt)}`}
          onClose={() => setShowFullInstructions(false)}
          maxWidth="max-w-2xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-[12px] text-zinc-400">
                Instrucciones completas registradas en la tarea.
              </span>
              <div className="flex items-center gap-2">
                <CopyButton text={task.instructions} label="Copiar texto completo" />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowFullInstructions(false)}
                >
                  Cerrar
                </Button>
              </div>
            </div>
          }
        >
          <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-zinc-200/80 bg-zinc-50/50 p-4">
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-800 selection:bg-brand-red/10">
              {task.instructions}
            </p>
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
