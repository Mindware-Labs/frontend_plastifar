import { Paperclip, Ticket as TicketIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "../../api/client";
import { emailsApi } from "../../api/emails";
import { Alert } from "../../components/ui/Alert";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Spinner } from "../../components/ui/Spinner";
import { formatBytes, formatDateTime, formatTicketCode } from "../../lib/format";
import type { EmailDetailResponse } from "../../types/api";

interface EmailDetailPaneProps {
  emailId: number;
  /** Avisa al panel de la lista para que refresque (el correo puede salir del filtro actual). */
  onTicketCreated: () => void;
}

/**
 * El cuerpo del correo viene de un remitente externo: nunca se inyecta con
 * dangerouslySetInnerHTML. Un iframe con sandbox vacio lo aisla por completo
 * (sin scripts, sin acceso al DOM de la app) y aun asi se ve con su formato.
 */
export function EmailDetailPane({ emailId, onTicketCreated }: EmailDetailPaneProps) {
  const [email, setEmail] = useState<EmailDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-line px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <h2 className="min-w-0 font-heading text-[16px] font-bold leading-snug text-ink">
            {email.subject || "(sin asunto)"}
          </h2>

          {email.ticketId ? (
            <Badge tone="green">{formatTicketCode(email.ticketId)}</Badge>
          ) : (
            <Button size="sm" className="shrink-0" onClick={handleCreateTicket} isLoading={creating}>
              <TicketIcon className="h-[15px] w-[15px]" />
              Crear ticket
            </Button>
          )}
        </div>

        {createError && (
          <div className="mt-3">
            <Alert variant="error">{createError}</Alert>
          </div>
        )}

        <div className="mt-4 flex items-start gap-3">
          <Avatar name={displayName} seed={email.id} size={34} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-ink">{displayName}</p>
            <p className="truncate text-[12px] text-muted">{email.fromEmail}</p>
            <p className="mt-1 truncate text-[11.5px] text-faint">
              Para: {email.toEmails.join(", ") || "—"}
              {email.ccEmails.length > 0 && ` · CC: ${email.ccEmails.join(", ")}`}
            </p>
          </div>
          <p className="shrink-0 whitespace-nowrap text-[11.5px] text-faint">
            {formatDateTime(email.createdAt)}
          </p>
        </div>
      </div>

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
          <pre className="h-full overflow-y-auto whitespace-pre-wrap px-6 py-5 text-[13px] leading-relaxed text-brand-gray">
            {email.bodyText}
          </pre>
        ) : (
          <p className="px-6 py-5 text-[13px] text-faint">Este correo no tiene contenido.</p>
        )}
      </div>

      {email.attachments.length > 0 && (
        <div className="shrink-0 border-t border-line bg-canvas px-6 py-3.5">
          <p className="mb-2 font-heading text-[10px] font-semibold uppercase tracking-[0.1em] text-faint">
            Adjuntos ({email.attachments.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {email.attachments.map((attachment) => (
              <span
                key={attachment.id}
                className="inline-flex items-center gap-1.5 rounded-edge border border-line-strong
                  bg-white px-2.5 py-1.5 text-[12px] text-brand-gray"
              >
                <Paperclip className="h-3.5 w-3.5 text-faint" />
                {attachment.fileName}
                <span className="text-faint">· {formatBytes(attachment.sizeBytes)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
