import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, ClipboardList, MessageSquarePlus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, type UseFormRegisterReturn } from "react-hook-form";
import { ApiError } from "../../api/client";
import { tasksApi } from "../../api/tasks";
import { SubmitValidationButton } from "../../components/app/SubmitValidationButton";
import { TaskEvidenceUpload } from "../../components/app/TaskEvidenceUpload";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { SelectField, TextAreaField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { SegmentedTabs } from "../../components/ui/SegmentedTabs";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { autoResizeTextarea } from "../../lib/autoResizeTextarea";
import { buildValidationItems, focusFormField } from "../../lib/validationItems";
import type { TaskDetail } from "../../types/tasks";
import { TASK_STATUS_EDIT_OPTIONS } from "./taskCells";
import {
  taskCommentSchema,
  taskDetailToUpdateRequest,
  taskProgressUpdateSchema,
  type TaskProgressUpdateValues,
} from "./taskSchema";

export type TaskUpdateMode = "progress" | "complete";

interface TaskUpdateModalProps {
  task: TaskDetail;
  onClose: () => void;
  onUpdated: (task: TaskDetail, mode: TaskUpdateMode) => void;
  initialMode?: TaskUpdateMode;
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

function bindAutoResizeTextarea(
  field: UseFormRegisterReturn,
  minHeightPx: number,
  storeRef?: (element: HTMLTextAreaElement | null) => void,
) {
  return {
    name: field.name,
    onBlur: field.onBlur,
    onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      field.onChange(event);
      autoResizeTextarea(event.target, minHeightPx);
    },
    ref: (element: HTMLTextAreaElement | null) => {
      field.ref(element);
      storeRef?.(element);
      autoResizeTextarea(element, minHeightPx);
    },
  };
}

function ModeTabs({
  mode,
  onModeChange,
  showProgress,
  showComplete,
}: {
  mode: TaskUpdateMode;
  onModeChange: (mode: TaskUpdateMode) => void;
  showProgress: boolean;
  showComplete: boolean;
}) {
  if (!showProgress || !showComplete) return null;

  return (
    <SegmentedTabs
      fullWidth
      size="md"
      ariaLabel="Tipo de actualización"
      activeKey={mode}
      items={[
        {
          key: "progress",
          label: (
            <>
              <MessageSquarePlus className="h-3.5 w-3.5 shrink-0" />
              <span>Registrar avance</span>
            </>
          ),
          onClick: () => onModeChange("progress"),
        },
        {
          key: "complete",
          label: (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>Completar tarea</span>
            </>
          ),
          onClick: () => onModeChange("complete"),
        },
      ]}
    />
  );
}

export function TaskUpdateModal({
  task,
  onClose,
  onUpdated,
  initialMode = "progress",
}: TaskUpdateModalProps) {
  const showProgress = task.canComment;
  const showComplete = task.canComplete;
  const defaultMode: TaskUpdateMode =
    initialMode === "complete" && showComplete
      ? "complete"
      : showProgress
        ? "progress"
        : "complete";

  const [mode, setMode] = useState<TaskUpdateMode>(defaultMode);
  const [formError, setFormError] = useState<string | null>(null);
  const [progressFiles, setProgressFiles] = useState<File[]>([]);
  const [completeFiles, setCompleteFiles] = useState<File[]>([]);
  const { isExiting, requestClose } = useModalAnimation();
  const progressTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const completeTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const openStatus =
    task.status === "Pendiente" || task.status === "EnProgreso" ? task.status : "EnProgreso";

  const {
    control: progressControl,
    register: registerProgress,
    handleSubmit: handleProgressSubmit,
    watch: watchProgress,
    formState: { errors: progressErrors, isSubmitting: progressSubmitting },
  } = useForm<TaskProgressUpdateValues>({
    resolver: zodResolver(taskProgressUpdateSchema),
    mode: "onTouched",
    defaultValues: {
      note: "",
      status: openStatus,
    },
  });

  const {
    register: registerComplete,
    handleSubmit: handleCompleteSubmit,
    watch: watchComplete,
    formState: { errors: completeErrors, isSubmitting: completeSubmitting },
  } = useForm<{ comment: string }>({
    resolver: zodResolver(taskCommentSchema),
    mode: "onTouched",
    defaultValues: { comment: "" },
  });

  const progressNote = watchProgress("note") ?? "";
  const completeComment = watchComplete("comment") ?? "";
  const progressNoteField = registerProgress("note");

  const progressMissing = useMemo(
    () =>
      buildValidationItems([
        {
          id: "task-update-note",
          label: "Falta describir el avance o la gestión",
          short: "el registro del avance",
          valid: progressNote.trim().length > 0,
        },
      ]),
    [progressNote],
  );

  const completeMissing = useMemo(
    () =>
      buildValidationItems([
        {
          id: "task-complete-comment",
          label: "Falta el comentario de cierre",
          short: "el comentario",
          valid: completeComment.trim().length > 0,
        },
      ]),
    [completeComment],
  );

  useEffect(() => {
    autoResizeTextarea(progressTextareaRef.current, 52);
  }, [progressNote, mode]);

  useEffect(() => {
    autoResizeTextarea(completeTextareaRef.current, 52);
  }, [completeComment, mode]);

  const busy = progressSubmitting || completeSubmitting;

  async function onProgressSubmit(values: TaskProgressUpdateValues) {
    setFormError(null);
    try {
      await tasksApi.comment(task.id, values.note.trim());

      const nextStatus = values.status;
      if (nextStatus !== task.status) {
        await tasksApi.update(task.id, taskDetailToUpdateRequest(task, nextStatus));
      }

      if (progressFiles.length > 0) {
        const form = new FormData();
        for (const file of progressFiles) form.append("Files", file);
        await tasksApi.addAttachments(task.id, form);
      }

      const saved = await tasksApi.get(task.id);
      onUpdated(saved, "progress");
      requestClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo registrar el avance");
    }
  }

  async function onCompleteSubmit(values: { comment: string }) {
    setFormError(null);
    const form = new FormData();
    form.set("Comment", values.comment.trim());
    for (const file of completeFiles) form.append("Files", file);
    try {
      const saved = await tasksApi.complete(task.id, form);
      onUpdated(saved, "complete");
      requestClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo completar la tarea");
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      if (mode === "progress") void handleProgressSubmit(onProgressSubmit)();
      else void handleCompleteSubmit(onCompleteSubmit)();
    }
  }

  const modalDescription =
    mode === "progress"
      ? "Deja constancia de consultas, mensajes o gestiones intermedias. La tarea sigue abierta hasta que la completes."
      : "El cierre queda sellado con tu usuario y la hora. Después solo se puede reabrir de forma explícita.";

  return (
    <Modal
      maxWidth="max-w-xl"
      eyebrow={task.number}
      title="Actualizar tarea"
      description={modalDescription}
      onClose={onClose}
      isExiting={isExiting}
      onRequestClose={requestClose}
      footer={
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-zinc-400 select-none">
            <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 text-[10px] font-mono text-zinc-500">
              Ctrl
            </kbd>
            <span>+</span>
            <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 text-[10px] font-mono text-zinc-500">
              Enter
            </kbd>
            <span className="ml-0.5">{mode === "complete" ? "para completar" : "para guardar"}</span>
          </span>
          <div className="flex items-center gap-2 ml-auto w-full sm:w-auto justify-end">
            <Button type="button" variant="secondary" size="sm" onClick={requestClose} disabled={busy}>
              Cancelar
            </Button>
            {mode === "progress" ? (
              <SubmitValidationButton
                formId="task-progress-form"
                ready={progressMissing.length === 0}
                busy={progressSubmitting}
                missingItems={progressMissing}
                onFocusField={focusFormField}
                hintText="Para registrar el avance, completa lo siguiente:"
              >
                Guardar avance
              </SubmitValidationButton>
            ) : (
              <SubmitValidationButton
                formId="task-complete-form"
                ready={completeMissing.length === 0}
                busy={completeSubmitting}
                missingItems={completeMissing}
                onFocusField={focusFormField}
                hintText="Para completar la tarea, completa lo siguiente:"
                className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white border-emerald-600"
              >
                Completar tarea
              </SubmitValidationButton>
            )}
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3 text-left">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded bg-zinc-200/80 text-zinc-600">
              <ClipboardList className="size-3" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-heading text-[13px] font-semibold text-zinc-900 leading-tight">{task.title}</p>
              {task.instructions && (
                <p className="mt-1 text-[12px] text-zinc-600 line-clamp-2 whitespace-pre-line">
                  {task.instructions}
                </p>
              )}
            </div>
          </div>
        </div>

        <ModeTabs
          mode={mode}
          onModeChange={setMode}
          showProgress={showProgress}
          showComplete={showComplete}
        />

        {formError && <Alert variant="error">{formError}</Alert>}

        {mode === "progress" && showProgress ? (
          <form
            id="task-progress-form"
            onSubmit={handleProgressSubmit(onProgressSubmit)}
            onKeyDown={handleKeyDown}
            noValidate
            className="flex flex-col gap-3"
          >
            <Controller
              control={progressControl}
              name="status"
              render={({ field }) => (
                <SelectField
                  id="task-update-status"
                  size="sm"
                  label="Estado de la tarea"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  options={TASK_STATUS_EDIT_OPTIONS}
                />
              )}
            />

            <TextAreaField
              id="task-update-note"
              label="Qué hiciste o qué quedó pendiente"
              required
              rows={1}
              maxLength={4000}
              placeholder="Ej.: Envié correo pidiendo el número de lote; quedo a la espera de respuesta antes del viernes…"
              className="min-h-0 resize-none overflow-hidden text-[12.5px] py-2 leading-relaxed [field-sizing:content]"
              error={progressErrors.note?.message}
              hint={
                progressNote.length > 0 ? (
                  <span
                    className={`block text-right text-[11px] tabular-nums text-zinc-400 ${progressNote.length > 3800 ? "text-brand-red font-medium" : ""}`}
                  >
                    {progressNote.length} / 4000
                  </span>
                ) : undefined
              }
              {...bindAutoResizeTextarea(progressNoteField, 52, (el) => {
                progressTextareaRef.current = el;
              })}
            />

            <TaskEvidenceUpload
              files={progressFiles}
              onFilesChange={setProgressFiles}
              onReportError={setFormError}
              label="Adjuntos (opcional)"
              dropzoneTitle="Adjuntar archivos"
              dropzoneHint="Máx. 10 MB por archivo"
            />
          </form>
        ) : showComplete ? (
          <form
            id="task-complete-form"
            onSubmit={handleCompleteSubmit(onCompleteSubmit)}
            onKeyDown={handleKeyDown}
            noValidate
            className="flex flex-col gap-3"
          >
            <FormDivider title="Resolución" />

            <TextAreaField
              id="task-complete-comment"
              label="Comentario de cierre"
              required
              rows={1}
              maxLength={4000}
              placeholder="Escribe qué se ejecutó, el resultado obtenido y cómo quedó la tarea…"
              className="min-h-0 resize-none overflow-hidden text-[12.5px] py-2 leading-relaxed [field-sizing:content]"
              error={completeErrors.comment?.message}
              hint={
                completeComment.length > 0 ? (
                  <span
                    className={`block text-right text-[11px] tabular-nums text-zinc-400 ${completeComment.length > 3800 ? "text-brand-red font-medium" : ""}`}
                  >
                    {completeComment.length} / 4000
                  </span>
                ) : undefined
              }
              {...bindAutoResizeTextarea(registerComplete("comment"), 52, (el) => {
                completeTextareaRef.current = el;
              })}
            />

            <FormDivider title="Evidencias y respaldos" />

            <TaskEvidenceUpload
              files={completeFiles}
              onFilesChange={setCompleteFiles}
              onReportError={setFormError}
              label="Evidencias (opcional)"
              dropzoneTitle="Adjuntar archivos"
              dropzoneHint="Máx. 10 MB por archivo"
            />
          </form>
        ) : null}
      </div>
    </Modal>
  );
}
