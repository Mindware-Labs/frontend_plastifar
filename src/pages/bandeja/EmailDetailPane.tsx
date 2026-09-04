import {
  Archive,
  ArchiveRestore,
  CornerUpLeft,
  Paperclip,
  Send,
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
import { Spinner } from "../../components/ui/Spinner";
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
import type { EmailDetailResponse } from "../../types/api";
import { AttachmentPreviewModal } from "./AttachmentPreviewModal";
import { ticketBadgeClass } from "./badgeStyles";

interface EmailDetailPaneProps {
  emailId: number;
  /** Avisa al panel de la lista para que refresque (el correo puede salir del filtro actual). */
  onTicketCreated: () => void;
  /** El correo cambió de carpeta: ya no pertenece a la vista actual. */
  onMoved: () => void;
}

/** Acciones de la barra: gris de texto en reposo, tinta sobre relleno al pasar. */
const toolButtonClass =
  "size-7 text-brand-gray transition-colors hover:bg-fill hover:text-ink " +
  "focus-visible:ring-brand-red/20 focus-visible:border-brand-red/30";

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
export function EmailDetailPane({ emailId, onTicketCreated, onMoved }: EmailDetailPaneProps) {
  const [email, setEmail] = useState<EmailDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const [openReplyId, setOpenReplyId] = useState<number | null>(null);

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
  }, [emailId]);

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
    if (replyOpen) replyRef.current?.focus();
  }, [replyOpen]);

  useEffect(() => {
    if (openReplyId === null) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenReplyId(null);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [openReplyId]);

  async function handleReply() {
    if (!email || sending || replyBody.trim() === "") return;
    setSending(true);
    setReplyError(null);

    try {
      const reply = await emailsApi.reply(email.id, replyBody);
      setEmail({ ...email, replies: [...(email.replies ?? []), reply] });
      setOpenReplyId(reply.id);
      setReplyBody("");
      setReplyOpen(false);
    } catch (err) {
      setReplyError(err instanceof ApiError ? err.message : "No se pudo enviar la respuesta");
    } finally {
      setSending(false);
    }
  }

  async function handleMove(action: () => Promise<void>) {
    if (moving) return;
    setMoving(true);
    try {
      await action();
      onMoved();
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
  const isInInbox = email.folder === "Inbox";

  // Un API sin este campo no debe tumbar el panel entero.
  const replies = email.replies ?? [];
  const openReply = replies.find((reply) => reply.id === openReplyId) ?? null;

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
                    onClick={() => handleMove(() => emailsApi.archive(email.id))}
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
                    onClick={() => handleMove(() => emailsApi.markAsJunk(email.id))}
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
                    onClick={() => handleMove(() => emailsApi.trash(email.id))}
                  >
                    <Trash2 />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Mover a la papelera</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={toolButtonClass}
                  disabled={moving}
                  onClick={() => handleMove(() => emailsApi.restore(email.id))}
                >
                  <ArchiveRestore />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Restaurar a la bandeja</TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="ml-auto">
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
            </p>
          </div>
          <span className="ml-auto shrink-0 whitespace-nowrap text-[11px] font-medium text-faint">
            {formatDateTime(email.createdAt)}
          </span>
        </div>
      </div>

      <Separator className="bg-line" />

      <div className="relative min-h-0 flex-1">
        {openReply && (
          <div className="absolute inset-0 z-10 flex flex-col bg-white">
            <div className="flex shrink-0 items-start gap-2 border-b border-line px-4 py-2.5">
              <CornerUpLeft className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-red" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-[13.5px] font-bold tracking-[-0.01em] text-ink">
                  {openReply.subject}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-subtle">
                  <span className="font-semibold text-brand-gray">{openReply.authorName}</span>
                  {" · "}
                  {openReply.fromName ?? openReply.fromEmail}
                  {" · Para: "}
                  {openReply.toEmails.join(", ")}
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

            <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap px-4 py-3 text-[13px] leading-relaxed text-ink">
              {openReply.bodyText}
            </div>
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
                  onClick={() => setPreviewIndex(position)}
                  title={`Ver ${attachment.fileName}`}
                  className="group inline-flex items-center gap-1.5 rounded-edge border border-line
                    bg-canvas px-2 py-1 text-[11.5px] text-brand-gray outline-none
                    transition-[background-color,border-color,color]
                    hover:border-brand-red/35 hover:bg-white hover:text-ink
                    focus-visible:border-brand-red/40 focus-visible:ring-3 focus-visible:ring-brand-red/12"
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
        {replies.length > 0 && (
          <div className="mb-2 max-h-24 overflow-y-auto pr-0.5">
            {replies.map((reply) => (
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
                <CornerUpLeft className="h-3 w-3 shrink-0 text-faint" />
                <span className="shrink-0 text-[11.5px] font-semibold text-ink">
                  {reply.authorName}
                </span>
                <span className="truncate text-[11.5px] text-subtle">
                  {firstLine(reply.bodyText)}
                </span>
                <span className="ml-auto shrink-0 text-[10.5px] font-medium text-faint">
                  {formatEmailListDate(reply.createdAt)}
                </span>
              </button>
            ))}
          </div>
        )}

        {replyError && (
          <div className="mb-2">
            <Alert variant="error">{replyError}</Alert>
          </div>
        )}

        {replyOpen ? (
          <div className="rounded-edge border border-line p-3">
            <p className="mb-2 text-[11.5px] text-subtle">
              Para: <span className="font-medium text-ink">{email.fromEmail}</span>
            </p>

            <textarea
              ref={replyRef}
              value={replyBody}
              onChange={(event) => setReplyBody(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) handleReply();
              }}
              rows={5}
              placeholder="Escribe la respuesta…"
              className="w-full resize-none rounded-edge border border-line bg-white p-2.5
                text-[13px] leading-relaxed text-ink outline-none transition-colors
                placeholder:text-faint focus:border-brand-red/40 focus:ring-3 focus:ring-brand-red/12"
            />

            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-[11px] leading-snug text-faint">
                Sale de la casilla de soporte, con tu nombre y tu firma.
              </p>
              <div className="flex shrink-0 gap-2">
                <PfButton
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setReplyOpen(false);
                    setReplyError(null);
                  }}
                >
                  Cancelar
                </PfButton>
                <PfButton
                  size="sm"
                  onClick={handleReply}
                  isLoading={sending}
                  disabled={replyBody.trim() === ""}
                >
                  <Send className="h-[15px] w-[15px]" />
                  Enviar
                </PfButton>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setReplyOpen(true)}
            className="flex w-full items-center gap-2 rounded-edge border border-line bg-canvas
              px-3 py-2 text-left text-[12px] text-subtle outline-none
              transition-[background-color,border-color,color]
              hover:border-line-strong hover:bg-white hover:text-ink
              focus-visible:border-brand-red/40 focus-visible:ring-3 focus-visible:ring-brand-red/12"
          >
            <CornerUpLeft className="h-3.5 w-3.5 text-faint" />
            Responder a {email.fromName ?? email.fromEmail}
          </button>
        )}
      </div>

      {previewIndex !== null && (
        <AttachmentPreviewModal
          emailId={email.id}
          attachments={email.attachments}
          index={previewIndex}
          onIndexChange={setPreviewIndex}
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </div>
  );
}
