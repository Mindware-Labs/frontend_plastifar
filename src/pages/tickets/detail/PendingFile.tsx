import { X } from "lucide-react";
import { AnimatedCheckIcon } from "../../../components/ui/AnimatedCheckIcon";
import { formatBytes } from "../../../lib/format";

/** Archivo elegido y aun no enviado: nombre, peso y la cruz para quitarlo. */
export function PendingFile({ file, onRemove }: { file: File; onRemove: () => void }) {
  return (
    <span className="animate-plf-check-in inline-flex h-7 items-center gap-1.5 rounded-lg border border-emerald-200/80 bg-emerald-50/50 px-2.5 text-[11.5px] font-medium text-emerald-950 shadow-2xs">
      <span className="flex size-3.5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-3xs animate-plf-check-breathe" title="Adjuntado correctamente">
        <AnimatedCheckIcon size={10} strokeWidth={3} />
      </span>
      <span className="max-w-[180px] truncate">{file.name}</span>
      <span className="text-[10.5px] tabular-nums text-emerald-700">{formatBytes(file.size)}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Quitar ${file.name}`}
        className="ml-0.5 flex h-4.5 w-4.5 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-brand-red cursor-pointer"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
