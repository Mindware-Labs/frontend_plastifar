import { CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../api/client";
import { tasksApi } from "../../api/tasks";
import { useReceipts } from "../../context/useReceipts";
import { autoResizeTextarea } from "../../lib/autoResizeTextarea";
import { Button } from "../ui/Button";
import { TextAreaField } from "../ui/Field";
import { Modal } from "../ui/Modal";

export interface EnterpriseFormCompleteTaskModalProps {
  open: boolean;
  taskId: number;
  taskNumber: string;
  formCode: string;
  recordNumber: string;
  descriptionText?: string;
  defaultComment?: string;
  onClose: () => void;
  onSuccess: () => void;
}

/** Tras guardar un PF-FOR desde una tarea: completar la tarea con comentario de cierre (sin veredicto de ticket). */
export function EnterpriseFormCompleteTaskModal({
  open,
  taskId,
  taskNumber,
  formCode,
  recordNumber,
  descriptionText,
  defaultComment,
  onClose,
  onSuccess,
}: EnterpriseFormCompleteTaskModalProps) {
  const receipts = useReceipts();
  const [closing, setClosing] = useState(false);
  const [comment, setComment] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const initialComment =
    defaultComment?.trim() ||
    `Completada tras registrar ${formCode} · ${recordNumber}`;

  useEffect(() => {
    if (!open) return;
    setComment(initialComment);
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        autoResizeTextarea(textareaRef.current, 52);
      }
    });
  }, [open, initialComment]);

  if (!open) return null;

  const resolvedDescription =
    descriptionText ??
    "El formulario quedó registrado. Puedes completar la tarea ahora con un comentario de cierre, igual que al usar «Completar tarea» en la ficha.";

  const handleConfirmComplete = async () => {
    const trimmed = comment.trim();
    if (taskId <= 0 || !trimmed) return;

    setClosing(true);
    try {
      const form = new FormData();
      form.set("Comment", trimmed);
      await tasksApi.complete(taskId, form);

      receipts.done({
        action: "completar-tarea",
        title: "Tarea completada",
        detail: `${taskNumber} · ${recordNumber}`,
      });

      onSuccess();
      onClose();
    } catch (err) {
      receipts.failed({
        action: "error-completar-tarea",
        title: "No se pudo completar la tarea",
        detail: err instanceof ApiError ? err.message : "Error al completar la tarea",
      });
    } finally {
      setClosing(false);
    }
  };

  const commentValid = comment.trim().length > 0;

  return (
    <Modal
      title="¿Deseas completar la tarea ahora?"
      eyebrow={`${formCode} · ${taskNumber}`}
      onClose={onClose}
      maxWidth="max-w-xl"
      closeOnBackdropClick={false}
      footer={
        <div className="flex w-full items-center justify-end gap-2.5">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Mantener tarea abierta
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={closing || taskId <= 0 || !commentValid}
            onClick={handleConfirmComplete}
          >
            <CheckCircle2 className="mr-1.5 size-4" />
            {closing ? "Completando…" : "Sí, completar tarea"}
          </Button>
        </div>
      }
    >
      <div className="-mt-1 space-y-4 text-left">
        <div className="rounded-xl border border-zinc-200/90 bg-zinc-50/70 p-4">
          <div className="flex items-start gap-3.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="size-5" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <h4 className="font-heading text-sm font-bold tracking-tight text-zinc-900">{recordNumber}</h4>
              <p className="text-xs leading-relaxed text-zinc-600">{resolvedDescription}</p>
            </div>
          </div>
        </div>

        <TextAreaField
          label="Comentario de cierre"
          required
          rows={1}
          className="min-h-[52px] resize-none overflow-hidden text-[13px] leading-relaxed break-words [overflow-wrap:anywhere]"
          value={comment}
          onChange={(e) => {
            setComment(e.target.value);
            autoResizeTextarea(e.target, 52);
          }}
          ref={(el) => {
            textareaRef.current = el;
            if (el) autoResizeTextarea(el, 52);
          }}
          placeholder="Describe el cierre de la tarea…"
        />
      </div>
    </Modal>
  );
}
