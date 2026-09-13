import {
  Archive,
  ArchiveRestore,
  ArrowUpRight,
  CornerUpLeft,
  Download,
  Forward,
  LoaderCircle,
  Paperclip,
  PencilLine,
  RotateCcw,
  ShieldAlert,
  Star,
  Ticket as TicketIcon,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../api/client";
import { emailsApi } from "../../api/emails";
import { Alert } from "../../components/ui/Alert";
import { AnimatedCheckIcon } from "../../components/ui/AnimatedCheckIcon";
import { Button as PfButton } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Spinner } from "../../components/ui/Spinner";
import { TicketChip } from "../../components/app/TicketChip";
import { useAuth } from "../../context/useAuth";
import { useEmailCounts } from "../../context/useEmailCounts";
import { useNoticeInset, useReceipts } from "../../context/useReceipts";
import { Avatar, AvatarFallback } from "../../components/shadcn/avatar";
import { Button } from "../../components/shadcn/button";
import { Separator } from "../../components/shadcn/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/shadcn/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/shadcn/popover";
import {
  formatBytes,
  formatDateTime,
  formatEmailListDate,
  formatTicketCode,
} from "../../lib/format";
import type { ComposingPresence, EmailAttachmentResponse, EmailDetailResponse } from "../../types/api";
import { EmailBodyFrame } from "../../components/ui/EmailBodyFrame";
import { LazyBlockEditor } from "../../components/ui/LazyBlockEditor";
import { openOverlay } from "../../hooks/overlayStack";
import { useUploadFeedback } from "../../hooks/useUploadFeedback";
import { blocksToEmailHtml, blocksToText } from "../../lib/emailHtml";
import { clearDraft, readDraft, writeDraft } from "../../lib/drafts";
import { DELIVERY_LABELS, initialsFromName } from "../../lib/format";
import { CreateTicketModal } from "../tickets/CreateTicketModal";
import { AttachmentPreviewModal } from "./AttachmentPreviewModal";
import { CannedPicker } from "./CannedPicker";
import { textToBlocks } from "./textToBlocks";
import { AssignmentControl } from "./ConversationTools";
import { AddNotePanel, ConversationNotes } from "./ConversationNotes";
import { RecipientInput } from "./RecipientInput";
import { fieldLabelClass, fieldToggleClass, fieldCloseClass } from "./toolbarStyles";
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
  /** El correo cambió su estado de destacado. */
  onStarred?: (starred: boolean) => void;
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

const composerOpenerClass =
  "group flex h-9 w-full min-w-0 items-center justify-center gap-2 rounded-lg border border-zinc-200 " +
  "bg-white px-3.5 text-[12.5px] font-medium text-zinc-700 shadow-2xs outline-none " +
  "transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 active:scale-[0.99] " +
  "focus-visible:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-400/20 cursor-pointer";

/** Acciones de la barra: gris de texto en reposo, tinta sobre relleno al pasar. */
const toolButtonClass =
  "size-7 text-brand-gray transition-colors hover:bg-fill hover:text-ink " +
  "focus-visible:ring-brand-red/20 focus-visible:border-brand-red/30";

/** Color de cada estado de entrega. "Sent" no se muestra: es el estado normal. */
const deliveryTone: Record<string, string> = {
  Queued: "text-warn",
  Delivered: "text-brand-green",
  Delayed: "text-warn",
  Bounced: "text-brand-red",
  Complained: "text-brand-red",
  Failed: "text-brand-red",
};

/** Estados que merecen un aviso al abrir el correo, no solo una etiqueta en la tira. */
const alertingStatuses = new Set(["Queued", "Bounced", "Complained", "Failed"]);

/** La acotacion cuando el correo no se escribio desde aca. Null si salio de la bandeja. */
function ticketsNote(message: { direction: string; origin?: string }): string | null {
  if (message.origin !== "Tickets") return null;

  return message.direction === "Outbound"
    ? "Esta respuesta se envió desde el módulo de tickets."
    : "El cliente responde a un correo que se envió desde el módulo de tickets.";
}

interface TicketsOriginPopoverProps {
  note: string;
  ticketId: number | null;
}

/**
 * Alerta incrustada en la barra de herramientas al lado de la papelera:
 * no ocupa espacio en el cuerpo del correo y despliega una mini modal (popover)
 * flotante con la información contextual y el acceso directo al ticket.
 */
function TicketsOriginPopover({ note, ticketId }: TicketsOriginPopoverProps) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Ver información de origen del ticket"
              className="group/origin inline-flex h-7 cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-white pl-1 pr-2.5 text-zinc-700 shadow-2xs outline-none transition-[background-color,border-color,color] duration-200 ease-out hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-brand-red/25 data-[state=open]:border-zinc-300 data-[state=open]:bg-zinc-100 data-[state=open]:shadow-none motion-reduce:transition-none"
            >
              <span className="flex size-5 items-center justify-center rounded-md bg-brand-red/10 text-brand-red transition-colors duration-200 group-hover/origin:bg-brand-red group-hover/origin:text-white group-data-[state=open]/origin:bg-brand-red group-data-[state=open]/origin:text-white">
                <TicketIcon className="size-3" strokeWidth={2.25} />
              </span>
              <span className="font-heading text-[10px] font-bold uppercase leading-none tracking-[0.08em]">
                Origen: Tickets
              </span>
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Información de origen en Tickets</TooltipContent>
      </Tooltip>

      <PopoverContent align="start" sideOffset={6} className="w-80 p-3.5">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5 border-b border-line-soft pb-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-brand-red/20 bg-brand-red/8 text-brand-red shadow-2xs">
              <TicketIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h4 className="font-heading text-xs font-bold uppercase tracking-wider text-brand-red-dark">
                Módulo de Tickets
              </h4>
              <p className="text-[11px] text-subtle">Origen del correo</p>
            </div>
          </div>

          <p className="text-[12px] leading-relaxed text-ink">
            {note}
          </p>

          {ticketId && (
            <div className="border-t border-line-soft pt-2.5">
              <Link
                to={`/tickets/${ticketId}`}
                className="group flex w-full items-center justify-between rounded-edge border border-brand-red/25 bg-brand-red/[0.04] px-3 py-1.5 text-xs font-semibold text-brand-red-dark shadow-2xs transition-all hover:border-brand-red hover:bg-brand-red hover:text-white cursor-pointer"
                title="Abrir este ticket en el módulo de Tickets"
              >
                <span>Ver ticket {formatTicketCode(ticketId)}</span>
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}


function getThreadMessageBadge(message: { direction: string; subject?: string }) {
  if (message.direction !== "Outbound") {
    return {
      label: "Recibido por",
      className: "bg-zinc-100 text-zinc-700 border border-zinc-200/90",
    };
  }

  const sub = (message.subject ?? "").trim().toLowerCase();
  const isReply = sub.startsWith("re:");

  if (isReply) {
    return {
      label: "Respondido a",
      className: "bg-brand-red/10 text-brand-red-dark border border-brand-red/20",
    };
  }

  return {
    label: "Enviado a",
    className: "bg-sky-500/10 text-sky-800 border border-sky-500/25",
  };
}

type ComposerMode = "reply" | "forward";

/** Primer renglon con contenido: es el resumen que cabe en una linea de la lista. */
function firstLine(text: string) {
  return text.split("\n").find((line) => line.trim() !== "")?.trim() ?? "";
}

/** El cuerpo del correo viene de un remitente externo: se muestra siempre via EmailBodyFrame, nunca inyectado. */
export function EmailDetailPane({ emailId, onTicketCreated, onMoved, onStarred, onClose }: EmailDetailPaneProps) {
  const [email, setEmail] = useState<EmailDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreateTicketModalOpen, setIsCreateTicketModalOpen] = useState(false);
  const [justCreatedTicketId, setJustCreatedTicketId] = useState<number | null>(null);
  const [moving, setMoving] = useState(false);
  const [starring, setStarring] = useState(false);
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
  const {
    isShowing: showAttachedFeedback,
    isExiting: attachedExiting,
    trigger: triggerAttachedFeedback,
  } = useUploadFeedback({ duration: 2200, exitDuration: 360 });
  const [sending, setSending] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);
  const ccRef = useRef<HTMLInputElement>(null);
  const bccRef = useRef<HTMLInputElement>(null);
  const replyContainerRef = useRef<HTMLDivElement>(null);
  const [openReplyId, setOpenReplyId] = useState<number | null>(null);
  const [composers, setComposers] = useState<ComposingPresence[]>([]);
  const [editorKey, setEditorKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [dangerousToDownload, setDangerousToDownload] = useState<EmailAttachmentResponse | null>(null);
  const { user } = useAuth();
  const isAdmin = Boolean(user?.isAdmin);

  // Lo escrito, en texto plano: sirve para el aviso de vacio y para el cuerpo sin formato.
  const replyText = blocksToText(replyBlocks);
  const [reloadKey, setReloadKey] = useState(0);
  const [notesRefreshKey, setNotesRefreshKey] = useState(0);
  const { onInboxChanged, onComposing, setComposing, whoIsComposing } = useEmailCounts();
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

  // Quien mas esta escribiendo aqui: lo que ya estaba en curso al abrir, y lo que avise despues.
  useEffect(() => {
    let cancelled = false;
    whoIsComposing(emailId)
      .then((list) => {
        if (!cancelled) setComposers(list.filter((p) => p.staffId !== user?.staffId));
      })
      .catch(() => undefined);

    const off = onComposing((presence) => {
      if (presence.emailId !== emailId || presence.staffId === user?.staffId) return;
      setComposers((current) => {
        const others = current.filter((p) => p.staffId !== presence.staffId);
        return presence.active ? [...others, presence] : others;
      });
    });

    return () => {
      cancelled = true;
      off();
    };
  }, [emailId, onComposing, whoIsComposing, user?.staffId]);

  // Mientras el editor esta abierto, el resto del equipo lo sabe; al cerrar o cambiar de correo, deja de saberlo.
  useEffect(() => {
    if (!replyOpen) return;
    setComposing(emailId, true);
    return () => setComposing(emailId, false);
  }, [replyOpen, emailId, setComposing]);

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
    const overlay = openOverlay();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && overlay.isTop()) setOpenReplyId(null);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      overlay.close();
      document.removeEventListener("keydown", handleKeyDown);
    };
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
    triggerAttachedFeedback();
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

  // El texto elegido se suma a lo escrito; el editor se vuelve a montar porque solo lee el contenido inicial.
  function insertCanned(body: string) {
    const current = Array.isArray(replyBlocks) ? (replyBlocks as unknown[]) : [];
    const next = [...current, ...textToBlocks(body)];
    setDraftBlocks(next);
    setReplyBlocks(next);
    setEditorKey((key) => key + 1);
  }

  async function handleExport() {
    if (!email || exporting) return;
    setExporting(true);
    try {
      const { blob, fileName } = await emailsApi.exportConversation(email.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName ?? `conversacion-${email.id}.pdf`;
      anchor.click();
      // Revocar de inmediato corta la descarga en algunos navegadores: se libera pasado un minuto.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);

      receipts.done({
        action: "exportar",
        title: "Conversación exportada",
        detail: anchor.download,
      });
    } catch (err) {
      receipts.failed({
        action: "exportar",
        title: "No se pudo exportar",
        detail: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setExporting(false);
    }
  }

  // Un ejecutable no se abre en el visor: solo baja, y despues de avisar.
  async function downloadDangerous(attachment: EmailAttachmentResponse) {
    if (!email) return;
    try {
      const link = await emailsApi.attachmentLink(email.id, attachment.id, true);
      window.open(link.url, "_blank", "noopener");
    } catch (err) {
      receipts.failed({
        action: "descargar",
        title: "No se pudo descargar",
        detail: err instanceof ApiError ? err.message : undefined,
      });
    }
  }

  function openAttachment(target: PreviewTarget) {
    const attachment = target.attachments[target.index];
    if (attachment.dangerous) {
      setDangerousToDownload(attachment);
      return;
    }
    setPreview(target);
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

  async function handleToggleStar() {
    if (!email || starring) return;
    setStarring(true);
    const nextStarred = !email.starred;
    try {
      await emailsApi.toggleStar(email.id, nextStarred);
      setEmail({ ...email, starred: nextStarred });
      receipts.done({
        action: nextStarred ? "destacar" : "quitar-destacado",
        title: nextStarred ? "Añadido a destacados" : "Quitado de destacados",
        detail: email.subject || "(sin asunto)",
      });
      onStarred?.(nextStarred);
    } catch (err) {
      receipts.failed({
        action: "destacar",
        title: "No se pudo actualizar destacados",
        detail: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setStarring(false);
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
      <div className="flex h-10 shrink-0 items-center px-2">
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`${toolButtonClass} ${email.starred ? "text-amber-500 hover:text-amber-600" : ""}`}
                disabled={starring}
                onClick={handleToggleStar}
                aria-label={email.starred ? "Quitar de destacados" : "Destacar"}
              >
                <Star className={`h-4 w-4 ${email.starred ? "fill-amber-400 text-amber-500" : ""}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{email.starred ? "Quitar de destacados" : "Destacar"}</TooltipContent>
          </Tooltip>

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

          {ticketsNote(email) && !email.ticketId && (
            <TicketsOriginPopover
              note={ticketsNote(email)!}
              ticketId={email.ticketId}
            />
          )}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <AssignmentControl
            emailId={email.id}
            assignedStaffId={email.assignedStaffId ?? null}
            assignedStaffName={email.assignedStaffName ?? null}
            onChanged={(staffId, name) => setEmail({ ...email, assignedStaffId: staffId, assignedStaffName: name })}
            onNoteAdded={() => setNotesRefreshKey((k) => k + 1)}
          />

          <TicketChip
            ticketId={email.ticketId}
            provenance={email.origin === "Tickets" ? "thread" : "manual"}
            note={ticketsNote(email)}
            justCreated={justCreatedTicketId !== null && justCreatedTicketId === email.ticketId}
            onSettled={() => setJustCreatedTicketId(null)}
            active={isCreateTicketModalOpen}
            onCreate={() => setIsCreateTicketModalOpen(true)}
          />

          <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-line" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className={toolButtonClass} disabled={exporting} onClick={handleExport}>
                {exporting ? <LoaderCircle className="animate-spin" /> : <Download />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{exporting ? "Exportando…" : "Exportar conversación (PDF)"}</TooltipContent>
          </Tooltip>

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

      <Separator className="bg-zinc-100" />

      <div className="px-4 pb-2.5 pt-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-[17px] font-bold leading-tight tracking-[-0.02em] text-zinc-900">
              {email.subject || "(sin asunto)"}
            </h2>

            <div className="mt-1 flex items-center gap-2">
              <Avatar className="size-7 shrink-0">
                <AvatarFallback className="text-[10px]">{initialsFromName(displayName, email.fromEmail)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-semibold text-zinc-900">
                  {displayName}
                  {/* El nombre puede ser el propio correo: repetirlo no aporta. */}
                  {displayName !== email.fromEmail && (
                    <span className="ml-1.5 font-normal text-zinc-500">{email.fromEmail}</span>
                  )}
                </p>
                <p className="truncate text-[11px] text-zinc-400">
                  Para: {email.toEmails.join(", ") || "—"}
                  {email.ccEmails.length > 0 && ` · CC: ${email.ccEmails.join(", ")}`}
                  {(email.bccEmails ?? []).length > 0 && ` · CCO: ${email.bccEmails.join(", ")}`}
                </p>
              </div>
            </div>
          </div>

          <div className="ml-auto flex shrink-0 flex-col items-end gap-1">
            <ConversationNotes key={notesRefreshKey} emailId={email.id} />
            <span className="whitespace-nowrap text-[11px] font-medium text-zinc-400">
              {formatDateTime(email.createdAt)}
            </span>
          </div>
        </div>

        {composers.length > 0 && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-200/90 bg-amber-50/70 px-2.5 py-1.5 text-[11.5px] text-amber-950 shadow-2xs">
            <PencilLine className="h-3.5 w-3.5 shrink-0 text-amber-600" />
            <span>
              <strong className="font-semibold">{composers.map((p) => p.name).join(", ")}</strong>
              {composers.length === 1 ? " está respondiendo este correo ahora mismo." : " están respondiendo este correo ahora mismo."}
            </span>
          </div>
        )}
      </div>

      <Separator className="bg-zinc-100" />

      {/* Columna: los avisos ocupan lo suyo y el cuerpo se queda con el resto, sin desbordar sobre el pie. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
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
                {email.subject ? `${isForward ? "Fwd" : "Re"}: ${email.subject}` : "(sin asunto)"}
              </span>
              <button
                type="button"
                onClick={closeComposer}
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
                  onChange={setForwardTo}
                  placeholder="correo@dominio.com, otro@dominio.com"
                  autoFocus
                />
              ) : (
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-zinc-900">
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
              <div className="flex shrink-0 items-center gap-3 border-b border-zinc-100 px-4 py-1.5 transition-colors focus-within:bg-zinc-50/50">
                <span className={fieldLabelClass}>CC</span>
                <RecipientInput
                  inputRef={ccRef}
                  value={replyCc}
                  onChange={setReplyCc}
                  placeholder="correo@dominio.com, otro@dominio.com"
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
              <div className="flex shrink-0 items-center gap-3 border-b border-zinc-100 px-4 py-1.5 transition-colors focus-within:bg-zinc-50/50">
                <span className={fieldLabelClass}>CCO</span>
                <RecipientInput
                  inputRef={bccRef}
                  value={replyBcc}
                  onChange={setReplyBcc}
                  placeholder="Nadie más ve a quién va esta copia"
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
              <label className="flex shrink-0 cursor-pointer items-center gap-2 border-b border-zinc-100 bg-zinc-50/40 px-4 py-1.5 text-[12px] font-medium text-zinc-700">
                <input
                  type="checkbox"
                  checked={includeAttachments}
                  onChange={(event) => setIncludeAttachments(event.target.checked)}
                  className="h-3.5 w-3.5 accent-brand-red rounded"
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
                key={editorKey}
                initialContent={draftBlocks}
                onChange={setReplyBlocks}
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

            {replyError && (
              <div className="shrink-0 px-4 pb-2 pt-2">
                <Alert variant="error">{replyError}</Alert>
              </div>
            )}

            <ComposerInset />
            <div className="flex shrink-0 items-center gap-2 border-t border-zinc-100 px-4 py-2.5 bg-zinc-50/30">
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
              <CannedPicker onPick={insertCanned} />
              <span className="truncate text-[11px] font-medium text-zinc-400">
                Hasta {MAX_FILES} archivos, 10 MB · también puedes soltarlos aquí
              </span>

              <div className="ml-auto flex shrink-0 gap-2">
                <PfButton variant="ghost" size="sm" className="h-8 px-3" onClick={closeComposer}>
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
            <div className="flex shrink-0 items-start gap-2.5 border-b border-line px-4 py-2.5">
              {(() => {
                const openBadge = getThreadMessageBadge(openReply);
                return (
                  <span
                    className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-heading
                      text-[9px] font-bold uppercase tracking-[0.05em] ${openBadge.className}`}
                  >
                    {openBadge.label}
                  </span>
                );
              })()}
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
              {ticketsNote(openReply) && (
                <TicketsOriginPopover
                  note={ticketsNote(openReply)!}
                  ticketId={email.ticketId}
                />
              )}
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
                      {DELIVERY_LABELS[openReply.deliveryStatus]}.{" "}
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

            {openReply.direction === "Inbound" && openReply.authFailed && (
              <div className="shrink-0 border-b border-line px-4 py-2" title={openReply.authResult ?? undefined}>
                <Alert variant="error">
                  Este correo no pasó la verificación de remitente (SPF/DKIM/DMARC): podría ser una suplantación.
                </Alert>
              </div>
            )}

            {openReply.bodyHtml && openReply.direction === "Inbound" ? (
              <EmailBodyFrame
                key={openReply.id}
                html={openReply.bodyHtml}
                title={`Correo de ${openReply.fromEmail}`}
                className="min-h-0 flex-1"
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
                    disabled={!attachment.available}
                    onClick={() =>
                      openAttachment({
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

        {email.direction === "Inbound" && email.authFailed && (
          <div className="shrink-0 px-4 pb-2 pt-2" title={email.authResult ?? undefined}>
            <Alert variant="error">
              Este correo no pasó la verificación de remitente (SPF/DKIM/DMARC): podría ser una suplantación.
            </Alert>
          </div>
        )}

        {email.bodyHtml ? (
          <EmailBodyFrame key={email.id} html={email.bodyHtml} title="Cuerpo del correo" className="min-h-0 flex-1" />
        ) : email.bodyText ? (
          <pre className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap p-4 text-[13px] leading-relaxed text-ink">
            {email.bodyText}
          </pre>
        ) : (
          <p className="min-h-0 flex-1 p-4 text-[13px] text-subtle">Este correo no tiene contenido.</p>
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
                    openAttachment({ emailId: email.id, attachments: email.attachments, index: position })
                  }
                  title={
                    attachment.scanStatus === "Infected"
                      ? `El antivirus detectó una amenaza (${attachment.scanDetail ?? "sin detalle"})`
                      : !attachment.available
                        ? "El archivo se eliminó por antigüedad"
                        : attachment.dangerous
                          ? "Archivo de tipo peligroso: solo se descarga"
                          : `Ver ${attachment.fileName}`
                  }
                  className="group inline-flex items-center gap-1.5 rounded-edge border border-line
                    bg-canvas px-2 py-1 text-[11.5px] text-brand-gray outline-none
                    transition-[background-color,border-color,color]
                    hover:border-brand-red/35 hover:bg-white hover:text-ink
                    focus-visible:border-brand-red/40 focus-visible:ring-3 focus-visible:ring-brand-red/12
                    disabled:cursor-not-allowed disabled:line-through disabled:opacity-50
                    disabled:hover:border-line disabled:hover:bg-canvas disabled:hover:text-brand-gray"
                >
                  {attachment.dangerous || attachment.scanStatus === "Infected" ? (
                    <ShieldAlert className="h-3.5 w-3.5 text-brand-red" />
                  ) : (
                    <Paperclip className="h-3.5 w-3.5 text-faint transition-colors group-hover:text-brand-red" />
                  )}
                  {attachment.fileName}
                  <span className="text-subtle">· {formatBytes(attachment.sizeBytes)}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <AddNotePanel emailId={email.id} onNoteAdded={() => setNotesRefreshKey((k) => k + 1)} />

      <Separator className="bg-line" />

      <div className="shrink-0 px-4 py-2.5">
        {others.length > 0 && (
          <div className="mb-2 max-h-40 overflow-y-auto pr-0.5">
            {others.map((reply) => {
              const badge = getThreadMessageBadge(reply);
              const contactName =
                reply.direction === "Outbound"
                  ? reply.toEmails.join(", ") || reply.fromEmail || reply.authorName
                  : reply.fromName ?? reply.fromEmail;
              const authorNote =
                reply.direction === "Outbound" && reply.authorName && reply.authorName !== contactName
                  ? reply.authorName
                  : null;

              return (
                <button
                  key={reply.id}
                  type="button"
                  onClick={() => setOpenReplyId(reply.id === openReplyId ? null : reply.id)}
                  data-open={reply.id === openReplyId}
                  className="flex w-full items-center gap-2 rounded-edge px-1.5 py-1 text-left
                    outline-none transition-colors hover:bg-fill
                    focus-visible:ring-3 focus-visible:ring-brand-red/12
                    data-[open=true]:bg-brand-red/[0.06]"
                >
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 font-heading
                      text-[9px] font-bold uppercase tracking-[0.05em] ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                  {reply.origin === "Tickets" && (
                    <span
                      title={ticketsNote(reply) ?? undefined}
                      className="inline-flex shrink-0 items-center rounded-full border border-brand-red/20
                        bg-brand-red/8 px-1.5 py-0.5 font-heading text-[9px] font-bold uppercase
                        tracking-[0.05em] text-brand-red-dark"
                    >
                      Tickets
                    </span>
                  )}
                  {/* Cede antes que la fila: una direccion larga no puede empujar la hora fuera de vista. */}
                  <span className="max-w-[45%] truncate text-[11.5px] font-semibold text-ink">
                    {contactName}
                  </span>
                  {authorNote && (
                    <span className="shrink-0 text-[10.5px] text-faint">
                      por {authorNote}
                    </span>
                  )}
                  <span className="truncate text-[11.5px] text-subtle">
                    {firstLine(reply.bodyText)}
                  </span>
                  {reply.deliveryStatus && deliveryTone[reply.deliveryStatus] && (
                    <span
                      className={`ml-auto shrink-0 text-[10.5px] font-semibold
                        ${deliveryTone[reply.deliveryStatus]}`}
                    >
                      {DELIVERY_LABELS[reply.deliveryStatus]}
                    </span>
                  )}
                  <span
                    className={`shrink-0 text-[10.5px] font-medium text-faint ${
                      reply.deliveryStatus && deliveryTone[reply.deliveryStatus] ? "" : "ml-auto"
                    }`}
                  >
                    {formatEmailListDate(reply.createdAt)}
                  </span>
                </button>
              );
            })}
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
              <CornerUpLeft className="h-3.5 w-3.5 text-zinc-400 transition-colors group-hover:text-zinc-700" />
              Responder
            </button>
          )}
          <button
            type="button"
            onClick={() => openComposer("forward")}
            title="Reenviar este correo a otra dirección"
            className={composerOpenerClass}
          >
            <Forward className="h-3.5 w-3.5 text-zinc-400 transition-colors group-hover:text-zinc-700" />
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

      {dangerousToDownload && (
        <ConfirmDialog
          eyebrow="Adjuntos"
          icon={ShieldAlert}
          title="Archivo potencialmente peligroso"
          description={
            <>
              <strong className="font-semibold text-ink">{dangerousToDownload.fileName}</strong> es un
              ejecutable, un guion o una imagen de disco. No se abre en el visor: solo se descarga, y
              conviene no ejecutarlo si no esperabas recibirlo.
              {dangerousToDownload.scanStatus === "Skipped" && " El antivirus no lo revisó."}
            </>
          }
          confirmLabel="Descargar igual"
          onConfirm={async () => {
            await downloadDangerous(dangerousToDownload);
            setDangerousToDownload(null);
          }}
          onClose={() => setDangerousToDownload(null)}
        />
      )}

      {preview && (
        <AttachmentPreviewModal
          sourceId={preview.emailId}
          loadLink={(attachmentId, download) =>
            emailsApi.attachmentLink(preview.emailId, attachmentId, download)
          }
          attachments={preview.attachments}
          index={preview.index}
          onIndexChange={(index) => setPreview({ ...preview, index })}
          onClose={() => setPreview(null)}
        />
      )}

      {isCreateTicketModalOpen && email && (
        <CreateTicketModal
          emailId={email.id}
          initialSubject={email.subject}
          initialMessage={email.bodyText || ""}
          senderEmail={email.fromEmail}
          senderName={email.fromName ?? undefined}
          initialAssignedStaffId={email.assignedStaffId}
          onClose={() => setIsCreateTicketModalOpen(false)}
          onCreated={(created) => {
            setEmail({ ...email, ticketId: created.id });
            setJustCreatedTicketId(created.id);
            onTicketCreated();
            setIsCreateTicketModalOpen(false);
            receipts.done({
              action: "crear-ticket",
              title: "Ticket creado",
              detail: `${created.code} · ${created.subject}`,
            });
          }}
        />
      )}
    </div>
  );
}
