import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpRight, Paperclip } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { ApiError } from "../../api/client";
import { tasksApi } from "../../api/tasks";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { TaskEvidenceUpload } from "../../components/app/TaskEvidenceUpload";
import { Alert } from "../../components/ui/Alert";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { ErrorRetry } from "../../components/ui/ErrorRetry";
import { TextAreaField } from "../../components/ui/Field";
import { formatBytes, formatDateTime } from "../../lib/format";
import { PriorityCell } from "../tickets/ticketCells";
import type { TaskDetail, TaskEventType } from "../../types/tasks";
import { TaskCompleteModal } from "./TaskCompleteModal";
import { TaskFormModal } from "./TaskFormModal";
import { TaskReasonModal } from "./TaskReasonModal";
import { TaskStatusCell } from "./taskCells";
import { taskCommentSchema } from "./taskSchema";

const eventLabel: Record<TaskEventType, string> = {
  Creacion: "Creación",
  Asignacion: "Asignación",
  CambioEstado: "Cambio de estado",
  Comentario: "Comentario",
  AdjuntoSubido: "Archivo",
  Completada: "Completada",
  Reabierta: "Reabierta",
  Cancelada: "Cancelada",
};

function formatDue(value: string | null) {
  if (!value) return "Sin fecha límite";
  return new Date(value).toLocaleDateString("es-DO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-heading text-[10.5px] font-semibold uppercase tracking-[0.06em] text-zinc-400">{label}</span>
      <div className="text-[13px] text-zinc-800">{children}</div>
    </div>
  );
}

export function TaskDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [reason, setReason] = useState<"cancel" | "reopen" | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const commentForm = useForm<{ comment: string }>({
    resolver: zodResolver(taskCommentSchema),
    mode: "onTouched",
    defaultValues: { comment: "" },
  });

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

  async function submitComment(values: { comment: string }) {
    if (!task) return;
    try {
      await tasksApi.comment(task.id, values.comment.trim());
      commentForm.reset();
      await load();
    } catch (err) {
      commentForm.setError("root", { message: err instanceof ApiError ? err.message : "No se pudo guardar el comentario" });
    }
  }

  async function uploadFiles() {
    if (!task || files.length === 0) return;
    setUploading(true);
    setFileError(null);
    const form = new FormData();
    for (const file of files) form.append("Files", file);
    try {
      setTask(await tasksApi.addAttachments(task.id, form));
      setFiles([]);
    } catch (err) {
      setFileError(err instanceof ApiError ? err.message : "No se pudieron adjuntar los archivos");
    } finally {
      setUploading(false);
    }
  }

  async function openAttachment(attachmentId: number, download: boolean) {
    if (!task) return;
    const link = await tasksApi.attachmentLink(task.id, attachmentId, download);
    window.open(link.url, "_blank", "noopener,noreferrer");
  }

  if (!Number.isFinite(id)) {
    return <Alert variant="error">La tarea no existe.</Alert>;
  }

  return (
    <>
      <ModuleHeader
        backTo="/tareas"
        backLabel="Volver a tareas"
        title={task?.number ?? "Tarea"}
        summary={task?.title}
        badge={task ? <TaskStatusCell status={task.status} /> : undefined}
        action={
          task && (
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {task.canEdit && (
                <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                  Editar
                </Button>
              )}
              {task.canComplete && (
                <Button size="sm" onClick={() => setCompleting(true)}>
                  Completar
                </Button>
              )}
              {task.canCancel && (
                <Button variant="danger" size="sm" onClick={() => setReason("cancel")}>
                  Cancelar
                </Button>
              )}
              {task.canReopen && (
                <Button size="sm" onClick={() => setReason("reopen")}>
                  Reabrir
                </Button>
              )}
            </div>
          )
        }
      />

      {error && <ErrorRetry className="mb-3" onRetry={() => void load()}>{error}</ErrorRetry>}

      {task && (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-4">
            <section className="rounded-card border border-line bg-white p-4 shadow-card">
              <h2 className="font-heading text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                Instrucciones
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed text-zinc-800">{task.instructions}</p>
              {task.completionComment && (
                <div className="mt-4 rounded-md border border-emerald-200/80 bg-emerald-50/70 p-3">
                  <p className="font-heading text-[10.5px] font-semibold uppercase tracking-[0.06em] text-emerald-700">
                    Cierre · {task.completedByName} · {task.completedAt ? formatDateTime(task.completedAt) : ""}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-emerald-950">{task.completionComment}</p>
                </div>
              )}
              {task.cancelReason && (
                <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3">
                  <p className="font-heading text-[10.5px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
                    Cancelación · {task.cancelledByName}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-700">{task.cancelReason}</p>
                </div>
              )}
            </section>

            <section className="rounded-card border border-line bg-white p-4 shadow-card">
              <h2 className="font-heading text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                Historial
              </h2>
              <ol className="mt-3 flex flex-col">
                {task.events.map((event, index) => (
                  <li key={event.id} className="grid grid-cols-[16px_minmax(0,1fr)] gap-3">
                    <div className="flex flex-col items-center">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-red" />
                      {index < task.events.length - 1 && <span className="w-px flex-1 bg-zinc-200" />}
                    </div>
                    <div className={index < task.events.length - 1 ? "pb-4" : ""}>
                      <p className="text-[13px] font-medium text-zinc-900">
                        {eventLabel[event.eventType]}
                        <span className="ml-2 font-normal text-zinc-500">{event.actorName}</span>
                      </p>
                      <p className="text-[11.5px] text-zinc-400">{formatDateTime(event.createdAt)}</p>
                      <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-zinc-700">{event.details}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section className="rounded-card border border-line bg-white p-4 shadow-card">
              <h2 className="font-heading text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                Comentarios
              </h2>
              {task.comments.length === 0 ? (
                <p className="mt-2 text-[13px] text-zinc-400">Todavía no hay notas de seguimiento.</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-3">
                  {task.comments.map((comment) => (
                    <li key={comment.id} className="flex gap-2.5">
                      <Avatar name={comment.authorName} seed={comment.authorStaffId} size={28} />
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-medium text-zinc-900">
                          {comment.authorName}
                          <span className="ml-2 font-normal text-zinc-400">{formatDateTime(comment.createdAt)}</span>
                        </p>
                        <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-700">{comment.comment}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {task.canComment && (
                <form onSubmit={commentForm.handleSubmit(submitComment)} className="mt-4 flex flex-col gap-2" noValidate>
                  {commentForm.formState.errors.root && (
                    <Alert variant="error">{commentForm.formState.errors.root.message}</Alert>
                  )}
                  <TextAreaField
                    label="Nota de seguimiento"
                    rows={3}
                    maxLength={4000}
                    placeholder="Algo que quien continúe la tarea deba saber"
                    error={commentForm.formState.errors.comment?.message}
                    {...commentForm.register("comment")}
                  />
                  <div className="flex justify-end">
                    <Button type="submit" size="sm" isLoading={commentForm.formState.isSubmitting}>
                      Agregar comentario
                    </Button>
                  </div>
                </form>
              )}
            </section>
          </div>

          <aside className="flex flex-col gap-4">
            <section className="rounded-card border border-line bg-white p-4 shadow-card">
              <div className="grid grid-cols-1 gap-3">
                <Fact label="Prioridad"><PriorityCell priority={task.priority} /></Fact>
                <Fact label="Estado"><TaskStatusCell status={task.status} /></Fact>
                <Fact label="Departamento">{task.departmentName}</Fact>
                <Fact label="Asignado a">
                  {task.assignedStaffName ? (
                    <span className="inline-flex items-center gap-2">
                      <Avatar name={task.assignedStaffName} seed={task.assignedStaffId ?? task.id} size={22} />
                      {task.assignedStaffName}
                    </span>
                  ) : (
                    "Sin asignar"
                  )}
                </Fact>
                <Fact label="Cliente">{task.clientName ?? "—"}</Fact>
                <Fact label="Contacto">{task.contactName ?? "—"}</Fact>
                <Fact label="Fecha límite">
                  <span className={task.isOverdue ? "font-medium text-red-700" : ""}>
                    {formatDue(task.dueDate)}
                    {task.isOverdue ? " · Vencida" : ""}
                  </span>
                </Fact>
                <Fact label="Origen">{task.origin === "Correo" ? "Correo" : "Manual"}</Fact>
                {task.emailId != null && (
                  <Fact label="Correo de origen">
                    <Link
                      to={`/bandeja?correo=${task.emailId}`}
                      className="inline-flex items-center gap-1 text-brand-red hover:underline"
                    >
                      {task.emailSubject || "Abrir correo"}
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </Fact>
                )}
                <Fact label="Creada por">
                  {task.createdByName}
                  <span className="mt-0.5 block text-[12px] text-zinc-400">{formatDateTime(task.createdAt)}</span>
                </Fact>
              </div>
            </section>

            <section className="rounded-card border border-line bg-white p-4 shadow-card">
              <h2 className="font-heading text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                Archivos
              </h2>
              {task.attachments.length === 0 ? (
                <p className="mt-2 text-[13px] text-zinc-400">Sin archivos.</p>
              ) : (
                <ul className="mt-2 flex flex-col">
                  {task.attachments.map((file) => (
                    <li key={file.id} className="border-b border-zinc-100 py-2 last:border-0">
                      <button
                        type="button"
                        onClick={() => void openAttachment(file.id, false)}
                        className="flex w-full items-start gap-2 text-left"
                      >
                        <Paperclip className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
                        <span className="min-w-0">
                          <span className="block truncate text-[12.5px] font-medium text-zinc-800">{file.fileName}</span>
                          <span className="text-[11px] text-zinc-400">
                            {file.kind === "Evidencia" ? "Evidencia" : file.kind === "Inicial" ? "Inicial" : "Seguimiento"}
                            {" · "}
                            {formatBytes(file.sizeBytes)}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {task.canComment && (
                <div className="mt-3 flex flex-col gap-2">
                  {fileError && <Alert variant="error">{fileError}</Alert>}
                  <TaskEvidenceUpload
                    files={files}
                    onFilesChange={setFiles}
                    onReportError={setFileError}
                    label="Agregar en seguimiento"
                    dropzoneTitle="Adjuntar archivo"
                    dropzoneHint="Queda en el historial de la tarea."
                  />
                  {files.length > 0 && (
                    <Button size="sm" onClick={() => void uploadFiles()} isLoading={uploading}>
                      Subir archivos
                    </Button>
                  )}
                </div>
              )}
            </section>
          </aside>
        </div>
      )}

      {editing && task && (
        <TaskFormModal
          task={task}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setTask(saved);
            setEditing(false);
          }}
        />
      )}
      {completing && task && (
        <TaskCompleteModal
          task={task}
          onClose={() => setCompleting(false)}
          onCompleted={(saved) => {
            setTask(saved);
            setCompleting(false);
          }}
        />
      )}
      {reason && task && (
        <TaskReasonModal
          task={task}
          mode={reason}
          onClose={() => setReason(null)}
          onSaved={(saved) => {
            setTask(saved);
            setReason(null);
          }}
        />
      )}
    </>
  );
}
