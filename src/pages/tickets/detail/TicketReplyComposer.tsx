import { Paperclip, Send, X } from "lucide-react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { AnimatedCheckIcon } from "../../../components/ui/AnimatedCheckIcon";
import { Button } from "../../../components/ui/Button";
import { LazyBlockEditor } from "../../../components/ui/LazyBlockEditor";
import { PendingFile } from "./PendingFile";
import {
  SAVE_SHORTCUT,
  attachExitingLabelClass,
  attachLabelClass,
  attachSuccessLabelClass,
  pickFiles,
} from "./ticketDetailShared";

interface TicketReplyComposerProps {
  ticketNumber: string;
  subject: string;
  recipientEmail: string | null;
  editorKey: number;
  blocks: unknown;
  setBlocks: Dispatch<SetStateAction<unknown>>;
  attachments: File[];
  setAttachments: Dispatch<SetStateAction<File[]>>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  showAttachedFeedback: boolean;
  attachedExiting: boolean;
  triggerAttachedFeedback: () => void;
  sending: boolean;
  sendError: string | null;
  setSendError: Dispatch<SetStateAction<string | null>>;
  ready: boolean;
  onClose: () => void;
  onSend: () => Promise<void>;
}

/** Vista de redacción a pantalla completa; el borrador vive en la pagina y sobrevive al cierre. */
export function TicketReplyComposer({
  ticketNumber,
  subject,
  recipientEmail,
  editorKey,
  blocks,
  setBlocks,
  attachments,
  setAttachments,
  fileInputRef,
  showAttachedFeedback,
  attachedExiting,
  triggerAttachedFeedback,
  sending,
  sendError,
  setSendError,
  ready,
  onClose,
  onSend,
}: TicketReplyComposerProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-6 py-3.5">
        <div className="min-w-0">
          <p className="font-heading text-[11px] font-semibold tracking-[0.02em] tabular-nums text-subtle">
            {ticketNumber}
          </p>
          <h2 className="mt-0.5 truncate font-heading text-[17px] font-bold tracking-[-0.01em] text-ink">
            Re: {subject}
          </h2>
          <p className="mt-0.5 truncate text-[12px] text-subtle">
            Para <span className="font-medium text-ink">{recipientEmail}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => !sending && onClose()}
          aria-label="Cerrar el editor (Esc)"
          className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-subtle outline-none
            transition-colors hover:bg-fill hover:text-ink focus-visible:ring-3 focus-visible:ring-brand-red/20"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto"
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            void onSend();
          }
        }}
      >
        <div className="mx-auto h-full max-w-4xl px-4 py-3">
          <LazyBlockEditor
            key={editorKey}
            initialContent={blocks ?? undefined}
            onChange={(next) => {
              setBlocks(next);
              if (sendError) setSendError(null);
            }}
            placeholder="Escribe tu respuesta para el cliente…"
          />
        </div>
      </div>

      <div className="shrink-0 space-y-2.5 border-t border-line bg-canvas/40 px-6 py-3">
        {attachments.length > 0 && (
          <div className="mx-auto flex max-w-4xl flex-wrap gap-2">
            {attachments.map((file, index) => (
              <PendingFile
                key={`${file.name}-${index}`}
                file={file}
                onRemove={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}
              />
            ))}
          </div>
        )}

        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              id="reply-attachment-input"
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                pickFiles(event.target, attachments, setAttachments, setSendError, () => triggerAttachedFeedback());
                if (sendError) setSendError(null);
              }}
            />
            <label
              htmlFor="reply-attachment-input"
              className={
                showAttachedFeedback
                  ? attachedExiting
                    ? attachExitingLabelClass
                    : attachSuccessLabelClass
                  : attachLabelClass
              }
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
                  <Paperclip className="h-3.5 w-3.5" />
                  Adjuntar
                </>
              )}
            </label>
            <span className="hidden text-[11px] text-faint sm:inline">{SAVE_SHORTCUT} para enviar</span>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" disabled={sending} onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              isLoading={sending}
              disabled={!ready && !sendError}
              tone={sendError ? "ink" : "primary"}
              toneLabel={sendError}
              onClick={() => void onSend()}
            >
              <Send className="h-[15px] w-[15px]" />
              Enviar respuesta
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
