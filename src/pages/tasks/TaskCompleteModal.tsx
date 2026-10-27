import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ApiError } from "../../api/client";
import { tasksApi } from "../../api/tasks";
import { TaskEvidenceUpload } from "../../components/app/TaskEvidenceUpload";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { TextAreaField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import type { TaskDetail } from "../../types/tasks";
import { taskCommentSchema } from "./taskSchema";

interface TaskCompleteModalProps {
  task: TaskDetail;
  onClose: () => void;
  onCompleted: (task: TaskDetail) => void;
}

export function TaskCompleteModal({ task, onClose, onCompleted }: TaskCompleteModalProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const { isExiting, requestClose } = useModalAnimation();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ comment: string }>({
    resolver: zodResolver(taskCommentSchema),
    mode: "onTouched",
    defaultValues: { comment: "" },
  });

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
      maxWidth="max-w-lg"
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
          <Button type="submit" form="task-complete-form" size="sm" isLoading={isSubmitting}>
            Completar
          </Button>
        </div>
      }
    >
      <form id="task-complete-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
        {formError && <Alert variant="error">{formError}</Alert>}
        <TextAreaField
          label="Comentario de cierre"
          required
          rows={4}
          maxLength={4000}
          placeholder="Qué se ejecutó y cómo quedó"
          error={errors.comment?.message}
          {...register("comment")}
        />
        <TaskEvidenceUpload
          files={files}
          onFilesChange={setFiles}
          onReportError={setFormError}
          label="Evidencias"
          dropzoneTitle="Adjuntar entregables o comprobantes"
          dropzoneHint="Capturas, documentos o lo que demuestre que la tarea quedó hecha."
        />
      </form>
    </Modal>
  );
}
