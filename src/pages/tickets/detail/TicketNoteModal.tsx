import { Lock } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { Alert } from "../../../components/ui/Alert";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { FormDivider } from "../../../components/ui/FormDivider";
import { Modal } from "../../../components/ui/Modal";
import { TextAreaField } from "../../../components/ui/Field";
import { TaskEvidenceUpload } from "../../../components/app/TaskEvidenceUpload";
import { autoResizeTextarea } from "../../../lib/autoResizeTextarea";

interface TicketNoteModalProps {
  settle?: boolean;
  eyebrow?: string;
  body: string;
  setBody: Dispatch<SetStateAction<string>>;
  attachments: File[];
  setAttachments: Dispatch<SetStateAction<File[]>>;
  sending: boolean;
  sendError: string | null;
  setSendError: Dispatch<SetStateAction<string | null>>;
  onClose: () => void;
  onSave: () => Promise<void>;
  isExiting?: boolean;
  onRequestClose?: () => void;
}

/** Escribir una nota es un acto aparte: se pide, se escribe y se cierra. El borrador sobrevive si se cierra sin guardar. */
export function TicketNoteModal({
  settle,
  eyebrow,
  body,
  setBody,
  attachments,
  setAttachments,
  sending,
  sendError,
  setSendError,
  onClose,
  onSave,
  isExiting,
  onRequestClose,
}: TicketNoteModalProps) {
  return (
    <Modal
      maxWidth="max-w-xl"
      settle={settle}
      eyebrow={eyebrow}
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
      isExiting={isExiting}
      onRequestClose={onRequestClose ?? onClose}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-zinc-400 select-none">
            <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 text-[10px] font-mono text-zinc-500">
              Ctrl
            </kbd>
            <span>+</span>
            <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 text-[10px] font-mono text-zinc-500">
              Enter
            </kbd>
            <span className="ml-0.5">para guardar</span>
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={sending}
              onClick={onRequestClose ?? onClose}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              isLoading={sending}
              disabled={!body.trim()}
              onClick={() => void onSave()}
            >
              Guardar nota
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3 text-left">
        {sendError && <Alert variant="error">{sendError}</Alert>}

        <FormDivider title="Nota de seguimiento" />

        <TextAreaField
          label="Mensaje interno"
          required
          autoFocus
          rows={1}
          maxLength={4000}
          value={body}
          placeholder="Lo que el equipo debe saber sobre este caso…"
          onChange={(e) => {
            setBody(e.target.value);
            if (sendError) setSendError(null);
            autoResizeTextarea(e.target, 52);
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void onSave();
            }
          }}
          className="min-h-0 resize-none overflow-hidden text-[12.5px] py-2 leading-relaxed [field-sizing:content]"
          hint={
            body.length > 0 ? (
              <span
                className={`block text-right text-[11px] tabular-nums text-zinc-400 ${
                  body.length > 3800 ? "text-brand-red font-medium" : ""
                }`}
              >
                {body.length} / 4000
              </span>
            ) : undefined
          }
        />

        <TaskEvidenceUpload
          files={attachments}
          onFilesChange={setAttachments}
          onReportError={setSendError}
          label="Adjuntos (opcional)"
          dropzoneTitle="Adjuntar archivos"
          dropzoneHint="Máx. 10 MB por archivo"
        />
      </div>
    </Modal>
  );
}
