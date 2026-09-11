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

/** Chip de adjunto con la anatomía del chip de ticket: sello, nombre y peso; el sello se enciende al pasar. */
export function AttachmentChip({ attachment, onOpen }: AttachmentChipProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`Abrir ${attachment.fileName}`}
      className="group/file inline-flex h-7 max-w-full cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-white pl-1 pr-2.5 text-[11.5px] font-medium text-zinc-700 shadow-2xs outline-none transition-[background-color,border-color,color,transform] duration-200 ease-out hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-brand-red/25 motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      <span
        aria-hidden
        className="flex size-5 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-500 transition-colors duration-200 group-hover/file:bg-brand-red/10 group-hover/file:text-brand-red"
      >
        <FileText className="size-3" strokeWidth={2.25} />
      </span>
      <span className="max-w-[220px] truncate">{attachment.fileName}</span>
      <span className="shrink-0 font-heading text-[10px] font-bold tabular-nums text-zinc-400">
        {formatBytes(attachment.sizeBytes)}
      </span>
      <Eye
        aria-hidden
        className="size-3 shrink-0 text-zinc-400 opacity-0 transition-opacity duration-200 group-hover/file:opacity-100 group-focus-visible/file:opacity-100"
      />
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

  // Papel blanco con filete para todo lo que ve el cliente; ámbar solo para lo interno.
  const containerClass = isInternal ? "border-amber-200/90 bg-amber-50/30" : "border-zinc-200 bg-white";
  const headerClass = isInternal ? "border-b border-amber-200/70" : "border-b border-zinc-100";

  return (
    <article className={`overflow-hidden rounded-lg border shadow-2xs ${containerClass}`}>
      {/* Cabecera del mensaje */}
      <header className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-3.5 py-2 ${headerClass}`}>
        <div className="flex min-w-0 items-center gap-2">
          <Avatar name={author} seed={seed} size={24} />
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="truncate text-[12.5px] font-semibold text-zinc-900 leading-tight" title={author}>
              {author}
            </span>

            {/* Papel del mensaje, en versalitas: la voz de los pies del chip. */}
            {isInternal ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-200/70 px-1.5 py-0.5 font-heading text-[9.5px] font-bold uppercase leading-none tracking-[0.06em] text-amber-900">
                <Lock aria-hidden className="size-2.5" />
                Nota interna
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 font-heading text-[9.5px] font-bold uppercase leading-none tracking-[0.06em] text-zinc-600">
                {message.isOrigin && <Mail aria-hidden className="size-2.5 text-zinc-500" />}
                {message.isOrigin ? "Correo inicial" : isOutbound ? "Respuesta" : "Cliente"}
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
            <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 font-heading text-[9.5px] font-bold uppercase leading-none tracking-[0.06em] text-zinc-500">
              <span aria-hidden className="size-1.5 rounded-full bg-brand-red" />
              Más reciente
            </span>
          )}
        </div>
      </header>

      {/* Alerta si falló la entrega */}
      {deliveryWarning && (
        <div className="mx-3.5 mt-2.5 flex items-center gap-2.5 rounded-lg border border-brand-red/25 bg-brand-red/[0.04] py-1.5 pl-1.5 pr-2.5 text-[11.5px] font-medium text-brand-red-dark">
          <span
            aria-hidden
            className="flex size-5 shrink-0 items-center justify-center rounded-md bg-brand-red/10 text-brand-red"
          >
            <AlertTriangle className="size-3" strokeWidth={2.5} />
          </span>
          <span>
            {deliveryWarning}
            {message.deliveryDetail && <span className="font-normal text-brand-red"> ({message.deliveryDetail})</span>}
          </span>
        </div>
      )}

      {/* Cuerpo del mensaje */}
      <div className="px-3.5 py-3">
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
