import { FileText, Image as ImageIcon, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../../hooks/motion";
import { formatBytes } from "../../lib/format";
import { AnimatedCheckIcon } from "../ui/AnimatedCheckIcon";

/** Misma duración que chips de producto en ticket y `animate-plf-check-out` en CSS. */
export const TICKET_PENDING_FILE_REMOVE_MS = 360;

type Variant = "row" | "inline";

interface TicketPendingFileListProps {
  files: File[];
  onChange: (files: File[]) => void;
  /** Fila completa (notas, tareas, crear ticket) o pastilla compacta (respuesta). */
  variant?: Variant;
  layout?: "stack" | "wrap";
  className?: string;
  onRemove?: () => void;
}

function TicketPendingFileChip({
  file,
  exiting,
  variant,
  onRemove,
}: {
  file: File;
  exiting: boolean;
  variant: Variant;
  onRemove: () => void;
}) {
  const motionClass = exiting ? "animate-plf-check-out" : "animate-plf-seal-pop";

  if (variant === "inline") {
    return (
      <span
        className={`inline-flex h-7 max-w-full items-center gap-1.5 rounded-lg border border-emerald-200/80 bg-emerald-50/50 px-2.5 text-[11.5px] font-medium text-emerald-950 shadow-2xs ${motionClass}`}
      >
        <span
          className="flex size-3.5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-3xs animate-plf-check-breathe"
          title="Adjuntado correctamente"
        >
          <AnimatedCheckIcon size={10} strokeWidth={3} />
        </span>
        <span className="max-w-[180px] truncate">{file.name}</span>
        <span className="shrink-0 text-[10.5px] tabular-nums text-emerald-700">{formatBytes(file.size)}</span>
        <button
          type="button"
          onClick={onRemove}
          disabled={exiting}
          aria-label={`Quitar ${file.name}`}
          className="ml-0.5 flex size-4.5 shrink-0 cursor-pointer items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-brand-red disabled:pointer-events-none"
        >
          <X className="size-3" />
        </button>
      </span>
    );
  }

  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px] shadow-2xs ${motionClass}`}
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
        onClick={onRemove}
        disabled={exiting}
        title="Quitar archivo"
        className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:pointer-events-none"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

/** Archivos locales antes de enviar: entrada `seal-pop`, salida `check-out` como productos del ticket. */
export function TicketPendingFileList({
  files,
  onChange,
  variant = "row",
  layout = "stack",
  className = "",
  onRemove,
}: TicketPendingFileListProps) {
  const [removingIndices, setRemovingIndices] = useState<Set<number>>(() => new Set());
  const filesRef = useRef(files);
  filesRef.current = files;
  const removeTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    return () => {
      for (const timer of removeTimers.current.values()) clearTimeout(timer);
      removeTimers.current.clear();
    };
  }, []);

  useEffect(() => {
    if (files.length === 0) {
      setRemovingIndices(new Set());
    }
  }, [files.length]);

  function handleRemove(index: number) {
    if (removingIndices.has(index)) return;
    onRemove?.();

    if (prefersReducedMotion()) {
      onChange(files.filter((_, i) => i !== index));
      return;
    }

    setRemovingIndices((prev) => new Set(prev).add(index));
    const timer = setTimeout(() => {
      onChange(filesRef.current.filter((_, i) => i !== index));
      setRemovingIndices((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
      removeTimers.current.delete(index);
    }, TICKET_PENDING_FILE_REMOVE_MS);
    removeTimers.current.set(index, timer);
  }

  if (files.length === 0) return null;

  const layoutClass =
    layout === "wrap" ? "flex flex-wrap gap-2" : variant === "row" ? "space-y-1.5" : "flex flex-wrap gap-2";

  return (
    <div className={`${layoutClass} ${className}`.trim()}>
      {files.map((file, index) => (
        <TicketPendingFileChip
          key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
          file={file}
          variant={variant}
          exiting={removingIndices.has(index)}
          onRemove={() => handleRemove(index)}
        />
      ))}
    </div>
  );
}
