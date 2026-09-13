import { Check, CheckCircle2, FileText, Image as ImageIcon, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { AnimatedCheckIcon } from "../../components/ui/AnimatedCheckIcon";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { useSettle } from "../../hooks/useSettle";
import { useUploadFeedback } from "../../hooks/useUploadFeedback";
import { formatBytes } from "../../lib/format";
import type { TicketTaskResponse } from "../../types/api";

interface CompleteTaskModalProps {
  task: TicketTaskResponse | null;
  open: boolean;
  onClose: () => void;
  onComplete: (taskId: number, formData: FormData) => Promise<void>;
}

const MAX_SINGLE_FILE = 10 * 1024 * 1024; // 10 MB
const MAX_TOTAL_FILES = 25 * 1024 * 1024; // 25 MB

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
  const [isDragging, setIsDragging] = useState(false);
  const {
    isShowing: showUploadFeedback,
    isExiting: uploadExiting,
    trigger: triggerUploadFeedback,
  } = useUploadFeedback({ duration: 2300, exitDuration: 360 });
  const [settle, triggerSettle] = useSettle();
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open || !task) return null;

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);

    const newFiles = Array.from(files);
    for (const f of newFiles) {
      if (f.size > MAX_SINGLE_FILE) {
        setError("Máx. 10 MB por archivo");
        triggerSettle();
        return;
      }
    }

    const currentTotal = evidenceFiles.reduce((acc, f) => acc + f.size, 0);
    const incomingTotal = newFiles.reduce((acc, f) => acc + f.size, 0);
    if (currentTotal + incomingTotal > MAX_TOTAL_FILES) {
      setError("Total supera 25 MB");
      triggerSettle();
      return;
    }

    setEvidenceFiles((prev) => [...prev, ...newFiles]);
    triggerUploadFeedback();
  };

  const handleRemoveFile = (index: number) => {
    if (error) setError(null);
    setEvidenceFiles((prev) => prev.filter((_, i) => i !== index));
  };

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
        {/* Resumen de la tarea a completar */}
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

        {/* Comentarios de resolución */}
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

        {/* Carga de archivos de evidencia */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-heading text-[11px] font-semibold text-zinc-500">
              Archivos de evidencia (opcional)
            </span>
            <span className="text-[11px] text-zinc-400">Máx. 10 MB por archivo</span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFilesSelected(e.target.files);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(false);
              handleFilesSelected(e.dataTransfer.files);
            }}
            className={`group flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 transition-all duration-300 ${
              showUploadFeedback
                ? uploadExiting
                  ? "border-emerald-200 bg-emerald-50/20 opacity-70 scale-[0.99]"
                  : "border-emerald-400 bg-emerald-50/60 shadow-xs ring-2 ring-emerald-100"
                : isDragging
                  ? "border-brand-red bg-brand-red/5 ring-2 ring-brand-red/20 scale-[0.99]"
                  : "border-zinc-200 bg-zinc-50/50 hover:border-brand-red/40 hover:bg-brand-red/5"
            }`}
          >
            {showUploadFeedback ? (
              <div
                className={`flex flex-col items-center justify-center ${
                  uploadExiting ? "animate-plf-check-out" : "animate-plf-check-in"
                }`}
              >
                <div className="relative flex size-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 ring-4 ring-emerald-50 shadow-xs animate-plf-check-breathe">
                  <AnimatedCheckIcon size={20} strokeWidth={2.8} />
                </div>
                <p className="mt-2 font-heading text-[12.5px] font-bold text-emerald-700">
                  ¡{evidenceFiles.length === 1 ? "Archivo adjuntado correctamente" : `${evidenceFiles.length} archivos adjuntados correctamente`}!
                </p>
                <p className="text-[11px] text-emerald-600/80">
                  Haz clic o arrastra para añadir más si lo deseas
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center transition-opacity duration-300">
                <div className="flex size-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition-transform group-hover:scale-110">
                  <Upload className="size-4" />
                </div>
                <p className="mt-1.5 font-heading text-[12px] font-semibold text-zinc-700">
                  Haz clic para adjuntar evidencias
                </p>
                <p className="text-[11px] text-zinc-400">
                  Imágenes (PNG, JPG), reportes en PDF, hojas de Excel, etc.
                </p>
              </div>
            )}
          </button>

          {/* Lista de archivos seleccionados */}
          {evidenceFiles.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {evidenceFiles.map((file, idx) => (
                <div
                  key={`${file.name}-${idx}`}
                  className="animate-plf-seal-pop flex items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px] shadow-2xs"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-2xs animate-plf-check-in"
                      title="Adjuntado correctamente"
                    >
                      <AnimatedCheckIcon size={12} strokeWidth={3} />
                    </span>
                    {file.type.startsWith("image/") ? (
                      <ImageIcon className="size-3.5 shrink-0 text-brand-red" />
                    ) : (
                      <FileText className="size-3.5 shrink-0 text-zinc-400" />
                    )}
                    <span className="truncate font-medium text-zinc-800" title={file.name}>
                      {file.name}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-zinc-400">
                      ({formatBytes(file.size)})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(idx)}
                    title="Quitar archivo"
                    className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}
