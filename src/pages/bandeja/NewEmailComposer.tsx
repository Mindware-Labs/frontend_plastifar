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
import { fieldLabelClass, fieldToggleClass, fieldCloseClass } from "./toolbarStyles";
import { SendValidationButton } from "./SendValidationButton";
import { CannedPicker, textToBlocks } from "./CannedPicker";
import { RecipientInput } from "./RecipientInput";
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
  const [bcc, setBcc] = useState("");
  const [bccOpen, setBccOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [blocks, setBlocks] = useState<unknown>(null);
  const [initialBlocks, setInitialBlocks] = useState<unknown>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const receipts = useReceipts();
  const containerRef = useRef<HTMLDivElement>(null);
  const toRef = useRef<HTMLInputElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const ccRef = useRef<HTMLInputElement>(null);
  const bccRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // La marca del envio nace con el editor: un reintento la repite y no duplica el correo.
  const tokenRef = useRef(crypto.randomUUID());

  useEffect(() => {
    toRef.current?.focus();
  }, []);

  // El texto elegido se suma a lo escrito; el editor se vuelve a montar porque solo lee el contenido inicial.
  function insertCanned(text: string) {
    const next = [...(Array.isArray(blocks) ? (blocks as unknown[]) : []), ...textToBlocks(text)];
    setInitialBlocks(next);
    setBlocks(next);
    setEditorKey((key) => key + 1);
  }

  useNoticeInset(44);

  useEffect(() => {
    if (ccOpen) ccRef.current?.focus();
  }, [ccOpen]);

  useEffect(() => {
    if (bccOpen) bccRef.current?.focus();
  }, [bccOpen]);

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
        bcc: bcc.trim() || undefined,
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
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-100 bg-zinc-50/40 px-4 py-2">
        <PenLine className="h-3.5 w-3.5 shrink-0 text-brand-red" />
        <span className="text-[12.5px] font-semibold text-zinc-900">Correo nuevo</span>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Descartar el correo"
          title="Descartar el correo"
          className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-400 outline-none transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-400/20 cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-3 border-b border-zinc-100 px-4 py-1.5 transition-colors focus-within:bg-zinc-50/50">
        <span className={fieldLabelClass}>Para</span>
        <RecipientInput
          inputRef={toRef}
          value={to}
          onChange={setTo}
          placeholder="correo@dominio.com, otro@dominio.com"
        />
        {!ccOpen && (
          <button
            type="button"
            onClick={() => setCcOpen(true)}
            title="Agregar copia"
            className={fieldToggleClass}
          >
            CC
          </button>
        )}
        {!bccOpen && (
          <button
            type="button"
            onClick={() => setBccOpen(true)}
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
            onChange={setCc}
            placeholder="correo@dominio.com, otro@dominio.com"
          />
          <button
            type="button"
            onClick={() => {
              setCcOpen(false);
              setCc("");
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
            onChange={setBcc}
            placeholder="Nadie más ve a quién va esta copia"
          />
          <button
            type="button"
            onClick={() => {
              setBccOpen(false);
              setBcc("");
            }}
            aria-label="Quitar la copia oculta"
            title="Quitar la copia oculta"
            className={fieldCloseClass}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="flex shrink-0 items-center gap-3 border-b border-zinc-100 px-4 py-1.5 transition-colors focus-within:bg-zinc-50/50">
        <span className={fieldLabelClass}>Asunto</span>
        <input
          ref={subjectRef}
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="De qué se trata"
          className="min-w-0 flex-1 bg-transparent text-[12.5px] font-medium text-zinc-900 outline-none placeholder:font-normal placeholder:text-zinc-400"
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
        <LazyBlockEditor key={editorKey} initialContent={initialBlocks} onChange={setBlocks} placeholder="Escribe el mensaje…" />
      </div>

      {files.length > 0 && (
        <div className="flex shrink-0 flex-wrap gap-1.5 border-t border-zinc-100 px-4 py-2">
          {files.map((file, position) => (
            <span
              key={`${file.name}-${position}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[11.5px] text-zinc-700 shadow-2xs"
            >
              <Paperclip className="h-3 w-3 text-zinc-400" />
              <span className="max-w-[160px] truncate">{file.name}</span>
              <span className="text-zinc-400">· {formatBytes(file.size)}</span>
              <button
                type="button"
                onClick={() => setFiles(files.filter((_, at) => at !== position))}
                aria-label={`Quitar ${file.name}`}
                className="text-zinc-400 transition-colors hover:text-brand-red cursor-pointer"
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

      <div className="flex shrink-0 items-center gap-2 border-t border-zinc-100 px-4 py-2.5 bg-zinc-50/30">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white
            px-2.5 text-[12px] font-medium text-zinc-700 shadow-2xs outline-none
            transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900
            active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-zinc-400/20 cursor-pointer"
        >
          <Paperclip className="h-3.5 w-3.5 text-zinc-500" />
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
        <CannedPicker onPick={insertCanned} />
        <span className="truncate text-[11px] font-medium text-zinc-400">
          Sale de la casilla de soporte, con tu nombre y tu firma.
        </span>

        <div className="ml-auto flex shrink-0 gap-2">
          <PfButton variant="ghost" size="sm" className="h-8 px-3" onClick={onCancel}>
            Descartar
          </PfButton>
          <SendValidationButton
            ready={ready}
            sending={sending}
            missingItems={missingItems}
            onSend={handleSend}
            onFocusField={handleFocusField}
            size="md"
          />
        </div>
      </div>
    </div>
  );
}
