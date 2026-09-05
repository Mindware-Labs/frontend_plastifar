import { PenLine, Paperclip, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../api/client";
import { emailsApi } from "../../api/emails";
import { Alert } from "../../components/ui/Alert";
import { Button as PfButton } from "../../components/ui/Button";
import { LazyBlockEditor } from "../../components/ui/LazyBlockEditor";
import { useNoticeInset, useReceipts } from "../../context/useReceipts";
import { blocksToEmailHtml, blocksToText } from "../../lib/emailHtml";
import { formatBytes } from "../../lib/format";
import { fieldLabelClass } from "./toolbarStyles";
import { SendValidationButton } from "./SendValidationButton";
import { type ValidationItem } from "./sendValidation";

interface NewEmailComposerProps {
  onSent: () => void;
  onCancel: () => void;
}

const MAX_FILES = 5;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;

export function NewEmailComposer({ onSent, onCancel }: NewEmailComposerProps) {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [ccOpen, setCcOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [blocks, setBlocks] = useState<unknown>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const receipts = useReceipts();
  const containerRef = useRef<HTMLDivElement>(null);
  const toRef = useRef<HTMLInputElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const ccRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // La marca del envio nace con el editor: un reintento la repite y no duplica el correo.
  const tokenRef = useRef(crypto.randomUUID());

  useEffect(() => {
    toRef.current?.focus();
  }, []);

  useNoticeInset(44);

  useEffect(() => {
    if (ccOpen) ccRef.current?.focus();
  }, [ccOpen]);

  function addFiles(incoming: File[]) {
    if (incoming.length === 0) return;

    const merged = [...files, ...incoming];
    const total = merged.reduce((sum, file) => sum + file.size, 0);

    if (merged.length > MAX_FILES) {
      setError(`No se pueden adjuntar más de ${MAX_FILES} archivos.`);
      return;
    }

    if (total > MAX_TOTAL_BYTES) {
      setError("Los adjuntos superan los 10 MB en total.");
      return;
    }

    setError(null);
    setFiles(merged);
  }

  async function handleSend() {
    if (sending || !ready) return;
    setSending(true);
    setError(null);

    try {
      await emailsApi.compose({
        to,
        cc: cc.trim() || undefined,
        subject,
        body,
        bodyHtml: blocksToEmailHtml(blocks),
        files,
        clientToken: tokenRef.current,
      });
      receipts.done({
        action: "componer",
        title: "Correo enviado",
        detail: "Lo encuentras en Enviados",
      });

      onSent();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo enviar el correo");
    } finally {
      setSending(false);
    }
  }

  const body = blocksToText(blocks);

  const missingItems: ValidationItem[] = [];
  if (!to.trim()) {
    missingItems.push({
      id: "to",
      label: "Falta el destinatario (Para)",
      short: "el destinatario (Para)",
    });
  }
  if (!subject.trim()) {
    missingItems.push({
      id: "subject",
      label: "Falta el asunto",
      short: "el asunto",
    });
  }
  if (!body.trim()) {
    missingItems.push({
      id: "body",
      label: "Falta el cuerpo del mensaje",
      short: "el mensaje",
    });
  }

  const ready = missingItems.length === 0;

  function handleFocusField(fieldId: string) {
    if (fieldId === "to") {
      toRef.current?.focus();
    } else if (fieldId === "subject") {
      subjectRef.current?.focus();
    } else if (fieldId === "body") {
      const editorEl = containerRef.current?.querySelector('[contenteditable="true"]');
      if (editorEl instanceof HTMLElement) editorEl.focus();
    }
  }

  return (
    <div
      ref={containerRef}
      className="flex h-full flex-col bg-white"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        addFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-2">
        <PenLine className="h-3.5 w-3.5 shrink-0 text-brand-red" />
        <span className="text-[12.5px] font-semibold text-ink">Correo nuevo</span>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Descartar el correo"
          title="Descartar el correo"
          className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-edge
            text-brand-gray outline-none transition-colors hover:bg-fill hover:text-ink
            focus-visible:ring-3 focus-visible:ring-brand-red/20"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-1.5
        transition-colors focus-within:bg-canvas">
        <span className={fieldLabelClass}>Para</span>
        <input
          ref={toRef}
          value={to}
          onChange={(event) => setTo(event.target.value)}
          placeholder="correo@dominio.com, otro@dominio.com"
          className="min-w-0 flex-1 bg-transparent text-[12px] text-ink outline-none placeholder:text-faint"
        />
        {!ccOpen && (
          <button
            type="button"
            onClick={() => setCcOpen(true)}
            title="Agregar copia"
            className="shrink-0 rounded-edge px-1.5 py-0.5 font-heading text-[10.5px] font-bold
              uppercase tracking-[0.08em] text-faint outline-none transition-colors
              hover:bg-fill hover:text-brand-red focus-visible:ring-3 focus-visible:ring-brand-red/20"
          >
            CC
          </button>
        )}
      </div>

      {ccOpen && (
        <div className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-1.5
          transition-colors focus-within:bg-canvas">
          <span className={fieldLabelClass}>CC</span>
          <input
            ref={ccRef}
            value={cc}
            onChange={(event) => setCc(event.target.value)}
            placeholder="correo@dominio.com, otro@dominio.com"
            className="min-w-0 flex-1 bg-transparent text-[12px] text-ink outline-none placeholder:text-faint"
          />
          <button
            type="button"
            onClick={() => {
              setCcOpen(false);
              setCc("");
            }}
            aria-label="Quitar la copia"
            title="Quitar la copia"
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-edge text-faint
              outline-none transition-colors hover:bg-fill hover:text-ink
              focus-visible:ring-3 focus-visible:ring-brand-red/20"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-1.5
        transition-colors focus-within:bg-canvas">
        <span className={fieldLabelClass}>Asunto</span>
        <input
          ref={subjectRef}
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="De qué se trata"
          className="min-w-0 flex-1 bg-transparent text-[12px] font-medium text-ink outline-none
            placeholder:font-normal placeholder:text-faint"
        />
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto"
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            if (ready) handleSend();
          }
        }}
      >
        <LazyBlockEditor onChange={setBlocks} placeholder="Escribe el mensaje…" />
      </div>

      {files.length > 0 && (
        <div className="flex shrink-0 flex-wrap gap-1.5 border-t border-line px-4 py-2">
          {files.map((file, position) => (
            <span
              key={`${file.name}-${position}`}
              className="inline-flex items-center gap-1.5 rounded-edge border border-line
                bg-canvas px-2 py-1 text-[11.5px] text-brand-gray"
            >
              <Paperclip className="h-3 w-3 text-faint" />
              <span className="max-w-[160px] truncate">{file.name}</span>
              <span className="text-faint">{formatBytes(file.size)}</span>
              <button
                type="button"
                onClick={() => setFiles(files.filter((_, at) => at !== position))}
                aria-label={`Quitar ${file.name}`}
                className="text-faint transition-colors hover:text-brand-red"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {error && (
        <div className="shrink-0 px-4 py-2">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <div className="flex shrink-0 items-center gap-2 border-t border-line px-4 py-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-edge border border-line bg-canvas
            px-2 py-1 text-[11.5px] font-medium text-brand-gray outline-none
            transition-[background-color,border-color,color]
            hover:border-line-strong hover:bg-white hover:text-ink
            focus-visible:ring-3 focus-visible:ring-brand-red/20"
        >
          <Paperclip className="h-3.5 w-3.5" />
          Adjuntar
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
        <span className="truncate text-[11px] text-faint">
          Sale de la casilla de soporte, con tu nombre y tu firma.
        </span>

        <div className="ml-auto flex shrink-0 gap-2">
          <PfButton variant="ghost" size="sm" className="h-7 px-3" onClick={onCancel}>
            Descartar
          </PfButton>
          <SendValidationButton
            ready={ready}
            sending={sending}
            missingItems={missingItems}
            onSend={handleSend}
            onFocusField={handleFocusField}
          />
        </div>
      </div>
    </div>
  );
}
