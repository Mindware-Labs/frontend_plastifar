import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { ApiError } from "../../api/client";
import { tasksApi } from "../../api/tasks";
import { TaskEvidenceUpload } from "../../components/app/TaskEvidenceUpload";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { TextAreaField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { autoResizeTextarea } from "../../lib/autoResizeTextarea";
import type { TaskDetail } from "../../types/tasks";
import { taskCommentSchema } from "./taskSchema";

interface TaskCompleteModalProps {
  task: TaskDetail;
  onClose: () => void;
  onCompleted: (task: TaskDetail) => void;
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

export function TaskCompleteModal({ task, onClose, onCompleted }: TaskCompleteModalProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const { isExiting, requestClose } = useModalAnimation();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<{ comment: string }>({
    resolver: zodResolver(taskCommentSchema),
    mode: "onTouched",
    defaultValues: { comment: "" },
  });

  const comment = watch("comment") ?? "";
  const commentField = register("comment");

  useEffect(() => {
    if (textareaRef.current) {
      autoResizeTextarea(textareaRef.current, 52);
    }
  }, [comment]);

  async function onSubmit(values: { comment: string }) {
    setFormError(null);
    const form = new FormData();
    form.set("Comment", values.comment.trim());
    for (const file of files) form.append("Files", file);
    try {
      const saved = await tasksApi.complete(task.id, form);
      onCompleted(saved);
      requestClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo completar la tarea");
    }
  }

  return (
    <Modal
      maxWidth="max-w-2xl"
      eyebrow={task.number}
      title="Completar tarea"
      description="El cierre queda sellado con tu usuario y la hora. Después solo se puede reabrir de forma explícita."
      onClose={onClose}
      isExiting={isExiting}
      onRequestClose={requestClose}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={requestClose}>
            Volver
          </Button>
          <Button
            type="submit"
            form="task-complete-form"
            size="sm"
            isLoading={isSubmitting}
            disabled={!comment.trim()}
          >
            Completar tarea
          </Button>
        </div>
      }
    >
      <form id="task-complete-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <TextAreaField
          label="Comentario de cierre"
          required
          rows={1}
          maxLength={4000}
          placeholder="Escribe qué se ejecutó, el resultado obtenido y cómo quedó la tarea…"
          className="resize-none overflow-hidden"
          hint={
            <span className="flex items-center justify-between text-[11px] text-zinc-400">
              <span className={errors.comment ? "text-brand-red font-medium" : ""}>
                {errors.comment?.message ?? "El comentario de cierre es obligatorio para registrar la resolución"}
              </span>
              <span className={`tabular-nums ${comment.length > 3800 ? "text-brand-red font-medium" : ""}`}>
                {comment.length} / 4000
              </span>
            </span>
          }
          error={errors.comment?.message}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void handleSubmit(onSubmit)();
            }
          }}
          {...bindAutoResizeTextarea(commentField, 52, (el) => {
            textareaRef.current = el;
          })}
        />

        <TaskEvidenceUpload
          files={files}
          onFilesChange={setFiles}
          onReportError={setFormError}
          label="Evidencias y respaldos"
          dropzoneTitle="Adjuntar entregables o comprobantes de cierre"
          dropzoneHint="Capturas, documentos o lo que demuestre que la tarea quedó concluida (máx. 10 MB por archivo)."
        />
      </form>
    </Modal>
  );
}
