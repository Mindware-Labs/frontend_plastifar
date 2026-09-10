import { AlertTriangle, Eye, FileText, Lock, Mail } from "lucide-react";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { formatBytes, formatDateTime } from "../../lib/format";
import type { TicketAttachmentResponse, TicketMessageResponse } from "../../types/api";
import { FormattedTicketBody } from "./FormattedTicketBody";
import { originLabel } from "./ticketOrigin";

type BadgeTone = "neutral" | "red" | "green" | "amber" | "slate" | "completed";

/** Como terminó el correo de una respuesta. Solo lo ve el personal. */
const deliveryLabels: Record<string, { label: string; tone: BadgeTone }> = {
  Queued: { label: "En cola", tone: "amber" },
  Sent: { label: "Enviado", tone: "neutral" },
  Delivered: { label: "Entregado", tone: "green" },
  Delayed: { label: "Demorado", tone: "amber" },
  Bounced: { label: "No entregado", tone: "red" },
  Complained: { label: "Marcado como spam", tone: "red" },
  Failed: { label: "No se pudo enviar", tone: "red" },
};

/** Lo que una etiqueta pequeña no basta para contar: advertencias críticas de entrega. */
const deliveryWarnings: Record<string, string> = {
  Queued: "El proveedor no respondió: la respuesta espera en la cola de salida y se reintenta sola.",
  Bounced: "El correo del cliente rechazó la respuesta. Verifica la dirección de contacto.",
  Complained: "El cliente marcó esta respuesta como spam.",
  Failed: "Se agotaron los reintentos: esta respuesta nunca llegó al cliente.",
};

interface AttachmentChipProps {
  attachment: TicketAttachmentResponse;
  onOpen: () => void;
}

/** Píldora compacta para abrir archivos adjuntos. */
export function AttachmentChip({ attachment, onOpen }: AttachmentChipProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`Abrir ${attachment.fileName}`}
      className="group inline-flex h-7 max-w-full items-center gap-1.5 rounded-lg border border-zinc-200/80 bg-zinc-50/70 px-2.5 text-[11.5px] font-medium text-zinc-700 shadow-2xs outline-none transition-all hover:border-zinc-300 hover:bg-zinc-100/90 active:scale-95 cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-red/20"
    >
      <FileText aria-hidden className="h-3.5 w-3.5 shrink-0 text-zinc-400 group-hover:text-brand-red transition-colors" />
      <span className="max-w-[220px] truncate">{attachment.fileName}</span>
      <span className="shrink-0 text-[10.5px] tabular-nums text-zinc-400">{formatBytes(attachment.sizeBytes)}</span>
      <Eye aria-hidden className="h-3 w-3 shrink-0 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
    </button>
  );
}

interface TicketMessageCardProps {
  message: TicketMessageResponse;
  channel: string;
  requesterName: string | null | undefined;
  isLatest: boolean;
  onOpenAttachment: (attachments: TicketAttachmentResponse[], attachmentId: number) => void;
}

/**
 * Tarjeta compacta y moderna para mensajes de la conversación o notas internas:
 * - Correo inicial: Destacado con badge de origen y cabecera estructurada.
 * - Respuestas de agentes: Limpias con badge de estado de entrega.
 * - Notas internas: Tono ámbar sutil con candado privado.
 */
export function TicketMessageCard({
  message,
  channel,
  requesterName,
  isLatest,
  onOpenAttachment,
}: TicketMessageCardProps) {
  const direction = message.direction.toLowerCase();
  const isInternal = direction === "interna";
  const isOutbound = direction === "saliente";
  const deliveryKey = isOutbound ? message.deliveryStatus ?? undefined : undefined;
  const delivery = deliveryKey ? deliveryLabels[deliveryKey] : undefined;
  const deliveryWarning = deliveryKey ? deliveryWarnings[deliveryKey] : undefined;
  const origin = originLabel(channel);

  const author = message.authorStaffName ?? message.authorContactName ?? requesterName ?? "Remitente";
  const seed = message.authorStaffId ?? message.authorContactId ?? 1;

  // Estilos de contenedor según tipo de mensaje
  const containerClass = isInternal
    ? "border-amber-200/90 bg-amber-50/20"
    : message.isOrigin
    ? "border-zinc-200/90 bg-white"
    : isOutbound
    ? "border-zinc-200/80 bg-white"
    : "border-zinc-200/80 bg-white";

  const headerClass = isInternal
    ? "border-b border-amber-200/70 bg-amber-100/50"
    : message.isOrigin
    ? "border-b border-zinc-100 bg-zinc-50/80"
    : isOutbound
    ? "border-b border-zinc-100 bg-zinc-50/45"
    : "border-b border-zinc-100 bg-zinc-50/60";

  return (
    <article className={`rounded-xl border shadow-2xs overflow-hidden transition-all ${containerClass}`}>
      {/* Cabecera del mensaje */}
      <header className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-3.5 py-2 ${headerClass}`}>
        <div className="flex min-w-0 items-center gap-2">
          <Avatar name={author} seed={seed} size={24} />
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="truncate text-[12.5px] font-semibold text-zinc-900 leading-tight" title={author}>
              {author}
            </span>

            {/* Pastilla indicativa del rol/tipo */}
            {isInternal ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-200/70 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-900">
                <Lock aria-hidden className="h-2.5 w-2.5 text-amber-800" />
                Nota interna
              </span>
            ) : message.isOrigin ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200/80 bg-white px-1.5 py-0.5 text-[10.5px] font-medium text-zinc-700 shadow-2xs">
                <Mail aria-hidden className="h-2.5 w-2.5 text-zinc-500" />
                Correo inicial
              </span>
            ) : isOutbound ? (
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10.5px] font-medium text-zinc-600">
                Respuesta
              </span>
            ) : (
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10.5px] font-medium text-zinc-600">
                Cliente
              </span>
            )}

            <span aria-hidden className="text-zinc-300">·</span>
            <time dateTime={message.createdAt} className="text-[11px] tabular-nums text-zinc-400">
              {formatDateTime(message.createdAt)}
            </time>
          </div>
        </div>

        {/* Insignias de la derecha (origen, entrega, más reciente) */}
        <div className="flex flex-wrap items-center gap-1.5">
          {message.isOrigin && (
            <span title={`${origin.hint} ${formatDateTime(message.createdAt)}`}>
              <Badge tone="neutral">{origin.label}</Badge>
            </span>
          )}
          {delivery && (
            <span title={message.deliveryDetail ?? undefined}>
              <Badge tone={delivery.tone}>{delivery.label}</Badge>
            </span>
          )}
          {isLatest && (
            <span className="rounded-md border border-zinc-200/80 bg-white px-1.5 py-0.5 font-heading text-[10px] font-semibold uppercase tracking-wider text-zinc-500 shadow-2xs">
              Más reciente
            </span>
          )}
        </div>
      </header>

      {/* Alerta si falló la entrega */}
      {deliveryWarning && (
        <div className="mx-3.5 mt-2.5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50/70 p-2 text-[11.5px] font-medium text-red-800">
          <AlertTriangle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
          <span>
            {deliveryWarning}
            {message.deliveryDetail && <span className="text-red-600 font-normal"> ({message.deliveryDetail})</span>}
          </span>
        </div>
      )}

      {/* Cuerpo del mensaje */}
      <div className={`px-3.5 py-3 ${isInternal ? "bg-amber-50/10" : "bg-white"}`}>
        <div className="text-[13px] leading-relaxed text-zinc-800">
          <FormattedTicketBody text={message.bodyText} html={message.bodyHtml} />
        </div>

        {/* Adjuntos en el mensaje */}
        {message.attachments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-zinc-100 pt-2.5">
            {message.attachments.map((attachment) => (
              <AttachmentChip
                key={attachment.id}
                attachment={attachment}
                onOpen={() => onOpenAttachment(message.attachments, attachment.id)}
              />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
