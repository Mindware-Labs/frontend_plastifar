import {
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Plus,
  RotateCcw,
  Send,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ticketsApi } from "../../api/tickets";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { FilterChip } from "../../components/ui/FilterChip";
import { Spinner } from "../../components/ui/Spinner";
import { Toast } from "../../components/ui/Toast";
import { formatBytes, formatDateTime } from "../../lib/format";
import type {
  CreateTicketTaskRequest,
  TicketStaffOptionResponse,
  TicketTaskAttachmentResponse,
  TicketTaskResponse,
} from "../../types/api";
import { CompleteTaskModal } from "./CompleteTaskModal";
import { CreateTaskModal } from "./CreateTaskModal";

interface TicketTasksTabProps {
  ticketId: number;
  isClosed: boolean;
  assignableStaff: TicketStaffOptionResponse[];
  currentStaffId: number;
  onTasksCountChanged?: (count: number) => void;
}

type TaskFilter = "all" | "pending" | "completed" | "mine";

export function TicketTasksTab({
  ticketId,
  isClosed,
  assignableStaff,
  currentStaffId,
  onTasksCountChanged,
}: TicketTasksTabProps) {
  const currentStaff = assignableStaff.find((s) => s.id === currentStaffId);
  const [tasks, setTasks] = useState<TicketTaskResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TaskFilter>("all");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState<TicketTaskResponse | null>(null);
  const [reopeningId, setReopeningId] = useState<number | null>(null);
  const [expandedCommentsTaskId, setExpandedCommentsTaskId] = useState<number | null>(null);
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});
  const [sendingCommentTaskId, setSendingCommentTaskId] = useState<number | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ticketsApi.getTasks(ticketId);
      setTasks(data);
      onTasksCountChanged?.(data.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar las tareas.");
    } finally {
      setLoading(false);
    }
  }, [ticketId, onTasksCountChanged]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const handleCreateTask = async (taskData: CreateTicketTaskRequest) => {
    const created = await ticketsApi.createTask(ticketId, taskData);
    setTasks((prev) => [created, ...prev]);
    onTasksCountChanged?.(tasks.length + 1);
  };

  const handleCompleteTask = async (taskId: number, formData: FormData) => {
    const updated = await ticketsApi.completeTask(ticketId, taskId, formData);
    setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
  };

  const handleReopenTask = async (taskId: number) => {
    try {
      setReopeningId(taskId);
      const updated = await ticketsApi.reopenTask(ticketId, taskId);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    } catch (err) {
      setToastError(err instanceof Error ? err.message : "Error al reabrir la tarea.");
    } finally {
      setReopeningId(null);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm("¿Seguro que deseas eliminar esta tarea? Se eliminarán también sus evidencias asociadas.")) {
      return;
    }
    try {
      await ticketsApi.deleteTask(ticketId, taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      onTasksCountChanged?.(tasks.length - 1);
    } catch (err) {
      setToastError(err instanceof Error ? err.message : "Error al eliminar la tarea.");
    }
  };

  const handleAddComment = async (taskId: number) => {
    const text = (commentInputs[taskId] ?? "").trim();
    if (!text || sendingCommentTaskId === taskId) return;
    try {
      setSendingCommentTaskId(taskId);
      const newComment = await ticketsApi.addTaskComment(ticketId, taskId, { comment: text });
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, comments: [...t.comments, newComment] } : t)),
      );
      setCommentInputs((prev) => ({ ...prev, [taskId]: "" }));
    } catch (err) {
      setToastError(err instanceof Error ? err.message : "Error al agregar comentario.");
    } finally {
      setSendingCommentTaskId(null);
    }
  };

  const handleOpenEvidenceFile = async (taskId: number, att: TicketTaskAttachmentResponse) => {
    try {
      const link = await ticketsApi.taskAttachmentLink(ticketId, taskId, att.id, false);
      if (link.url) {
        window.open(link.url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      setToastError(err instanceof Error ? err.message : "Error al abrir el archivo.");
    }
  };

  const pendingTasks = tasks.filter((t) => t.status !== "Completada" && t.status !== "Cancelada");
  const completedTasks = tasks.filter((t) => t.status === "Completada");
  const myTasks = tasks.filter((t) => t.assignedStaffId === currentStaffId);

  const filteredTasks = tasks.filter((t) => {
    if (filter === "pending") return t.status !== "Completada" && t.status !== "Cancelada";
    if (filter === "completed") return t.status === "Completada";
    if (filter === "mine") return t.assignedStaffId === currentStaffId;
    return true;
  });

  return (
    <div className="mt-3.5 space-y-3.5">
      {/* Barra de control superior */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip
            label="Todas"
            count={tasks.length}
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          <FilterChip
            label="Pendientes"
            count={pendingTasks.length}
            active={filter === "pending"}
            onClick={() => setFilter("pending")}
          />
          <FilterChip
            label="Completadas"
            count={completedTasks.length}
            active={filter === "completed"}
            onClick={() => setFilter("completed")}
          />
          <FilterChip
            label="Mis tareas"
            count={myTasks.length}
            active={filter === "mine"}
            onClick={() => setFilter("mine")}
          />
        </div>

        <Button
          type="button"
          size="sm"
          onClick={() => setShowCreateModal(true)}
          disabled={isClosed}
          title={isClosed ? "No se pueden crear tareas en un ticket cerrado." : undefined}
        >
          <Plus className="h-[14px] w-[14px]" />
          Nueva tarea
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-zinc-400">
          <Spinner className="size-5 text-brand-red" />
          <span className="ml-2.5 text-[13px]">Cargando tareas...</span>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
          {error}
        </div>
      ) : tasks.length === 0 ? (
        /* Empty state cuando no hay ninguna tarea */
        <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50 px-6 py-8 text-center">
          <div className="mx-auto flex size-9 items-center justify-center rounded-lg bg-brand-red/10 text-brand-red">
            <CheckSquare className="size-4" strokeWidth={2.25} />
          </div>
          <p className="mt-2.5 font-heading text-[14px] font-semibold text-zinc-800">
            No hay tareas en este ticket
          </p>
          <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-zinc-500">
            Asigna acciones a colaboradores o a ti mismo para investigar el caso, contactar a fábrica o
            verificar inventario con evidencia documentada.
          </p>
          {!isClosed && (
            <Button
              type="button"
              size="sm"
              onClick={() => setShowCreateModal(true)}
              className="mt-4"
            >
              <Plus className="h-[14px] w-[14px]" />
              Crear primera tarea
            </Button>
          )}
        </div>
      ) : filteredTasks.length === 0 ? (
        /* Empty state cuando el filtro no tiene coincidencias */
        <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center text-[12.5px] text-zinc-500">
          No hay tareas en la categoría seleccionada ({filter}).
        </div>
      ) : (
        /* Listado de tarjetas de tareas */
        <div className="space-y-3">
          {filteredTasks.map((task) => {
            const isCompleted = task.status === "Completada";
            const isAssignedToMe = task.assignedStaffId === currentStaffId;
            const isCommentsExpanded = expandedCommentsTaskId === task.id;
            const isPastDue =
              !isCompleted &&
              task.dueDate &&
              new Date(task.dueDate).getTime() < new Date().getTime();

            return (
              <div
                key={task.id}
                className={`group rounded-xl border transition-all duration-150 p-4 ${
                  isCompleted
                    ? "border-emerald-200/80 bg-emerald-50/15"
                    : "border-zinc-200 bg-white hover:border-zinc-300 shadow-2xs"
                }`}
              >
                {/* Cabecera: Checkbox, Título, Badges y Acciones */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    {/* Botón interactivo de estado / Checkbox */}
                    {isCompleted ? (
                      <button
                        type="button"
                        onClick={() => void handleReopenTask(task.id)}
                        disabled={isClosed || reopeningId === task.id}
                        title="Tarea completada. Haz clic para reabrir"
                        className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white shadow-2xs transition-transform active:scale-90 cursor-pointer"
                      >
                        <Check className="size-3.5 stroke-[2.5]" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setTaskToComplete(task)}
                        disabled={isClosed}
                        title="Marcar como completada y adjuntar evidencia"
                        className="group/btn mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border-2 border-zinc-300 bg-white transition-all hover:border-emerald-600 hover:bg-emerald-50 cursor-pointer active:scale-90"
                      >
                        <Check className="size-3.5 text-transparent transition-colors group-hover/btn:text-emerald-600 stroke-[2.5]" />
                      </button>
                    )}

                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4
                          className={`font-heading text-[13.5px] font-semibold tracking-tight ${
                            isCompleted ? "text-zinc-500 line-through" : "text-zinc-900"
                          }`}
                        >
                          {task.title}
                        </h4>

                        {/* Status Badge */}
                        {isCompleted ? (
                          <Badge tone="completed">Completada</Badge>
                        ) : task.status === "EnProgreso" ? (
                          <Badge tone="amber">En progreso</Badge>
                        ) : (
                          <Badge tone="neutral">Pendiente</Badge>
                        )}

                        {/* Due date tag */}
                        {task.dueDate && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium tabular-nums ${
                              isPastDue
                                ? "border border-red-200 bg-red-50/80 text-brand-red font-semibold"
                                : "border border-zinc-200/80 bg-zinc-50 text-zinc-600"
                            }`}
                            title={`Fecha límite: ${formatDateTime(task.dueDate)}`}
                          >
                            <Calendar className="size-3" />
                            <span>{isPastDue ? "Venció:" : "Vence:"}</span>
                            <span className="font-semibold">
                              {formatDateTime(task.dueDate).split(",")[0]}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Acciones de la cabecera */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isCompleted ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => void handleReopenTask(task.id)}
                        disabled={isClosed || reopeningId === task.id}
                        title="Reabrir esta tarea para continuar trabajando en ella"
                        className="h-7 text-[11.5px]"
                      >
                        <RotateCcw className="size-3 mr-1" />
                        {reopeningId === task.id ? "Reabriendo..." : "Reabrir"}
                      </Button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setTaskToComplete(task)}
                        disabled={isClosed}
                        className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/90 px-2.5 text-[11.5px] font-semibold text-emerald-700 shadow-2xs transition-colors hover:bg-emerald-100 hover:border-emerald-300 active:scale-95 cursor-pointer disabled:opacity-50"
                        title="Marcar tarea como completada"
                      >
                        <Check className="size-3.5 stroke-[2.5]" />
                        <span>Completar</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => void handleDeleteTask(task.id)}
                      title="Eliminar tarea"
                      className="flex size-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-red-600 transition-colors cursor-pointer active:scale-95"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>

                {/* Descripción con ancho completo alineada al texto del título */}
                {task.description && (
                  <div className="mt-2 ml-7.5">
                    <p className="text-[12.5px] leading-relaxed text-zinc-600 whitespace-pre-line">
                      {task.description}
                    </p>
                  </div>
                )}

                {/* Sección de resolución y evidencia cuando está completada */}
                {isCompleted && (
                  <div className="mt-3 ml-7.5 rounded-lg border border-emerald-200/80 bg-white p-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-emerald-800">
                      <CheckCircle2 className="size-3.5 text-emerald-600" />
                      <span>
                        Completada por <strong className="font-semibold">{task.completedByStaffName ?? "Colaborador"}</strong>
                        {task.completedAt && ` el ${formatDateTime(task.completedAt)}`}
                      </span>
                    </div>

                    {/* Comentario de resolución */}
                    {task.completionComment && (
                      <div className="rounded-md border border-zinc-200/80 bg-zinc-50/80 p-2.5 text-[12px] text-zinc-700 leading-relaxed">
                        &ldquo;{task.completionComment}&rdquo;
                      </div>
                    )}

                    {/* Evidencias adjuntas */}
                    {task.attachments.length > 0 && (
                      <div className="pt-1">
                        <p className="font-heading text-[10.5px] font-bold uppercase tracking-[0.06em] text-zinc-500 mb-1.5">
                          Archivos de evidencia ({task.attachments.length}):
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {task.attachments.map((att) => {
                            const isImg = att.contentType.startsWith("image/");
                            return (
                              <button
                                key={att.id}
                                type="button"
                                onClick={() => void handleOpenEvidenceFile(task.id, att)}
                                title={`Abrir evidencia: ${att.fileName}`}
                                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11.5px] font-medium text-zinc-800 transition-colors hover:border-zinc-300 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-brand-red/25"
                              >
                                {isImg ? (
                                  <ImageIcon className="size-3 text-brand-red" />
                                ) : (
                                  <FileText className="size-3 text-zinc-500" />
                                )}
                                <span className="truncate max-w-[150px]">{att.fileName}</span>
                                <span className="text-[10px] text-zinc-400 tabular-nums">
                                  ({formatBytes(att.sizeBytes)})
                                </span>
                                <Eye className="size-3 text-zinc-400 ml-0.5" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Barra de pie: Asignado, Creador y botón de comentarios */}
                <div className="mt-3 ml-7.5 pt-2.5 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
                  {/* Metadatos: Asignado y Creador */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-zinc-500">
                    {/* Asignado */}
                    <div className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200/80 bg-zinc-50/80 px-2 py-0.5 text-[11.5px]">
                      <span className="text-[10.5px] font-medium text-zinc-400">Asignada a:</span>
                      {task.assignedStaffName && task.assignedStaffId ? (
                        <div className="inline-flex items-center gap-1.5 font-medium text-zinc-800">
                          <Avatar name={task.assignedStaffName} seed={task.assignedStaffId} size={15} />
                          <span className="truncate max-w-[150px]">{task.assignedStaffName}</span>
                          {isAssignedToMe && (
                            <span className="rounded bg-brand-red/10 px-1 py-0.2 font-heading text-[9px] font-bold text-brand-red">
                              Tú
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="italic text-zinc-400">Sin asignar</span>
                      )}
                    </div>

                    <span aria-hidden className="text-zinc-300">·</span>

                    {/* Creador */}
                    <div className="text-[11px] text-zinc-500">
                      <span>Por </span>
                      <strong className="font-semibold text-zinc-700">{task.createdByStaffName}</strong>
                      <span className="text-zinc-400"> ({formatDateTime(task.createdAt)})</span>
                    </div>
                  </div>

                  {/* Toggle de Comentarios */}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedCommentsTaskId(isCommentsExpanded ? null : task.id)
                    }
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11.5px] font-medium transition-all cursor-pointer shadow-2xs select-none active:scale-95 ${
                      isCommentsExpanded
                        ? "border-zinc-300 bg-zinc-100 text-zinc-900 font-semibold"
                        : task.comments.length > 0
                          ? "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
                          : "border-zinc-200/80 bg-zinc-50/70 text-zinc-500 hover:border-zinc-300 hover:bg-white hover:text-zinc-800"
                    }`}
                  >
                    <MessageSquare className="size-3.5 text-zinc-400" />
                    <span>
                      {task.comments.length === 0
                        ? "Comentar"
                        : `${task.comments.length} ${
                            task.comments.length === 1 ? "comentario" : "comentarios"
                          }`}
                    </span>
                    {task.comments.length > 0 && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-zinc-200/80 px-1 text-[9.5px] font-bold text-zinc-700 tabular-nums">
                        {task.comments.length}
                      </span>
                    )}
                    {isCommentsExpanded ? (
                      <ChevronUp className="size-3 text-zinc-400" />
                    ) : (
                      <ChevronDown className="size-3 text-zinc-400" />
                    )}
                  </button>
                </div>

                {/* Hilo de comentarios expandido */}
                {isCommentsExpanded && (
                  <div className="mt-3 ml-7.5 rounded-xl border border-zinc-200/90 bg-zinc-50/50 p-3.5 space-y-3">
                    {/* Cabecera del hilo de comentarios */}
                    <div className="flex items-center justify-between pb-1 border-b border-zinc-200/60">
                      <div className="flex items-center gap-1.5 font-heading text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                        <MessageSquare className="size-3.5 text-zinc-400" />
                        <span>Comentarios y seguimiento ({task.comments.length})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedCommentsTaskId(null)}
                        className="text-[11px] font-medium text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
                      >
                        Ocultar
                      </button>
                    </div>

                    {/* Lista de comentarios existentes */}
                    {task.comments.length > 0 ? (
                      <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                        {task.comments.map((c) => {
                          const isMyComment = c.authorStaffId === currentStaffId;
                          return (
                            <div
                              key={c.id}
                              className="rounded-lg border border-zinc-200/80 bg-white p-3 shadow-2xs transition-colors"
                            >
                              <div className="flex items-center justify-between gap-2 text-[11.5px]">
                                <div className="flex items-center gap-1.5 font-medium text-zinc-800">
                                  <Avatar name={c.authorStaffName} seed={c.authorStaffId} size={18} />
                                  <span className="font-semibold text-zinc-900">{c.authorStaffName}</span>
                                  {isMyComment && (
                                    <span className="rounded bg-zinc-100 px-1 py-0.2 font-heading text-[9px] font-bold text-zinc-600">
                                      Tú
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10.5px] text-zinc-400 tabular-nums">
                                  {formatDateTime(c.createdAt)}
                                </span>
                              </div>
                              <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-700 whitespace-pre-wrap">
                                {c.comment}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-3 text-center rounded-lg border border-dashed border-zinc-200 bg-white/70">
                        <MessageSquare className="size-4 text-zinc-300 mb-1" />
                        <p className="text-[12px] text-zinc-500 font-medium">Aún no hay comentarios en esta tarea</p>
                        <p className="text-[11px] text-zinc-400">Deja una nota o actualización sobre el progreso de esta tarea.</p>
                      </div>
                    )}

                    {/* Formulario para nuevo comentario */}
                    <div className="rounded-lg border border-zinc-200 bg-white p-2.5 shadow-2xs focus-within:border-brand-red focus-within:ring-2 focus-within:ring-brand-red/15 transition-all">
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 shrink-0">
                          <Avatar
                            name={currentStaff?.fullName ?? "Usuario"}
                            seed={currentStaffId}
                            size={22}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <textarea
                            rows={2}
                            autoFocus
                            placeholder="Escribe un comentario o actualización sobre esta tarea..."
                            value={commentInputs[task.id] ?? ""}
                            onChange={(e) =>
                              setCommentInputs((prev) => ({ ...prev, [task.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                void handleAddComment(task.id);
                              }
                            }}
                            className="w-full resize-none bg-transparent text-[12.5px] leading-relaxed text-zinc-800 outline-none placeholder:text-zinc-400"
                          />
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-2 text-[11px]">
                            <span className="text-[10.5px] text-zinc-400">
                              <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1 py-0.5 font-mono text-[9px] text-zinc-500">
                                Enter
                              </kbd>{" "}
                              para enviar ·{" "}
                              <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1 py-0.5 font-mono text-[9px] text-zinc-500">
                                Shift+Enter
                              </kbd>{" "}
                              nueva línea
                            </span>
                            <div className="flex items-center gap-1.5 ml-auto">
                              {(commentInputs[task.id] ?? "").trim() && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCommentInputs((prev) => ({ ...prev, [task.id]: "" }))
                                  }
                                  className="h-7 rounded-md px-2 text-[11px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors cursor-pointer"
                                >
                                  Limpiar
                                </button>
                              )}
                              <Button
                                type="button"
                                size="sm"
                                disabled={
                                  !(commentInputs[task.id] ?? "").trim() ||
                                  sendingCommentTaskId === task.id
                                }
                                onClick={() => void handleAddComment(task.id)}
                              >
                                {sendingCommentTaskId === task.id ? (
                                  <>
                                    <Loader2 className="size-3 animate-spin mr-1.5" />
                                    <span>Enviando...</span>
                                  </>
                                ) : (
                                  <>
                                    <Send className="size-3 mr-1.5" />
                                    <span>Comentar</span>
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modales */}
      <CreateTaskModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateTask}
        assignableStaff={assignableStaff}
        currentStaffId={currentStaffId}
      />

      <CompleteTaskModal
        task={taskToComplete}
        open={Boolean(taskToComplete)}
        onClose={() => setTaskToComplete(null)}
        onComplete={handleCompleteTask}
      />

      <Toast message={toastError} variant="error" onDismiss={() => setToastError(null)} />
    </div>
  );
}
