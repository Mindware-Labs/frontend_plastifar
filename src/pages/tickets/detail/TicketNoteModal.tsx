import { Lock } from "lucide-react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { FileDropzone } from "../../../components/ui/FileDropzone";
import { Modal } from "../../../components/ui/Modal";
import { SAVE_SHORTCUT, pickFiles, textareaClass, validateAttachments } from "./ticketDetailShared";

interface TicketNoteModalProps {
  ticketNumber: string;
  settle: boolean;
  body: string;
  setBody: Dispatch<SetStateAction<string>>;
  attachments: File[];
  setAttachments: Dispatch<SetStateAction<File[]>>;
  isDragging: boolean;
  setIsDragging: Dispatch<SetStateAction<boolean>>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  showAttachedFeedback: boolean;
  attachedExiting: boolean;
  triggerAttachedFeedback: () => void;
  sending: boolean;
  sendError: string | null;
  setSendError: Dispatch<SetStateAction<string | null>>;
  onClose: () => void;
  onSave: () => Promise<void>;
}

/** Escribir una nota es un acto aparte: se pide, se escribe y se cierra. El borrador sobrevive si se cierra sin guardar. */
export function TicketNoteModal({
  ticketNumber,
  settle,
  body,
  setBody,
  attachments,
  setAttachments,
  isDragging,
  setIsDragging,
  fileInputRef,
  showAttachedFeedback,
  attachedExiting,
  triggerAttachedFeedback,
  sending,
  sendError,
  setSendError,
  onClose,
  onSave,
}: TicketNoteModalProps) {
  return (
    <Modal
      settle={settle}
      eyebrow={ticketNumber}
      title="Añadir nota interna"
      description={
        <span className="inline-flex flex-wrap items-center gap-2">
          <Badge tone="amber">
            <Lock aria-hidden className="mr-1 h-3 w-3" />
            Privada
          </Badge>
          <span>Solo la ve el personal de Plastifar. El cliente no recibe copia.</span>
        </span>
      }
      onClose={() => {
        if (!sending) onClose();
      }}
      footer={
        <>
          <Button type="button" variant="secondary" disabled={sending} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            isLoading={sending}
            disabled={!body.trim() && !sendError}
            tone={sendError ? "ink" : "primary"}
            toneLabel={sendError}
            onClick={() => void onSave()}
          >
            Guardar nota
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <textarea
          autoFocus
          rows={7}
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            if (sendError) setSendError(null);
          }}
          onKeyDown={(event) => {
            // Escribir y guardar sin soltar el teclado: es el gesto de cualquier campo de notas.
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void onSave();
            }
          }}
          placeholder="Lo que el equipo debe saber sobre este caso…"
          className={`${textareaClass} ${
            sendError ? "border-brand-red ring-3 ring-brand-red/10 focus:border-brand-red" : ""
          }`}
        />

        {/* Carga de archivos adjuntos */}
        <FileDropzone
          label="Archivos adjuntos (opcional)"
          idleTitle="Haz clic para adjuntar archivos a la nota"
          idleHint="Imágenes (PNG, JPG), documentos PDF, hojas de Excel o reportes internos"
          inputRef={fileInputRef}
          inputId="note-attachment-input"
          onInputChange={(event) => {
            pickFiles(event.target, attachments, setAttachments, setSendError, () => triggerAttachedFeedback());
          }}
          onDropFiles={(files) => {
            if (files) {
              const chosen = Array.from(files);
              const problem = validateAttachments(chosen, attachments);
              if (problem) {
                setSendError(problem);
                return;
              }
              setSendError(null);
              setAttachments((prev) => [...prev, ...chosen]);
              triggerAttachedFeedback();
            }
          }}
          isDragging={isDragging}
          onDraggingChange={setIsDragging}
          feedbackShowing={showAttachedFeedback}
          feedbackExiting={attachedExiting}
          files={attachments}
          onRemoveFile={(idx) => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
        >
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[11px] text-zinc-400">{SAVE_SHORTCUT} para guardar</span>
          </div>
        </FileDropzone>
      </div>
    </Modal>
  );
}
