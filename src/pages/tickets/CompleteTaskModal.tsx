import { CheckCircle2, ClipboardList, MessageSquarePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { SubmitValidationButton } from "../../components/app/SubmitValidationButton";
import { TaskEvidenceUpload } from "../../components/app/TaskEvidenceUpload";
import { Button } from "../../components/ui/Button";
import { SelectField, TextAreaField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { SegmentedTabs } from "../../components/ui/SegmentedTabs";
import { useSettle } from "../../hooks/useSettle";
import { ticketsApi } from "../../api/tickets";
import { buildValidationItems, focusFormField } from "../../lib/validationItems";
import type { TicketTaskResponse } from "../../types/api";
import { TASK_STATUS_EDIT_OPTIONS } from "../tasks/taskCells";
type UpdateMode = "progress" | "complete";

interface CompleteTaskModalProps {
  ticketId: number;
  task: TicketTaskResponse | null;
  open: boolean;
  onClose: () => void;
  onComplete: (taskId: number, formData: FormData) => Promise<void>;
  onProgressSaved?: (task: TicketTaskResponse) => void;
}

function ModeTabs({
  mode,
  onModeChange,
}: {
  mode: UpdateMode;
  onModeChange: (mode: UpdateMode) => void;
}) {
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

export function CompleteTaskModal({
  ticketId,
  task,
  open,
  onClose,
  onComplete,
  onProgressSaved,
}: CompleteTaskModalProps) {
  const [mode, setMode] = useState<UpdateMode>("progress");
  const [progressNote, setProgressNote] = useState("");
  const [status, setStatus] = useState<"Pendiente" | "EnProgreso">("EnProgreso");
  const [comment, setComment] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settle, triggerSettle] = useSettle();

  useEffect(() => {
    if (!open || !task) return;
    if (task.status === "Pendiente" || task.status === "EnProgreso") {
      setStatus(task.status);
    } else {
      setStatus("EnProgreso");
    }
    setMode("progress");
    setProgressNote("");
    setComment("");
    setEvidenceFiles([]);
    setError(null);
  }, [open, task?.id, task?.status]);

  if (!open || !task) return null;

  const progressMissing = buildValidationItems([
    {
      id: "ticket-task-progress-note",
      label: "Falta describir el avance o la gestión",
      short: "el registro del avance",
      valid: progressNote.trim().length > 0,
    },
  ]);

  const handleProgress = async () => {
    if (progressMissing.length > 0) return;
    try {
      setSaving(true);
      setError(null);
      await ticketsApi.addTaskComment(ticketId, task.id, { comment: progressNote.trim() });
      const nextStatus = status;
      let updated: TicketTaskResponse;
      if (nextStatus !== task.status) {
        updated = await ticketsApi.updateTask(ticketId, task.id, { status: nextStatus });
      } else {
        const list = await ticketsApi.getTasks(ticketId);
        updated = list.find((row) => row.id === task.id) ?? task;
      }
      onProgressSaved?.(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar el avance");
      triggerSettle();
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (e: React.FormEvent) => {
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
      title="Actualizar tarea"
      description={
        mode === "progress"
          ? "Registra consultas o gestiones intermedias. La tarea sigue abierta hasta que la marques como completada."
          : "Deja tus comentarios de resolución y adjunta evidencia del trabajo realizado."
      }
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
          {mode === "progress" ? (
            <SubmitValidationButton
              ready={progressMissing.length === 0}
              busy={saving}
              missingItems={progressMissing}
              onSubmit={() => void handleProgress()}
              onFocusField={focusFormField}
              tone={error ? "ink" : "primary"}
              toneLabel={error}
              hintText="Para registrar el avance, completa lo siguiente:"
            >
              Guardar avance
            </SubmitValidationButton>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={handleComplete}
              tone={error ? "ink" : "primary"}
              toneLabel={error}
              className={error ? "" : "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white"}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {saving ? "Guardando..." : "Marcar como completada"}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded bg-zinc-200/80 text-zinc-600">
              <ClipboardList className="size-3" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-heading text-[13px] font-semibold text-zinc-900 leading-tight">{task.title}</p>
              {task.description && (
                <p className="mt-1 text-[12px] text-zinc-600 line-clamp-2 whitespace-pre-line">{task.description}</p>
              )}
            </div>
          </div>
        </div>

        <ModeTabs mode={mode} onModeChange={setMode} />

        {mode === "progress" ? (
          <div className="space-y-3">
            <SelectField
              id="ticket-task-update-status"
              size="sm"
              label="Estado de la tarea"
              value={status}
              onChange={(value) => setStatus(value as "Pendiente" | "EnProgreso")}
              options={TASK_STATUS_EDIT_OPTIONS}
            />

            <TextAreaField
              id="ticket-task-progress-note"
              label="Qué hiciste o qué quedó pendiente"
              required
              rows={3}
              placeholder="Ej.: Envié mensaje interno pidiendo confirmación del lote…"
              value={progressNote}
              onChange={(e) => {
                setProgressNote(e.target.value);
                if (error) setError(null);
              }}
              autoGrow
              className="text-[12.5px] shadow-2xs"
            />
          </div>
        ) : (
          <form onSubmit={handleComplete} className="space-y-4">
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
        )}
      </div>
    </Modal>
  );
}
