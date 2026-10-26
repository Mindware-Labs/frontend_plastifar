import { Paperclip } from "lucide-react";
import { AnimatedCheckIcon } from "../../components/ui/AnimatedCheckIcon";
import type { EmailAttachments } from "../../hooks/useEmailAttachments";

interface AttachFilesButtonProps {
  attachments: EmailAttachments;
}

/** Boton "Adjuntar" con su selector de archivos oculto y el aviso breve de "¡Adjuntado!". */
export function AttachFilesButton({ attachments }: AttachFilesButtonProps) {
  const { fileRef, addFiles, showAttachedFeedback, attachedExiting } = attachments;

  return (
    <>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium shadow-2xs outline-none transition-all duration-300 cursor-pointer ${
          showAttachedFeedback
            ? attachedExiting
              ? "border-emerald-200 bg-emerald-50/40 text-emerald-600 ring-1 ring-emerald-100/50"
              : "border-emerald-300 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200/70 font-semibold"
            : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-zinc-400/20"
        }`}
      >
        {showAttachedFeedback ? (
          <span
            className={`inline-flex items-center gap-1.5 ${
              attachedExiting ? "animate-plf-check-out" : "animate-plf-check-in"
            }`}
          >
            <span className="flex size-3.5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 animate-plf-check-breathe">
              <AnimatedCheckIcon size={11} strokeWidth={3} />
            </span>
            <span>¡Adjuntado!</span>
          </span>
        ) : (
          <>
            <Paperclip className="h-3.5 w-3.5 text-zinc-500" />
            Adjuntar
          </>
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          addFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
    </>
  );
}
