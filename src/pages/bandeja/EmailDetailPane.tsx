import {
  Archive,
  ArchiveRestore,
  CornerDownRight,
  CornerUpLeft,
  Forward,
  Paperclip,
  RotateCcw,
  ShieldAlert,
  Ticket as TicketIcon,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../api/client";
import { emailsApi } from "../../api/emails";
import { Alert } from "../../components/ui/Alert";
import { Button as PfButton } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "../../context/useAuth";
import { useEmailCounts } from "../../context/useEmailCounts";
import { useNoticeInset, useReceipts } from "../../context/useReceipts";
import { Avatar, AvatarFallback } from "../../components/shadcn/avatar";
import { Badge } from "../../components/shadcn/badge";
import { Button } from "../../components/shadcn/button";
import { Separator } from "../../components/shadcn/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/shadcn/tooltip";
import {
  formatBytes,
  formatDateTime,
  formatEmailListDate,
  formatTicketCode,
} from "../../lib/format";
import type { EmailAttachmentResponse, EmailDetailResponse } from "../../types/api";
import { LazyBlockEditor } from "../../components/ui/LazyBlockEditor";
import { blocksToEmailHtml, blocksToText } from "../../lib/emailHtml";
import { clearDraft, readDraft, writeDraft } from "../../lib/drafts";
import { AttachmentPreviewModal } from "./AttachmentPreviewModal";
import { fieldLabelClass } from "./toolbarStyles";
import { ticketBadgeClass } from "./badgeStyles";
import { SendValidationButton } from "./SendValidationButton";
import { type ValidationItem } from "./sendValidation";

/** Que adjunto se esta mirando: puede ser del correo o de una respuesta nuestra. */
interface PreviewTarget {
  emailId: number;
  attachments: EmailAttachmentResponse[];
  index: number;
}

const MAX_FILES = 5;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;

interface EmailDetailPaneProps {
  emailId: number;
  /** Avisa al panel de la lista para que refresque (el correo puede salir del filtro actual). */
  onTicketCreated: () => void;
  /** El correo cambió de carpeta: ya no pertenece a la vista actual. */
  onMoved: () => void;
  /** Cierra el panel y deja la lista sin seleccion. */
  onClose: () => void;
}

/** Su unico trabajo es existir: mientras el editor este abierto, el recibo se corre hacia arriba. */
function ComposerInset() {
  useNoticeInset(44);
  return null;
}

interface MoveKind {
  action: string;
  done: string;
  failed: string;
  run: (id: number) => Promise<void>;
}

const MOVES: Record<string, MoveKind> = {
  archivar: {
    action: "archivar",
    done: "Archivado",
    failed: "No se pudo archivar",
    run: (id) => emailsApi.archive(id),
  },
  junk: {
    action: "junk",
    done: "Movido a No deseado",
    failed: "No se pudo mover a No deseado",
    run: (id) => emailsApi.markAsJunk(id),
  },
  papelera: {
    action: "papelera",
    done: "Movido a la papelera",
    failed: "No se pudo mover a la papelera",
    run: (id) => emailsApi.trash(id),
  },
  restaurar: {
    action: "restaurar",
    done: "Devuelto a la bandeja",
    failed: "No se pudo restaurar",
    run: (id) => emailsApi.restore(id),
  },
};

/** Botones que abren el editor al pie: responder y reenviar. */
const composerOpenerClass =
  "flex w-full min-w-0 items-center justify-center gap-2 rounded-edge border border-line bg-canvas px-3 py-2 " +
  "text-[12px] font-medium text-subtle outline-none transition-[background-color,border-color,color] " +
  "hover:border-line-strong hover:bg-white hover:text-ink " +
  "focus-visible:border-brand-red/40 focus-visible:ring-3 focus-visible:ring-brand-red/12";

/** Acciones de la barra: gris de texto en reposo, tinta sobre relleno al pasar. */
const toolButtonClass =
  "size-7 text-brand-gray transition-colors hover:bg-fill hover:text-ink " +
  "focus-visible:ring-brand-red/20 focus-visible:border-brand-red/30";

/** Lo que informa el proveedor del envio. "Sent" no se muestra: es el estado normal. */
const deliveryLabels: Record<string, { label: string; className: string }> = {
  Queued: { label: "En cola", className: "text-warn" },
  Delivered: { label: "Entregado", className: "text-brand-green" },
  Delayed: { label: "Demorado", className: "text-warn" },
  Bounced: { label: "No entregado", className: "text-brand-red" },
  Complained: { label: "Marcado como spam", className: "text-brand-red" },
  Failed: { label: "No se pudo enviar", className: "text-brand-red" },
};

/** Estados que merecen un aviso al abrir el correo, no solo una etiqueta en la tira. */
const alertingStatuses = new Set(["Queued", "Bounced", "Complained", "Failed"]);

type ComposerMode = "reply" | "forward";

/** Boton pequeno de la fila "Para": abre CC, CCO o pone a todos en copia. */
const fieldToggleClass =
  "shrink-0 rounded-edge px-1.5 py-0.5 font-heading text-[10.5px] font-bold uppercase " +
  "tracking-[0.08em] text-faint outline-none transition-colors hover:bg-fill hover:text-brand-red " +
  "focus-visible:ring-3 focus-visible:ring-brand-red/20";

const fieldInputClass =
  "min-w-0 flex-1 bg-transparent text-[12px] text-ink outline-none placeholder:text-faint";

const fieldCloseClass =
  "flex h-5 w-5 shrink-0 items-center justify-center rounded-edge text-faint outline-none " +
  "transition-colors hover:bg-fill hover:text-ink focus-visible:ring-3 focus-visible:ring-brand-red/20";

/** Primer renglon con contenido: es el resumen que cabe en una linea de la lista. */
function firstLine(text: string) {
  return text.split("\n").find((line) => line.trim() !== "")?.trim() ?? "";
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * El cuerpo del correo viene de un remitente externo: nunca se inyecta con
 * dangerouslySetInnerHTML. Un iframe con sandbox vacio lo aisla por completo
 * (sin scripts, sin acceso al DOM de la app) y aun asi se ve con su formato.
 */
export function EmailDetailPane({ emailId, onTicketCreated, onMoved, onClose }: EmailDetailPaneProps) {
  const [email, setEmail] = useState<EmailDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<ComposerMode>("reply");
  const [replyBlocks, setReplyBlocks] = useState<unknown>(null);
  const [draftBlocks, setDraftBlocks] = useState<unknown>(null);
  const tokenRef = useRef<string>("");
  const [forwardTo, setForwardTo] = useState("");
  const [replyCc, setReplyCc] = useState("");
  const [ccOpen, setCcOpen] = useState(false);
  const [replyBcc, setReplyBcc] = useState("");
  const [bccOpen, setBccOpen] = useState(false);
  const [includeAttachments, setIncludeAttachments] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);
  const ccRef = useRef<HTMLInputElement>(null);
  const bccRef = useRef<HTMLInputElement>(null);
  const replyContainerRef = useRef<HTMLDivElement>(null);
  const [openReplyId, setOpenReplyId] = useState<number | null>(null);
  const isAdmin = Boolean(useAuth().user?.isAdmin);

  // Lo escrito, en texto plano: sirve para el aviso de vacio y para el cuerpo sin formato.
  const replyText = blocksToText(replyBlocks);
  const [reloadKey, setReloadKey] = useState(0);
  const { onInboxChanged } = useEmailCounts();
  const receipts = useReceipts();
  const isForward = composerMode === "forward";

  // Al reenviar el comentario es opcional: lo que no puede faltar es a quien va.
  const replyMissingItems: ValidationItem[] = [];
  if (isForward && forwardTo.trim() === "") {
    replyMissingItems.push({
      id: "to",
      label: "Falta el destinatario (Para)",
      short: "el destinatario (Para)",
    });
  }
  if (!isForward && replyText.trim() === "") {
    replyMissingItems.push({
      id: "body",
      label: "Falta escribir el mensaje de respuesta",
      short: "el mensaje de respuesta",
    });
  }
  const replyReady = replyMissingItems.length === 0;

  function handleFocusReplyField(fieldId: string) {
    if (fieldId === "to") {
      toRef.current?.focus();
    } else if (fieldId === "body") {
      const editorEl = replyContainerRef.current?.querySelector('[contenteditable="true"]');
      if (editorEl instanceof HTMLElement) editorEl.focus();
    }
  }

  useEffect(() => {
    let cancelled = false;
    emailsApi
      .get(emailId)
      .then((data) => {
        if (!cancelled) setEmail(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "No se pudo cargar el correo");
      });

    return () => {
      cancelled = true;
    };
  }, [emailId, reloadKey]);

  useEffect(() => onInboxChanged(() => setReloadKey((current) => current + 1)), [onInboxChanged]);

  async function handleCreateTicket() {
    if (!email) return;
    setCreating(true);
    setCreateError(null);
    try {
      const ticket = await emailsApi.createTicket(email.id);
      setEmail({ ...email, ticketId: ticket.id });
      onTicketCreated();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "No se pudo crear el ticket");
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    if (!replyOpen) return;
    writeDraft(String(emailId), {
      blocks: replyBlocks,
      body: replyText,
      cc: replyCc,
      bcc: replyBcc,
      to: isForward ? forwardTo : undefined,
    });
  }, [replyOpen, emailId, replyBlocks, replyText, replyCc, replyBcc, forwardTo, isForward]);

  useEffect(() => {
    if (ccOpen) ccRef.current?.focus();
  }, [ccOpen]);

  useEffect(() => {
    if (bccOpen) bccRef.current?.focus();
  }, [bccOpen]);

  useEffect(() => {
    if (openReplyId === null) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenReplyId(null);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [openReplyId]);

  async function handleReply() {
    if (!email || sending || !replyReady) return;
    setSending(true);
    setReplyError(null);

    const input = {
      body: replyText,
      bodyHtml: blocksToEmailHtml(replyBlocks),
      cc: replyCc.trim() || undefined,
      bcc: replyBcc.trim() || undefined,
      files,
      clientToken: tokenRef.current,
    };

    try {
      const sent = isForward
        ? await emailsApi.forward(email.id, { ...input, to: forwardTo, includeAttachments })
        : await emailsApi.reply(email.id, input);

      // En cola: el proveedor no respondio y saldra solo; conviene decirlo en vez de "enviado".
      const queued = sent.deliveryStatus === "Queued";
      receipts.done({
        action: isForward ? "reenviar" : "responder",
        title: queued
          ? "Guardado en la cola de salida"
          : isForward
            ? "Correo reenviado"
            : "Respuesta enviada",
        detail: queued
          ? "El proveedor no respondió; se reintentará solo"
          : isForward
            ? forwardTo
            : (email.fromName ?? email.fromEmail),
      });

      clearDraft(String(email.id));
      // El reenvio abre conversacion propia: no forma parte de este hilo.
      if (!isForward) {
        setEmail({ ...email, thread: [...(email.thread ?? []), sent] });
        setOpenReplyId(sent.id);
      }
      resetComposer();
      setReplyOpen(false);
    } catch (err) {
      setReplyError(
        err instanceof ApiError
          ? err.message
          : isForward
            ? "No se pudo reenviar el correo"
            : "No se pudo enviar la respuesta",
      );
    } finally {
      setSending(false);
    }
  }

  function resetComposer() {
    setReplyBlocks(null);
    setDraftBlocks(null);
    setForwardTo("");
    setReplyCc("");
    setCcOpen(false);
    setReplyBcc("");
    setBccOpen(false);
    setIncludeAttachments(true);
    setFiles([]);
  }

  // Vuelve a encolar un envio que agoto sus reintentos; el estado pasa a "en cola" al instante.
  async function handleRetry(messageId: number) {
    if (!email || retrying) return;
    setRetrying(true);

    try {
      const updated = await emailsApi.retry(messageId);
      setEmail({
        ...email,
        thread: (email.thread ?? []).map((message) => (message.id === updated.id ? updated : message)),
      });
      receipts.done({ action: "reintentar", title: "Vuelto a la cola de salida", detail: updated.toEmails.join(", ") });
    } catch (err) {
      receipts.failed({
        action: "reintentar",
        title: "No se pudo reintentar",
        detail: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setRetrying(false);
    }
  }

  function addFiles(incoming: File[]) {
    if (incoming.length === 0) return;

    const merged = [...files, ...incoming];
    const total = merged.reduce((sum, file) => sum + file.size, 0);

    if (merged.length > MAX_FILES) {
      setReplyError(`No se pueden adjuntar más de ${MAX_FILES} archivos.`);
      return;
    }

    if (total > MAX_TOTAL_BYTES) {
      setReplyError("Los adjuntos superan los 10 MB en total.");
      return;
    }

    setReplyError(null);
    setFiles(merged);
  }

  function openComposer(mode: ComposerMode) {
    tokenRef.current = crypto.randomUUID();
    setComposerMode(mode);
    const draft = readDraft(String(emailId));

    if (draft) {
      setDraftBlocks(draft.blocks ?? null);
      setReplyBlocks(draft.blocks ?? null);
      if (draft.cc) {
        setReplyCc(draft.cc);
        setCcOpen(true);
      }
      if (draft.bcc) {
        setReplyBcc(draft.bcc);
        setBccOpen(true);
      }
      if (mode === "forward" && draft.to) setForwardTo(draft.to);
    }

    setReplyOpen(true);
  }

  function closeComposer() {
    setReplyOpen(false);
    setReplyError(null);
  }

  /**
   * El servidor ya movio el correo cuando esto vuelve, asi que el recibo no promete
   * deshacer: ofrece la accion inversa, que es otro viaje y puede fallar por su cuenta.
   */
  async function handleMove(move: MoveKind) {
    if (!email || moving) return;
    setMoving(true);

    try {
      await move.run(email.id);
      onMoved();

      receipts.done({
        action: move.action,
        title: move.done,
        detail: email.fromName ?? email.fromEmail,
        undo: move.action === "restaurar"
          ? undefined
          : {
              label: "Devolver a la bandeja",
              run: async () => {
                await emailsApi.restore(email.id);
                onMoved();
              },
            },
      });
    } catch (err) {
      // Antes esto se tragaba el error y el correo parecia movido sin haberse movido.
      receipts.failed({
        action: move.action,
        title: move.failed,
        detail: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setMoving(false);
    }
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="error">{error}</Alert>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const displayName = email.fromName ?? email.fromEmail;
  const isOutbound = email.direction === "Outbound";
  // Quienes ya estaban en el hilo: el servidor ya descarto nuestra casilla y al remitente.
  const replyAll = email.otherRecipients ?? [];
  const isInInbox = email.folder === "Inbox";

  // Un API sin este campo no debe tumbar el panel entero.
  const thread = email.thread ?? [];
  // El correo abierto ya se ve completo arriba: en la tira va el resto de la conversacion.
  const others = thread.filter((message) => message.id !== email.id);
  const openReply = thread.find((message) => message.id === openReplyId) ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center px-2 py-1.5">
        <div className="flex items-center gap-1">
          {isInInbox ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={toolButtonClass}
                    disabled={moving}
                    onClick={() => handleMove(MOVES.archivar)}
                  >
                    <Archive />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Archivar</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={toolButtonClass}
                    disabled={moving}
                    onClick={() => handleMove(MOVES.junk)}
                  >
                    <ShieldAlert />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Marcar como no deseado</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={toolButtonClass}
                    disabled={moving}
                    onClick={() => handleMove(MOVES.papelera)}
                  >
                    <Trash2 />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Mover a la papelera</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={toolButtonClass}
                    disabled={moving}
                    onClick={() => handleMove(MOVES.restaurar)}
                  >
                    <ArchiveRestore />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Restaurar a la bandeja</TooltipContent>
              </Tooltip>
              {email.folder === "Trash" && isAdmin && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`${toolButtonClass} hover:text-brand-red-dark`}
                      disabled={moving}
                      onClick={() => setConfirmingDelete(true)}
                    >
                      <Trash2 />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Eliminar definitivamente</TooltipContent>
                </Tooltip>
              )}
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1">
          {email.ticketId ? (
            <Badge variant="secondary" className={ticketBadgeClass}>
              {formatTicketCode(email.ticketId)}
            </Badge>
          ) : (
            <PfButton size="sm" className="h-7 px-3" onClick={handleCreateTicket} isLoading={creating}>
              <TicketIcon className="h-[15px] w-[15px]" />
              Crear ticket
            </PfButton>
          )}

          <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-line" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className={toolButtonClass} onClick={onClose}>
                <X />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Cerrar el correo</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <Separator className="bg-line" />

      {createError && (
        <div className="px-4 pt-3">
          <Alert variant="error">{createError}</Alert>
        </div>
      )}

      <div className="px-4 pb-3 pt-2.5">
        <h2 className="font-heading text-[17px] font-bold leading-tight tracking-[-0.02em] text-ink">
          {email.subject || "(sin asunto)"}
        </h2>

        <div className="mt-2 flex items-center gap-2">
          <Avatar className="size-7 shrink-0">
            <AvatarFallback className="text-[10px]">{initials(displayName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-semibold text-ink">
              {displayName}
              {/* El nombre puede ser el propio correo: repetirlo no aporta. */}
              {displayName !== email.fromEmail && (
                <span className="ml-1.5 font-normal text-subtle">{email.fromEmail}</span>
              )}
            </p>
            <p className="truncate text-[11px] text-faint">
              Para: {email.toEmails.join(", ") || "—"}
              {email.ccEmails.length > 0 && ` · CC: ${email.ccEmails.join(", ")}`}
              {(email.bccEmails ?? []).length > 0 && ` · CCO: ${email.bccEmails.join(", ")}`}
            </p>
          </div>
          <span className="ml-auto shrink-0 whitespace-nowrap text-[11px] font-medium text-faint">
            {formatDateTime(email.createdAt)}
          </span>
        </div>
      </div>

      <Separator className="bg-line" />

      <div className="relative min-h-0 flex-1">
        {replyOpen && (
          <div
            ref={replyContainerRef}
            className="absolute inset-0 z-20 flex flex-col bg-white"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              addFiles(Array.from(event.dataTransfer.files));
            }}
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-2">
              {isForward ? (
                <Forward className="h-3.5 w-3.5 shrink-0 text-brand-red" />
              ) : (
                <CornerUpLeft className="h-3.5 w-3.5 shrink-0 text-brand-red" />
              )}
              <span className="shrink-0 text-[12.5px] font-semibold text-ink">
                {isForward ? "Reenviar" : "Responder"}
              </span>
              <span className="truncate text-[11.5px] text-subtle">
                {email.subject ? `${isForward ? "Fwd" : "Re"}: ${email.subject}` : "(sin asunto)"}
              </span>
              <button
                type="button"
                onClick={closeComposer}
                aria-label="Cerrar el editor"
                title="Cerrar el editor"
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
              {isForward ? (
                <input
                  ref={toRef}
                  value={forwardTo}
                  onChange={(event) => setForwardTo(event.target.value)}
                  placeholder="correo@dominio.com, otro@dominio.com"
                  autoFocus
                  className={fieldInputClass}
                />
              ) : (
                <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-ink">
                  {email.fromEmail}
                </span>
              )}
              {!isForward && !ccOpen && replyAll.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setCcOpen(true);
                    setReplyCc(replyAll.join(", "));
                  }}
                  title="Copiar a todos los de la conversación"
                  className={fieldToggleClass}
                >
                  Todos
                </button>
              )}
              {!ccOpen && (
                <button type="button" onClick={() => setCcOpen(true)} title="Agregar copia" className={fieldToggleClass}>
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
              <div className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-1.5
                transition-colors focus-within:bg-canvas">
                <span className={fieldLabelClass}>CC</span>
                <input
                  ref={ccRef}
                  value={replyCc}
                  onChange={(event) => setReplyCc(event.target.value)}
                  placeholder="correo@dominio.com, otro@dominio.com"
                  className={fieldInputClass}
                />
                <button
                  type="button"
                  onClick={() => {
                    setCcOpen(false);
                    setReplyCc("");
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
              <div className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-1.5
                transition-colors focus-within:bg-canvas">
                <span className={fieldLabelClass}>CCO</span>
                <input
                  ref={bccRef}
                  value={replyBcc}
                  onChange={(event) => setReplyBcc(event.target.value)}
                  placeholder="Nadie más ve a quién va esta copia"
                  className={fieldInputClass}
                />
                <button
                  type="button"
                  onClick={() => {
                    setBccOpen(false);
                    setReplyBcc("");
                  }}
                  aria-label="Quitar la copia oculta"
                  title="Quitar la copia oculta"
                  className={fieldCloseClass}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {isForward && email.attachments.length > 0 && (
              <label className="flex shrink-0 cursor-pointer items-center gap-2 border-b border-line px-4 py-1.5
                text-[11.5px] text-brand-gray">
                <input
                  type="checkbox"
                  checked={includeAttachments}
                  onChange={(event) => setIncludeAttachments(event.target.checked)}
                  className="h-3.5 w-3.5 accent-brand-red"
                />
                Incluir {email.attachments.length === 1 ? "el adjunto original" : `los ${email.attachments.length} adjuntos originales`}
              </label>
            )}

            <div
              className="min-h-0 flex-1 overflow-y-auto"
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                  if (replyReady) handleReply();
                }
              }}
            >
              <LazyBlockEditor
                initialContent={draftBlocks}
                onChange={setReplyBlocks}
                placeholder={isForward ? "Comentario opcional…" : "Escribe la respuesta…"}
              />
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

            {replyError && (
              <div className="shrink-0 px-4 pb-2 pt-2">
                <Alert variant="error">{replyError}</Alert>
              </div>
            )}

            <ComposerInset />
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
                Hasta {MAX_FILES} archivos, 10 MB · también puedes soltarlos aquí
              </span>

              <div className="ml-auto flex shrink-0 gap-2">
                <PfButton variant="ghost" size="sm" className="h-7 px-3" onClick={closeComposer}>
                  Cancelar
                </PfButton>
                <SendValidationButton
                  ready={replyReady}
                  sending={sending}
                  missingItems={replyMissingItems}
                  onSend={handleReply}
                  onFocusField={handleFocusReplyField}
                />
              </div>
            </div>
          </div>
        )}

        {openReply && (
          <div className="absolute inset-0 z-10 flex flex-col bg-white">
            <div className="flex shrink-0 items-start gap-2 border-b border-line px-4 py-2.5">
              {openReply.direction === "Outbound" ? (
                <CornerUpLeft className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-red" />
              ) : (
                <CornerDownRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-[13.5px] font-bold tracking-[-0.01em] text-ink">
                  {openReply.subject}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-subtle">
                  <span className="font-semibold text-brand-gray">
                    {openReply.direction === "Outbound" ? openReply.authorName : "Del cliente"}
                  </span>
                  {" · "}
                  {openReply.fromName ?? openReply.fromEmail}
                  {" · Para: "}
                  {openReply.toEmails.join(", ")}
                  {(openReply.bccEmails ?? []).length > 0 && ` · CCO: ${openReply.bccEmails.join(", ")}`}
                </p>
              </div>
              <span className="shrink-0 whitespace-nowrap text-[11px] font-medium text-faint">
                {formatDateTime(openReply.createdAt)}
              </span>
              <button
                type="button"
                onClick={() => setOpenReplyId(null)}
                aria-label="Volver al correo"
                title="Volver al correo"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-edge text-brand-gray
                  outline-none transition-colors hover:bg-fill hover:text-ink
                  focus-visible:ring-3 focus-visible:ring-brand-red/20"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {openReply.deliveryStatus && alertingStatuses.has(openReply.deliveryStatus) && (
              <div className="shrink-0 border-b border-line px-4 py-2">
                <Alert variant={openReply.deliveryStatus === "Queued" ? "info" : "error"}>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>
                      {deliveryLabels[openReply.deliveryStatus].label}.{" "}
                      {openReply.deliveryStatus === "Queued"
                        ? `Se reintentará solo. ${openReply.deliveryDetail ?? ""}`
                        : (openReply.deliveryDetail ?? "El proveedor no dio más detalle.")}
                    </span>
                    {openReply.deliveryStatus === "Failed" && (
                      <PfButton
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2"
                        isLoading={retrying}
                        onClick={() => handleRetry(openReply.id)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reintentar
                      </PfButton>
                    )}
                  </span>
                </Alert>
              </div>
            )}

            {openReply.bodyHtml && openReply.direction === "Inbound" ? (
              <iframe
                key={openReply.id}
                sandbox=""
                srcDoc={openReply.bodyHtml}
                title={`Correo de ${openReply.fromEmail}`}
                className="min-h-0 w-full flex-1 border-0 bg-white"
              />
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap px-4 py-3 text-[13px] leading-relaxed text-ink">
                {openReply.bodyText}
              </div>
            )}

            {openReply.attachments.length > 0 && (
              <div className="flex shrink-0 flex-wrap gap-1.5 border-t border-line px-4 py-2">
                {openReply.attachments.map((attachment, position) => (
                  <button
                    key={attachment.id}
                    type="button"
                    onClick={() =>
                      setPreview({
                        emailId: openReply.id,
                        attachments: openReply.attachments,
                        index: position,
                      })
                    }
                    className="group inline-flex items-center gap-1.5 rounded-edge border border-line
                      bg-canvas px-2 py-1 text-[11.5px] text-brand-gray outline-none
                      transition-[background-color,border-color,color]
                      hover:border-brand-red/35 hover:bg-white hover:text-ink
                      focus-visible:ring-3 focus-visible:ring-brand-red/12"
                  >
                    <Paperclip className="h-3 w-3 text-faint transition-colors group-hover:text-brand-red" />
                    {attachment.fileName}
                    <span className="text-subtle">· {formatBytes(attachment.sizeBytes)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {email.bodyHtml ? (
          <iframe
            key={email.id}
            sandbox=""
            srcDoc={email.bodyHtml}
            title="Cuerpo del correo"
            className="h-full w-full border-0 bg-white"
          />
        ) : email.bodyText ? (
          <pre className="h-full overflow-y-auto whitespace-pre-wrap p-4 text-[13px] leading-relaxed text-ink">
            {email.bodyText}
          </pre>
        ) : (
          <p className="p-4 text-[13px] text-subtle">Este correo no tiene contenido.</p>
        )}
      </div>

      {email.attachments.length > 0 && (
        <>
          <Separator className="bg-line" />
          <div className="shrink-0 px-4 py-2.5">
            <p className="mb-1.5 font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">
              Adjuntos ({email.attachments.length})
            </p>

            <div className="flex flex-wrap gap-2">
              {email.attachments.map((attachment, position) => (
                <button
                  key={attachment.id}
                  type="button"
                  disabled={!attachment.available}
                  onClick={() =>
                    setPreview({ emailId: email.id, attachments: email.attachments, index: position })
                  }
                  title={
                    attachment.available
                      ? `Ver ${attachment.fileName}`
                      : "El archivo se eliminó por antigüedad"
                  }
                  className="group inline-flex items-center gap-1.5 rounded-edge border border-line
                    bg-canvas px-2 py-1 text-[11.5px] text-brand-gray outline-none
                    transition-[background-color,border-color,color]
                    hover:border-brand-red/35 hover:bg-white hover:text-ink
                    focus-visible:border-brand-red/40 focus-visible:ring-3 focus-visible:ring-brand-red/12
                    disabled:cursor-not-allowed disabled:line-through disabled:opacity-50
                    disabled:hover:border-line disabled:hover:bg-canvas disabled:hover:text-brand-gray"
                >
                  <Paperclip className="h-3.5 w-3.5 text-faint transition-colors group-hover:text-brand-red" />
                  {attachment.fileName}
                  <span className="text-subtle">· {formatBytes(attachment.sizeBytes)}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <Separator className="bg-line" />

      <div className="shrink-0 px-4 py-2.5">
        {others.length > 0 && (
          <div className="mb-2 max-h-24 overflow-y-auto pr-0.5">
            {others.map((reply) => (
              <button
                key={reply.id}
                type="button"
                onClick={() => setOpenReplyId(reply.id === openReplyId ? null : reply.id)}
                data-open={reply.id === openReplyId}
                className="flex w-full items-center gap-1.5 rounded-edge px-1.5 py-1 text-left
                  outline-none transition-colors hover:bg-fill
                  focus-visible:ring-3 focus-visible:ring-brand-red/12
                  data-[open=true]:bg-brand-red/[0.06]"
              >
                {reply.direction === "Outbound" ? (
                  <CornerUpLeft className="h-3 w-3 shrink-0 text-brand-red" />
                ) : (
                  <CornerDownRight className="h-3 w-3 shrink-0 text-faint" />
                )}
                <span className="shrink-0 text-[11.5px] font-semibold text-ink">
                  {reply.direction === "Outbound"
                    ? reply.authorName
                    : reply.fromName ?? reply.fromEmail}
                </span>
                <span className="truncate text-[11.5px] text-subtle">
                  {firstLine(reply.bodyText)}
                </span>
                {reply.deliveryStatus && deliveryLabels[reply.deliveryStatus] && (
                  <span
                    className={`ml-auto shrink-0 text-[10.5px] font-semibold
                      ${deliveryLabels[reply.deliveryStatus].className}`}
                  >
                    {deliveryLabels[reply.deliveryStatus].label}
                  </span>
                )}
                <span
                  className={`shrink-0 text-[10.5px] font-medium text-faint ${
                    reply.deliveryStatus && deliveryLabels[reply.deliveryStatus] ? "" : "ml-auto"
                  }`}
                >
                  {formatEmailListDate(reply.createdAt)}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Dos botones iguales a todo el ancho; lo enviado no se responde, asi que queda solo reenviar. */}
        <div className={`grid gap-2 ${isOutbound ? "grid-cols-1" : "grid-cols-2"}`}>
          {!isOutbound && (
            <button
              type="button"
              onClick={() => openComposer("reply")}
              title={`Responder a ${email.fromName ?? email.fromEmail}`}
              className={composerOpenerClass}
            >
              <CornerUpLeft className="h-3.5 w-3.5 text-faint" />
              Responder
            </button>
          )}
          <button
            type="button"
            onClick={() => openComposer("forward")}
            title="Reenviar este correo a otra dirección"
            className={composerOpenerClass}
          >
            <Forward className="h-3.5 w-3.5 text-faint" />
            Reenviar
          </button>
        </div>
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          eyebrow="Papelera"
          icon={Trash2}
          title="Eliminar definitivamente"
          description={
            <>
              Se borrará la conversación con {displayName} y sus adjuntos. Si pertenece a un ticket no se
              elimina: es el historial del caso. Esto no se puede deshacer.
            </>
          }
          confirmLabel="Eliminar"
          onConfirm={async () => {
            await emailsApi.remove(email.id);
            receipts.done({ action: "eliminar", title: "Eliminado definitivamente", detail: displayName });
            onMoved();
          }}
          onClose={() => setConfirmingDelete(false)}
        />
      )}

      {preview && (
        <AttachmentPreviewModal
          emailId={preview.emailId}
          attachments={preview.attachments}
          index={preview.index}
          onIndexChange={(index) => setPreview({ ...preview, index })}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
