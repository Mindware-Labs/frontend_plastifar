import { AlertTriangle, Eye, FileText, Lock } from "lucide-react";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { formatBytes, formatDateTime } from "../../lib/format";
import type { TicketAttachmentResponse, TicketMessageResponse } from "../../types/api";
import { FormattedTicketBody } from "./FormattedTicketBody";
import { originLabel } from "./ticketOrigin";

type BadgeTone = "neutral" | "red" | "green" | "amber" | "slate" | "completed";

/** Como termino el correo de una respuesta. Solo lo ve el personal. */
const deliveryLabels: Record<string, { label: string; tone: BadgeTone }> = {
  Queued: { label: "En cola", tone: "amber" },
  Sent: { label: "Enviado", tone: "neutral" },
  Delivered: { label: "Entregado", tone: "green" },
  Delayed: { label: "Demorado", tone: "amber" },
  Bounced: { label: "No entregado", tone: "red" },
  Complained: { label: "Marcado como spam", tone: "red" },
  Failed: { label: "No se pudo enviar", tone: "red" },
};

/** Lo que una etiqueta pequena no basta para contar: alguien tiene que enterarse. */
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

/** Abrir el archivo, no bajarlo a ciegas: el visor decide si se ve dentro y ofrece descargarlo. */
export function AttachmentChip({ attachment, onOpen }: AttachmentChipProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`Abrir ${attachment.fileName}`}
      className="inline-flex h-8 max-w-full items-center gap-2 rounded-edge border border-line-strong bg-white px-2.5
        text-[12px] text-ink outline-none transition-colors hover:border-zinc-400 hover:bg-canvas
        focus-visible:ring-3 focus-visible:ring-brand-red/12"
    >
      <FileText aria-hidden className="h-3.5 w-3.5 shrink-0 text-subtle" />
      <span className="max-w-[200px] truncate">{attachment.fileName}</span>
      <span className="shrink-0 text-[11px] tabular-nums text-subtle">{formatBytes(attachment.sizeBytes)}</span>
      <Eye aria-hidden className="h-3 w-3 shrink-0 text-faint" />
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

/** Un mensaje del hilo. El fondo dice quien habla: blanco el equipo, gris el cliente, ambar lo privado. */
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
  const role = isInternal ? "Nota interna" : isOutbound ? "Respuesta al cliente" : "Cliente";

  return (
    <article
      className={`rounded-edge border p-5 ${
        isInternal ? "border-warn/30 bg-warn/[0.045]" : isOutbound ? "border-line bg-white" : "border-line bg-canvas/60"
      }`}
    >
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={author} seed={seed} size={28} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-ink">{author}</p>
            <p className="flex items-center gap-1.5 text-[11.5px] text-subtle">
              {isInternal && <Lock aria-hidden className="h-3 w-3 text-warn" />}
              {role}
              <span aria-hidden className="text-line-strong">·</span>
              <time dateTime={message.createdAt}>{formatDateTime(message.createdAt)}</time>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {message.isOrigin && (
            <span title={`${origin.hint} ${formatDateTime(message.createdAt)}`}>
              <Badge>{origin.label}</Badge>
            </span>
          )}
          {delivery && (
            <span title={message.deliveryDetail ?? undefined}>
              <Badge tone={delivery.tone}>{delivery.label}</Badge>
            </span>
          )}
          {isLatest && (
            <span className="font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">
              Más reciente
            </span>
          )}
        </div>
      </header>

      {deliveryWarning && (
        <p className="mt-3 flex items-start gap-1.5 rounded-edge bg-fill px-2.5 py-1.5 text-[11.5px] font-medium text-ink">
          <AlertTriangle aria-hidden className="mt-px h-3.5 w-3.5 shrink-0 text-warn" />
          <span>
            {deliveryWarning}
            {message.deliveryDetail && <span className="text-subtle"> ({message.deliveryDetail})</span>}
          </span>
        </p>
      )}

      <div className="mt-4 max-w-[75ch] text-[13.5px] leading-relaxed text-ink">
        <FormattedTicketBody text={message.bodyText} html={message.bodyHtml} />
      </div>

      {message.attachments.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-line/70 pt-3">
          {message.attachments.map((attachment) => (
            <AttachmentChip
              key={attachment.id}
              attachment={attachment}
              onOpen={() => onOpenAttachment(message.attachments, attachment.id)}
            />
          ))}
        </div>
      )}
    </article>
  );
}
