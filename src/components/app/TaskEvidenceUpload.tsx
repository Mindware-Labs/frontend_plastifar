import { FileText, Image as ImageIcon, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { AnimatedCheckIcon } from "../ui/AnimatedCheckIcon";
import { useUploadFeedback } from "../../hooks/useUploadFeedback";
import { formatBytes } from "../../lib/format";

export const MAX_TASK_EVIDENCE_SINGLE = 10 * 1024 * 1024;
export const MAX_TASK_EVIDENCE_TOTAL = 25 * 1024 * 1024;

interface TaskEvidenceUploadProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  onReportError?: (message: string | null) => void;
  label?: string;
  dropzoneTitle?: string;
  dropzoneHint?: string;
}

export function TaskEvidenceUpload({
  files,
  onFilesChange,
  onReportError,
  label = "Archivos de evidencia (opcional)",
  dropzoneTitle = "Haz clic para adjuntar evidencias",
  dropzoneHint = "Imágenes (PNG, JPG), reportes en PDF, hojas de Excel, etc.",
}: TaskEvidenceUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const {
    isShowing: showUploadFeedback,
    isExiting: uploadExiting,
    trigger: triggerUploadFeedback,
  } = useUploadFeedback({ duration: 2300, exitDuration: 360 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = (selected: FileList | null) => {
    if (!selected || selected.length === 0) return;
    onReportError?.(null);

    const newFiles = Array.from(selected);
    for (const f of newFiles) {
      if (f.size > MAX_TASK_EVIDENCE_SINGLE) {
        onReportError?.("Máx. 10 MB por archivo");
        return;
      }
    }

    const currentTotal = files.reduce((acc, f) => acc + f.size, 0);
    const incomingTotal = newFiles.reduce((acc, f) => acc + f.size, 0);
    if (currentTotal + incomingTotal > MAX_TASK_EVIDENCE_TOTAL) {
      onReportError?.("Total supera 25 MB");
      return;
    }

    onFilesChange([...files, ...newFiles]);
    triggerUploadFeedback();
  };

  const handleRemoveFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-heading text-[11px] font-semibold text-zinc-500">{label}</span>
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
        className={`group relative flex h-[106px] min-h-[106px] w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-3 transition-colors duration-300 outline-none ${
          showUploadFeedback
            ? uploadExiting
              ? "border-emerald-200 bg-emerald-50/25"
              : "border-emerald-400 bg-emerald-50/60 ring-2 ring-emerald-100/80"
            : isDragging
              ? "border-brand-red bg-brand-red/5 ring-2 ring-brand-red/20"
              : "border-zinc-200 bg-zinc-50/50 hover:border-brand-red/40 hover:bg-brand-red/5"
        }`}
      >
        {showUploadFeedback ? (
          <div
            className={`flex flex-col items-center justify-center text-center ${
              uploadExiting ? "animate-plf-check-out" : "animate-plf-check-in"
            }`}
          >
            <div className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 ring-2 ring-emerald-200/70 shadow-3xs animate-plf-check-breathe">
              <AnimatedCheckIcon size={16} strokeWidth={2.8} />
            </div>
            <p className="mt-1.5 max-w-[360px] truncate font-heading text-[12px] font-bold text-emerald-700 leading-tight">
              ¡{files.length === 1 ? "Archivo adjuntado correctamente" : `${files.length} archivos adjuntados correctamente`}!
            </p>
            <p className="mt-0.5 max-w-[360px] truncate text-[11px] text-emerald-600/80 leading-tight">
              Haz clic o arrastra para añadir más si lo deseas
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center transition-opacity duration-300">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition-transform group-hover:scale-105">
              <Upload className="size-4" />
            </div>
            <p className="mt-1.5 max-w-[360px] truncate font-heading text-[12px] font-semibold text-zinc-700 leading-tight">
              {dropzoneTitle}
            </p>
            <p className="mt-0.5 max-w-[360px] truncate text-[11px] text-zinc-400 leading-tight">{dropzoneHint}</p>
          </div>
        )}
      </button>

      {files.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {files.map((file, idx) => (
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
                <span className="shrink-0 text-[11px] tabular-nums text-zinc-400">({formatBytes(file.size)})</span>
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
  );
}
