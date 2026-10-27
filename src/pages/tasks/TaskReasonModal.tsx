import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ApiError } from "../../api/client";
import { tasksApi } from "../../api/tasks";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { TextAreaField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import type { TaskDetail } from "../../types/tasks";
import { taskReasonSchema } from "./taskSchema";

interface TaskReasonModalProps {
  task: TaskDetail;
  mode: "cancel" | "reopen";
  onClose: () => void;
  onSaved: (task: TaskDetail) => void;
}

export function TaskReasonModal({ task, mode, onClose, onSaved }: TaskReasonModalProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const { isExiting, requestClose } = useModalAnimation();
  const isCancel = mode === "cancel";
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ reason: string }>({
    resolver: zodResolver(taskReasonSchema),
    mode: "onTouched",
    defaultValues: { reason: "" },
  });

  async function onSubmit(values: { reason: string }) {
    setFormError(null);
    try {
      const saved = isCancel
        ? await tasksApi.cancel(task.id, values.reason.trim())
        : await tasksApi.reopen(task.id, values.reason.trim());
      onSaved(saved);
      requestClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo actualizar la tarea");
    }
  }

  return (
    <Modal
      maxWidth="max-w-md"
      eyebrow={task.number}
      title={isCancel ? "Cancelar tarea" : "Reabrir tarea"}
      description={
        isCancel
          ? "La tarea deja de estar operativa. El motivo queda en el historial."
          : "Vuelve a pendiente y se pueden retomar las instrucciones, los comentarios y los archivos."
      }
      onClose={onClose}
      isExiting={isExiting}
      onRequestClose={requestClose}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={requestClose}>
            Volver
          </Button>
          <Button type="submit" form="task-reason-form" size="sm" variant={isCancel ? "danger" : "primary"} isLoading={isSubmitting}>
            {isCancel ? "Cancelar tarea" : "Reabrir"}
          </Button>
        </div>
      }
    >
      <form id="task-reason-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
        {formError && <Alert variant="error">{formError}</Alert>}
        <TextAreaField
          label="Motivo"
          required
          rows={3}
          maxLength={500}
          error={errors.reason?.message}
          {...register("reason")}
        />
      </form>
    </Modal>
  );
}
