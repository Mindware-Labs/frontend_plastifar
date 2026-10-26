import { CornerUpLeft, Forward, X } from "lucide-react";
import type { RefObject } from "react";
import { Alert } from "../../components/ui/Alert";
import { AnimatedCheckIcon } from "../../components/ui/AnimatedCheckIcon";
import { Button as PfButton } from "../../components/ui/Button";
import { LazyBlockEditor } from "../../components/ui/LazyBlockEditor";
import { MAX_EMAIL_FILES, type EmailAttachments } from "../../hooks/useEmailAttachments";
import { formatBytes } from "../../lib/format";
import { AttachFilesButton } from "./AttachFilesButton";
import { CannedPicker } from "./CannedPicker";
import { ComposerInset } from "./ComposerInset";
import { RecipientInput } from "./RecipientInput";
import { SendValidationButton } from "./SendValidationButton";
import { type ValidationItem } from "./sendValidation";
import { fieldCloseClass, fieldLabelClass, fieldToggleClass } from "./toolbarStyles";

interface ReplyComposerProps {
  containerRef: RefObject<HTMLDivElement | null>;
  isForward: boolean;
  /** Asunto del correo original; vacio muestra "(sin asunto)". */
  subject: string;
  /** A quien se responde cuando no es un reenvio. */
  fromEmail: string;
  /** Quienes ya estaban en el hilo, para el atajo "Todos". */
  replyAll: string[];
  /** Adjuntos del correo original que se pueden incluir al reenviar. */
  originalAttachmentCount: number;
  toRef: RefObject<HTMLInputElement | null>;
  forwardTo: string;
  onForwardToChange: (value: string) => void;
  ccRef: RefObject<HTMLInputElement | null>;
  cc: string;
  onCcChange: (value: string) => void;
  ccOpen: boolean;
  onCcOpenChange: (open: boolean) => void;
  bccRef: RefObject<HTMLInputElement | null>;
  bcc: string;
  onBccChange: (value: string) => void;
  bccOpen: boolean;
  onBccOpenChange: (open: boolean) => void;
  includeAttachments: boolean;
  onIncludeAttachmentsChange: (include: boolean) => void;
  editorKey: number;
  draftBlocks: unknown;
  onBlocksChange: (blocks: unknown) => void;
  attachments: EmailAttachments;
  error: string | null;
  onInsertCanned: (body: string) => void;
  ready: boolean;
  sending: boolean;
  missingItems: ValidationItem[];
  onSend: () => void;
  onFocusField: (fieldId: string) => void;
  onClose: () => void;
}

/** Editor de respuesta o reenvio que cubre el cuerpo del correo mientras esta abierto. */
export function ReplyComposer({
  containerRef,
  isForward,
  subject,
  fromEmail,
  replyAll,
  originalAttachmentCount,
  toRef,
  forwardTo,
  onForwardToChange,
  ccRef,
  cc,
  onCcChange,
  ccOpen,
  onCcOpenChange,
  bccRef,
  bcc,
  onBccChange,
  bccOpen,
  onBccOpenChange,
  includeAttachments,
  onIncludeAttachmentsChange,
  editorKey,
  draftBlocks,
  onBlocksChange,
  attachments,
  error,
  onInsertCanned,
  ready,
  sending,
  missingItems,
  onSend,
  onFocusField,
  onClose,
}: ReplyComposerProps) {
  const { files, setFiles, addFiles } = attachments;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-20 flex flex-col bg-white"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        addFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-100 bg-zinc-50/40 px-4 py-2">
        {isForward ? (
          <Forward className="h-3.5 w-3.5 shrink-0 text-brand-red" />
        ) : (
          <CornerUpLeft className="h-3.5 w-3.5 shrink-0 text-brand-red" />
        )}
        <span className="shrink-0 text-[12.5px] font-semibold text-zinc-900">
          {isForward ? "Reenviar" : "Responder"}
        </span>
        <span className="truncate text-[11.5px] text-zinc-500">
          {subject ? `${isForward ? "Fwd" : "Re"}: ${subject}` : "(sin asunto)"}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar el editor"
          title="Cerrar el editor"
          className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-400 outline-none transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-400/20 cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-3 border-b border-zinc-100 px-4 py-1.5 transition-colors focus-within:bg-zinc-50/50">
        <span className={fieldLabelClass}>Para</span>
        {isForward ? (
          <RecipientInput
            inputRef={toRef}
            value={forwardTo}
            onChange={onForwardToChange}
            placeholder="correo@dominio.com, otro@dominio.com"
            autoFocus
          />
        ) : (
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-zinc-900">
            {fromEmail}
          </span>
        )}
        {!isForward && !ccOpen && replyAll.length > 0 && (
          <button
            type="button"
            onClick={() => {
              onCcOpenChange(true);
              onCcChange(replyAll.join(", "));
            }}
            title="Copiar a todos los de la conversación"
            className={fieldToggleClass}
          >
            Todos
          </button>
        )}
        {!ccOpen && (
          <button type="button" onClick={() => onCcOpenChange(true)} title="Agregar copia" className={fieldToggleClass}>
            CC
          </button>
        )}
        {!bccOpen && (
          <button
            type="button"
            onClick={() => onBccOpenChange(true)}
            title="Agregar copia oculta"
            className={fieldToggleClass}
          >
            CCO
          </button>
        )}
      </div>

      {ccOpen && (
        <div className="flex shrink-0 items-center gap-3 border-b border-zinc-100 px-4 py-1.5 transition-colors focus-within:bg-zinc-50/50">
          <span className={fieldLabelClass}>CC</span>
          <RecipientInput
            inputRef={ccRef}
            value={cc}
            onChange={onCcChange}
            placeholder="correo@dominio.com, otro@dominio.com"
          />
          <button
            type="button"
            onClick={() => {
              onCcOpenChange(false);
              onCcChange("");
            }}
            aria-label="Quitar la copia"
            title="Quitar la copia"
            className={fieldCloseClass}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {bccOpen && (
        <div className="flex shrink-0 items-center gap-3 border-b border-zinc-100 px-4 py-1.5 transition-colors focus-within:bg-zinc-50/50">
          <span className={fieldLabelClass}>CCO</span>
          <RecipientInput
            inputRef={bccRef}
            value={bcc}
            onChange={onBccChange}
            placeholder="Nadie más ve a quién va esta copia"
          />
          <button
            type="button"
            onClick={() => {
              onBccOpenChange(false);
              onBccChange("");
            }}
            aria-label="Quitar la copia oculta"
            title="Quitar la copia oculta"
            className={fieldCloseClass}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {isForward && originalAttachmentCount > 0 && (
        <label className="flex shrink-0 cursor-pointer items-center gap-2 border-b border-zinc-100 bg-zinc-50/40 px-4 py-1.5 text-[12px] font-medium text-zinc-700">
          <input
            type="checkbox"
            checked={includeAttachments}
            onChange={(event) => onIncludeAttachmentsChange(event.target.checked)}
            className="h-3.5 w-3.5 accent-brand-red rounded"
          />
          Incluir {originalAttachmentCount === 1 ? "el adjunto original" : `los ${originalAttachmentCount} adjuntos originales`}
        </label>
      )}

      <div
        className="min-h-0 flex-1 overflow-y-auto"
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            if (ready) onSend();
          }
        }}
      >
        <LazyBlockEditor
          key={editorKey}
          initialContent={draftBlocks}
          onChange={onBlocksChange}
          placeholder={isForward ? "Comentario opcional…" : "Escribe la respuesta…"}
        />
      </div>

      {files.length > 0 && (
        <div className="flex shrink-0 flex-wrap gap-1.5 border-t border-zinc-100 px-4 py-2 bg-zinc-50/30">
          {files.map((file, position) => (
            <span
              key={`${file.name}-${position}`}
              className="animate-plf-check-in inline-flex items-center gap-1.5 rounded-md border border-emerald-200/80
                bg-emerald-50/50 px-2.5 py-1 text-[11.5px] font-medium text-zinc-800 shadow-2xs"
            >
              <span className="flex size-3.5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-3xs animate-plf-check-breathe" title="Adjuntado correctamente">
                <AnimatedCheckIcon size={10} strokeWidth={3} />
              </span>
              <span className="max-w-[160px] truncate">{file.name}</span>
              <span className="text-zinc-400 text-[10.5px] tabular-nums">{formatBytes(file.size)}</span>
              <button
                type="button"
                onClick={() => setFiles(files.filter((_, at) => at !== position))}
                aria-label={`Quitar ${file.name}`}
                className="text-zinc-400 transition-colors hover:text-brand-red ml-0.5 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {error && (
        <div className="shrink-0 px-4 pb-2 pt-2">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <ComposerInset />
      <div className="flex shrink-0 items-center gap-2 border-t border-zinc-100 px-4 py-2.5 bg-zinc-50/30">
        <AttachFilesButton attachments={attachments} />
        <CannedPicker onPick={onInsertCanned} />
        <span className="truncate text-[11px] font-medium text-zinc-400">
          Hasta {MAX_EMAIL_FILES} archivos, 10 MB · también puedes soltarlos aquí
        </span>

        <div className="ml-auto flex shrink-0 gap-2">
          <PfButton variant="ghost" size="sm" className="h-8 px-3" onClick={onClose}>
            Cancelar
          </PfButton>
          <SendValidationButton
            ready={ready}
            sending={sending}
            missingItems={missingItems}
            onSend={onSend}
            onFocusField={onFocusField}
          />
        </div>
      </div>
    </div>
  );
}
