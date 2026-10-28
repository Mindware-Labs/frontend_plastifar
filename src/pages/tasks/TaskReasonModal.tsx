import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { ApiError } from "../../api/client";
import { tasksApi } from "../../api/tasks";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { TextAreaField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { autoResizeTextarea } from "../../lib/autoResizeTextarea";
import type { TaskDetail } from "../../types/tasks";
import { taskReasonSchema } from "./taskSchema";

interface TaskReasonModalProps {
  task: TaskDetail;
  mode: "cancel" | "reopen";
  onClose: () => void;
  onSaved: (task: TaskDetail) => void;
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

export function TaskReasonModal({ task, mode, onClose, onSaved }: TaskReasonModalProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const { isExiting, requestClose } = useModalAnimation();
  const isCancel = mode === "cancel";
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<{ reason: string }>({
    resolver: zodResolver(taskReasonSchema),
    mode: "onTouched",
    defaultValues: { reason: "" },
  });

  const reason = watch("reason") ?? "";
  const reasonField = register("reason");

  useEffect(() => {
    if (textareaRef.current) {
      autoResizeTextarea(textareaRef.current, 52);
    }
  }, [reason]);

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
      maxWidth="max-w-xl"
      eyebrow={task.number}
      title={isCancel ? "Cancelar tarea" : "Reabrir tarea"}
      description={
        isCancel
          ? "La tarea deja de estar operativa. El motivo queda sellado en el historial."
          : "Vuelve al estado pendiente para retomar las instrucciones, los comentarios y los archivos."
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
            {isCancel ? "Cancelar tarea" : "Reabrir tarea"}
          </Button>
        </div>
      }
    >
      <form id="task-reason-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
        {formError && <Alert variant="error">{formError}</Alert>}
        <TextAreaField
          label={isCancel ? "Motivo de la cancelación" : "Motivo de la reapertura"}
          required
          rows={1}
          maxLength={500}
          placeholder={isCancel ? "Indica la razón por la que se cancela esta tarea…" : "Indica por qué se reactiva esta tarea…"}
          className="resize-none overflow-hidden"
          hint={
            <span className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>Se requiere un motivo explicativo de al menos 5 caracteres</span>
              <span className={`tabular-nums ${reason.length > 450 ? "text-brand-red font-medium" : ""}`}>
                {reason.length} / 500
              </span>
            </span>
          }
          error={errors.reason?.message}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void handleSubmit(onSubmit)();
            }
          }}
          {...bindAutoResizeTextarea(reasonField, 52, (el) => {
            textareaRef.current = el;
          })}
        />
      </form>
    </Modal>
  );
}
