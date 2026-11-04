import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { ApiError } from "../../api/client";
import { tasksApi } from "../../api/tasks";
import { SubmitValidationButton } from "../../components/app/SubmitValidationButton";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { buildValidationItems, focusFormField } from "../../lib/validationItems";
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
  const reasonMissing = useMemo(
    () =>
      buildValidationItems([
        {
          id: "task-reason",
          label: isCancel ? "Falta el motivo de la cancelación" : "Falta el motivo de la reapertura",
          short: "el motivo",
          valid: reason.trim().length > 0,
        },
      ]),
    [isCancel, reason],
  );

  useEffect(() => {
    if (textareaRef.current) {
      autoResizeTextarea(textareaRef.current, 52);
    }
  }, [reason]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void handleSubmit(onSubmit)();
    }
  }

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
        <div className="flex w-full items-center justify-between gap-3">
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-zinc-400 select-none">
            <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 text-[10px] font-mono text-zinc-500">
              Ctrl
            </kbd>
            <span>+</span>
            <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 text-[10px] font-mono text-zinc-500">
              Enter
            </kbd>
            <span className="ml-0.5">para {isCancel ? "cancelar" : "reabrir"}</span>
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Button type="button" variant="secondary" size="sm" onClick={requestClose}>
              Cancelar
            </Button>
            <SubmitValidationButton
              formId="task-reason-form"
              ready={reasonMissing.length === 0}
              busy={isSubmitting}
              missingItems={reasonMissing}
              onFocusField={focusFormField}
              variant={isCancel ? "danger" : "primary"}
              hintText={
                isCancel
                  ? "Para cancelar la tarea, completa lo siguiente:"
                  : "Para reabrir la tarea, completa lo siguiente:"
              }
            >
              {isCancel ? "Cancelar tarea" : "Reabrir tarea"}
            </SubmitValidationButton>
          </div>
        </div>
      }
    >
      <form
        id="task-reason-form"
        onSubmit={handleSubmit(onSubmit)}
        onKeyDown={handleKeyDown}
        noValidate
        className="flex flex-col gap-3 text-left"
      >
        {formError && <Alert variant="error">{formError}</Alert>}

        <FormDivider title="Justificación" />

        <TextAreaField
          id="task-reason"
          label={isCancel ? "Motivo de la cancelación" : "Motivo de la reapertura"}
          required
          rows={1}
          maxLength={500}
          placeholder={
            isCancel
              ? "Indica la razón por la que se cancela esta tarea…"
              : "Indica por qué se reactiva esta tarea…"
          }
          className="min-h-0 resize-none overflow-hidden text-[12.5px] py-2 leading-relaxed [field-sizing:content]"
          hint={
            <span className="flex items-center justify-between text-[11px] text-zinc-400">
              <span className={errors.reason ? "text-brand-red font-medium" : ""}>
                {errors.reason?.message ?? "Se requiere un motivo explicativo de al menos 5 caracteres"}
              </span>
              <span className={`tabular-nums ${reason.length > 450 ? "text-brand-red font-medium" : ""}`}>
                {reason.length} / 500
              </span>
            </span>
          }
          error={errors.reason?.message}
          {...bindAutoResizeTextarea(reasonField, 52, (el) => {
            textareaRef.current = el;
          })}
        />
      </form>
    </Modal>
  );
}
