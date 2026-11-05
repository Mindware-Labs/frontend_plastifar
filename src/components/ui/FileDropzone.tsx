import { FileText, Image as ImageIcon, Upload, X } from "lucide-react";
import type { ChangeEvent, ReactNode, RefObject } from "react";
import { formatBytes } from "../../lib/format";
import { AnimatedCheckIcon } from "./AnimatedCheckIcon";

interface FileDropzoneProps {
  /** Rotulo de la cabecera, p. ej. "Archivos de evidencia (opcional)". */
  label: string;
  /** Frase principal y pista del recuadro en reposo. */
  idleTitle: string;
  idleHint: string;
  inputRef: RefObject<HTMLInputElement | null>;
  inputId?: string;
  onInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDropFiles: (files: FileList) => void;
  isDragging: boolean;
  onDraggingChange: (dragging: boolean) => void;
  /** Fase del aviso "adjuntado" (useUploadFeedback). */
  feedbackShowing: boolean;
  feedbackExiting: boolean;
  files: File[];
  onRemoveFile: (index: number) => void;
  /** Lo que va entre el recuadro y la lista de archivos. */
  children?: ReactNode;
}

/**
 * Recuadro para soltar o elegir archivos y la lista de los ya elegidos. El estado
 * (archivos, arrastre, aviso) lo lleva quien lo usa: aqui solo se pinta.
 */
export function FileDropzone({
  label,
  idleTitle,
  idleHint,
  inputRef,
  inputId,
  onInputChange,
  onDropFiles,
  isDragging,
  onDraggingChange,
  feedbackShowing,
  feedbackExiting,
  files,
  onRemoveFile,
  children,
}: FileDropzoneProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-heading text-[11px] font-semibold text-zinc-500">{label}</span>
        <span className="text-[11px] text-zinc-400">Máx. 10 MB por archivo</span>
      </div>

      <input ref={inputRef} id={inputId} type="file" multiple className="hidden" onChange={onInputChange} />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDraggingChange(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDraggingChange(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDraggingChange(false);
          onDropFiles(e.dataTransfer.files);
        }}
        className={`group relative flex h-[106px] min-h-[106px] w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-3 transition-colors duration-300 outline-none ${
          feedbackShowing
            ? feedbackExiting
              ? "border-emerald-200 bg-emerald-50/25"
              : "border-emerald-400 bg-emerald-50/60 ring-2 ring-emerald-100/80"
            : isDragging
              ? "border-brand-red bg-brand-red/5 ring-2 ring-brand-red/20"
              : "border-zinc-200 bg-zinc-50/50 hover:border-brand-red/40 hover:bg-brand-red/5"
        }`}
      >
        {feedbackShowing ? (
          <div
            className={`flex flex-col items-center justify-center text-center ${
              feedbackExiting ? "animate-plf-check-out" : "animate-plf-check-in"
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
              {idleTitle}
            </p>
            <p className="mt-0.5 max-w-[360px] truncate text-[11px] text-zinc-400 leading-tight">{idleHint}</p>
          </div>
        )}
      </button>

      {children}

      {/* Lista de archivos seleccionados */}
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
                <span className="shrink-0 text-[11px] tabular-nums text-zinc-400">
                  ({formatBytes(file.size)})
                </span>
              </div>
              <button
                type="button"
                onClick={() => onRemoveFile(idx)}
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
