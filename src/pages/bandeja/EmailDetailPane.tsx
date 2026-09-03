import {
  Archive,
  ArchiveRestore,
  Loader2,
  Paperclip,
  ShieldAlert,
  Ticket as TicketIcon,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
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
import { formatBytes, formatDateTime, formatTicketCode } from "../../lib/format";
import type { EmailAttachmentResponse, EmailDetailResponse } from "../../types/api";
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
  "text-brand-gray transition-colors hover:bg-fill hover:text-ink " +
  "focus-visible:ring-brand-red/20 focus-visible:border-brand-red/30";

/** Lleva la pestana ya abierta al documento; replace evita dejar el blanco en el historial. */
function sendTo(tab: Window | null, url: string) {
  if (tab) tab.location.replace(url);
  else window.location.href = url;
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
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

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

  async function openAttachment(attachment: EmailAttachmentResponse) {
    if (openingId !== null) return;

    // La pestana se abre antes del await: el navegador bloquea las que nacen despues.
    const tab = window.open("", "_blank");
    setOpeningId(attachment.id);
    setAttachmentError(null);

    try {
      const link = await emailsApi.attachmentLink(emailId, attachment.id);
      sendTo(tab, link.url);
    } catch (err) {
      tab?.close();
      setAttachmentError(err instanceof ApiError ? err.message : "No se pudo abrir el documento");
    } finally {
      setOpeningId(null);
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

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center p-2">
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
                <TooltipContent>Marcar como junk</TooltipContent>
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
            <PfButton size="sm" onClick={handleCreateTicket} isLoading={creating}>
              <TicketIcon className="h-[15px] w-[15px]" />
              Crear ticket
            </PfButton>
          )}
        </div>
      </div>

      <Separator className="bg-line" />

      {createError && (
        <div className="p-4 pb-0">
          <Alert variant="error">{createError}</Alert>
        </div>
      )}

      <div className="p-4 pb-0">
        <h2 className="font-heading text-[19px] font-bold leading-tight tracking-[-0.02em] text-ink">
          {email.subject || "(sin asunto)"}
        </h2>
      </div>

      <div className="flex items-start gap-4 p-4 text-sm">
        <Avatar>
          <AvatarFallback>{initials(displayName)}</AvatarFallback>
        </Avatar>
        <div className="grid min-w-0 gap-1">
          <div className="text-[13px] font-semibold text-ink">{displayName}</div>
          <div className="line-clamp-1 text-[12px] text-subtle">{email.fromEmail}</div>
          <div className="line-clamp-1 text-[12px] text-subtle">
            Para: {email.toEmails.join(", ") || "—"}
            {email.ccEmails.length > 0 && ` · CC: ${email.ccEmails.join(", ")}`}
          </div>
        </div>
        <div className="ml-auto shrink-0 whitespace-nowrap text-[12px] font-medium text-faint">
          {formatDateTime(email.createdAt)}
        </div>
      </div>

      <Separator className="bg-line" />

      <div className="min-h-0 flex-1">
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
          <div className="shrink-0 p-4">
            <p className="mb-2 font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">
              Adjuntos ({email.attachments.length})
            </p>

            {attachmentError && (
              <div className="mb-2">
                <Alert variant="error">{attachmentError}</Alert>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {email.attachments.map((attachment) => (
                <button
                  key={attachment.id}
                  type="button"
                  onClick={() => openAttachment(attachment)}
                  disabled={openingId !== null}
                  title={`Abrir ${attachment.fileName}`}
                  className="group inline-flex items-center gap-1.5 rounded-edge border border-line
                    bg-canvas px-2.5 py-1.5 text-[12px] text-brand-gray outline-none
                    transition-[background-color,border-color,color]
                    hover:border-brand-red/35 hover:bg-white hover:text-ink
                    focus-visible:border-brand-red/40 focus-visible:ring-3 focus-visible:ring-brand-red/12
                    disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {openingId === attachment.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-red" />
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
    </div>
  );
}
