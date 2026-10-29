import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { ApiError } from "../../api/client";
import { tasksApi } from "../../api/tasks";
import { SubmitValidationButton } from "../../components/app/SubmitValidationButton";
import { TaskEvidenceUpload } from "../../components/app/TaskEvidenceUpload";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { buildValidationItems, focusFormField } from "../../lib/validationItems";
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
  const completeMissing = useMemo(
    () =>
      buildValidationItems([
        {
          id: "task-complete-comment",
          label: "Falta el comentario de cierre",
          short: "el comentario",
          valid: comment.trim().length > 0,
        },
      ]),
    [comment],
  );

  useEffect(() => {
    if (textareaRef.current) {
      autoResizeTextarea(textareaRef.current, 52);
    }
  }, [comment]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void handleSubmit(onSubmit)();
    }
  }

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
      maxWidth="max-w-xl"
      eyebrow={task.number}
      title="Completar tarea"
      description="El cierre queda sellado con tu usuario y la hora. Después solo se puede reabrir de forma explícita."
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
            <span className="ml-0.5">para completar</span>
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Button type="button" variant="secondary" size="sm" onClick={requestClose}>
              Cancelar
            </Button>
            <SubmitValidationButton
              formId="task-complete-form"
              ready={completeMissing.length === 0}
              busy={isSubmitting}
              missingItems={completeMissing}
              onFocusField={focusFormField}
              hintText="Para completar la tarea, completa lo siguiente:"
            >
              Completar tarea
            </SubmitValidationButton>
          </div>
        </div>
      }
    >
      <form
        id="task-complete-form"
        onSubmit={handleSubmit(onSubmit)}
        onKeyDown={handleKeyDown}
        noValidate
        className="flex flex-col gap-3 text-left"
      >
        {formError && <Alert variant="error">{formError}</Alert>}

        <FormDivider title="Resolución" />

        <TextAreaField
          id="task-complete-comment"
          label="Comentario de cierre"
          required
          rows={1}
          maxLength={4000}
          placeholder="Escribe qué se ejecutó, el resultado obtenido y cómo quedó la tarea…"
          className="min-h-0 resize-none overflow-hidden text-[12.5px] py-2 leading-relaxed [field-sizing:content]"
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
          {...bindAutoResizeTextarea(commentField, 52, (el) => {
            textareaRef.current = el;
          })}
        />

        <FormDivider title="Evidencias y respaldos" />

        <TaskEvidenceUpload
          files={files}
          onFilesChange={setFiles}
          onReportError={setFormError}
          label="Entregables o comprobantes de cierre"
          dropzoneTitle="Adjuntar archivos de evidencia"
          dropzoneHint="Capturas, reportes o documentos (máx. 10 MB por archivo)"
        />
      </form>
    </Modal>
  );
}
