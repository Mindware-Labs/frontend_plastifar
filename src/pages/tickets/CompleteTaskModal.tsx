import { Check, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { TaskEvidenceUpload } from "../../components/app/TaskEvidenceUpload";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { useSettle } from "../../hooks/useSettle";
import type { TicketTaskResponse } from "../../types/api";

interface CompleteTaskModalProps {
  task: TicketTaskResponse | null;
  open: boolean;
  onClose: () => void;
  onComplete: (taskId: number, formData: FormData) => Promise<void>;
}

export function CompleteTaskModal({
  task,
  open,
  onClose,
  onComplete,
}: CompleteTaskModalProps) {
  const [comment, setComment] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settle, triggerSettle] = useSettle();

  if (!open || !task) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);

      const formData = new FormData();
      if (comment.trim()) {
        formData.append("Comment", comment.trim());
      }
      evidenceFiles.forEach((f) => {
        formData.append("EvidenceFiles", f);
      });

      await onComplete(task.id, formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al completar");
      triggerSettle();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      settle={settle}
      onClose={() => {
        if (!saving) onClose();
      }}
      title="Completar tarea y registrar evidencia"
      description="Deja tus comentarios de resolución y adjunta fotografías, documentos o reportes como evidencia del trabajo realizado."
      eyebrow={`Tarea #${task.id}`}
      maxWidth="max-w-lg"
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving}
            onClick={handleSubmit}
            tone={error ? "ink" : "primary"}
            toneLabel={error}
            className={error ? "" : "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white"}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {saving ? "Guardando..." : "Marcar como completada"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded bg-zinc-200/80 text-zinc-600">
              <Check className="size-3" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-heading text-[13px] font-semibold text-zinc-900 leading-tight">
                {task.title}
              </p>
              {task.description && (
                <p className="mt-1 text-[12px] text-zinc-600 line-clamp-2">
                  {task.description}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="complete-task-comment"
            className="font-heading text-[11px] font-semibold text-zinc-500"
          >
            Comentarios de resolución / conclusiones
          </label>
          <textarea
            id="complete-task-comment"
            rows={3}
            placeholder="Explica qué se encontró, qué gestiones se hicieron o las observaciones pertinentes..."
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              if (error) setError(null);
            }}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-[12.5px] text-zinc-800 shadow-2xs outline-none transition-colors focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 placeholder:text-zinc-400"
            autoFocus
          />
        </div>

        <TaskEvidenceUpload
          files={evidenceFiles}
          onFilesChange={setEvidenceFiles}
          onReportError={(message) => {
            if (message) {
              setError(message);
              triggerSettle();
            } else if (error) setError(null);
          }}
        />
      </form>
    </Modal>
  );
}
