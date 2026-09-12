import {
  Building2,
  Clock,
  Eye,
  FileText,
  Mail,
  Pencil,
  Phone,
  Tag,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { Avatar } from "../../components/ui/Avatar";
import { formatBytes, formatDateTime, type formatSlaRemaining } from "../../lib/format";
import type { TicketAttachmentResponse, TicketDetailResponse } from "../../types/api";
import { PriorityCell, SlaCell } from "./ticketCells";

function SectionHeader({
  title,
  icon: Icon,
  action,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-9 items-center justify-between gap-2 border-b border-zinc-100 px-3.5">
      <div className="flex items-center gap-2">
        {Icon && (
          <span
            aria-hidden
            className="flex size-5 shrink-0 items-center justify-center rounded-md bg-brand-red/10 text-brand-red"
          >
            <Icon className="size-3" />
          </span>
        )}
        <span className="font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-ink">{title}</span>
      </div>
      {action}
    </div>
  );
}

function SectionAction({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: typeof Pencil;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 text-[11px] font-medium text-zinc-600 shadow-2xs outline-none transition-colors hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-red/25 motion-reduce:active:scale-100"
    >
      <Icon aria-hidden className="size-3 text-zinc-400" />
      <span>{label}</span>
    </button>
  );
}

function PropertyRow({
  label,
  children,
  isLast = false,
  className = "",
}: {
  label: string;
  children: ReactNode;
  isLast?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex min-h-[26px] items-center justify-between gap-2.5 py-1 text-[12px] ${
        isLast ? "" : "border-b border-zinc-100"
      }`}
    >
      <span className="shrink-0 text-[11.5px] text-zinc-500 select-none">{label}</span>
      <div className={`min-w-0 flex-1 text-right font-medium text-zinc-900 ${className}`}>
        {children}
      </div>
    </div>
  );
}

interface TicketPropertiesAsideProps {
  ticket: TicketDetailResponse;
  sla: ReturnType<typeof formatSlaRemaining>;
  canEdit: boolean;
  canAssign: boolean;
  onEdit: () => void;
  onAssign: () => void;
  onOpenAttachment: (attachments: TicketAttachmentResponse[], attachmentId: number) => void;
  className?: string;
}

/** Ficha compacta del ticket: panel unificado de propiedades alineado con el nuevo diseño SaaS. */
export function TicketPropertiesAside({
  ticket,
  sla,
  canEdit,
  canAssign,
  onEdit,
  onAssign,
  onOpenAttachment,
  className = "",
}: TicketPropertiesAsideProps) {
  const email = ticket.contactEmail ?? ticket.requesterEmail ?? null;
  const isPaused = Boolean(ticket.pausedAt);

  return (
    <aside aria-label="Datos del ticket" className={className}>
      <div className="divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-2xs">
        {/* SECCIÓN 1: CLIENTE */}
        <div>
          <SectionHeader title="Cliente" icon={Building2} />
          <div className="px-3.5 py-1">
            {ticket.clientName ? (
              <div className="flex items-center gap-2 py-1">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 font-heading text-[9.5px] font-bold tracking-[0.04em] text-zinc-700">
                  {ticket.clientName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[12.5px] font-semibold text-zinc-900 leading-tight" title={ticket.clientName}>
                      {ticket.clientName}
                    </span>
                    {ticket.clientCode && (
                      <span className="shrink-0 rounded-md bg-zinc-100 px-1 py-0.5 font-heading text-[9.5px] font-bold leading-none tabular-nums text-zinc-500">
                        #{ticket.clientCode}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-1 text-[12px] text-zinc-400 italic">Sin cliente asignado</div>
            )}

            <PropertyRow label="Contacto">
              <span className="block truncate" title={ticket.contactName ?? undefined}>
                {ticket.contactName ?? <span className="text-zinc-400 font-normal">Sin contacto</span>}
              </span>
            </PropertyRow>

            {email && (
              <PropertyRow label="Correo">
                <a
                  href={`mailto:${email}`}
                  title={email}
                  className="inline-flex max-w-full items-center justify-end gap-1 text-zinc-800 hover:text-brand-red hover:underline transition-colors"
                >
                  <Mail className="h-3 w-3 shrink-0 text-zinc-400" />
                  <span className="truncate">{email}</span>
                </a>
              </PropertyRow>
            )}

            {ticket.contactPhone && (
              <PropertyRow label="Teléfono" isLast>
                <a
                  href={`tel:${ticket.contactPhone}`}
                  className="inline-flex items-center justify-end gap-1 tabular-nums text-zinc-800 hover:text-brand-red hover:underline transition-colors whitespace-nowrap"
                >
                  <Phone className="h-3 w-3 shrink-0 text-zinc-400" />
                  <span className="whitespace-nowrap">{ticket.contactPhone}</span>
                </a>
              </PropertyRow>
            )}
          </div>
        </div>

        {/* SECCIÓN 2: CLASIFICACIÓN Y ASIGNACIÓN */}
        <div>
          <SectionHeader
            title="Clasificación"
            icon={Tag}
            action={canEdit && <SectionAction label="Editar" icon={Pencil} onClick={onEdit} />}
          />
          <div className="px-3.5 py-1">
            <PropertyRow label="Responsable">
              <div className="flex items-center justify-end gap-1.5 min-w-0">
                {ticket.assignedStaffName && ticket.assignedStaffId !== null ? (
                  <div
                    className="flex min-w-0 items-center justify-end gap-1.5"
                    title={ticket.assignedStaffName}
                  >
                    <Avatar name={ticket.assignedStaffName} seed={ticket.assignedStaffId} size={18} />
                    <span className="truncate whitespace-nowrap text-[12px] font-medium text-zinc-900 leading-tight">
                      {ticket.assignedStaffName}
                    </span>
                  </div>
                ) : (
                  <span className="text-zinc-400 font-normal italic whitespace-nowrap">Sin asignar</span>
                )}
                {canAssign && (
                  <button
                    type="button"
                    onClick={onAssign}
                    title={ticket.assignedStaffId ? "Cambiar responsable" : "Asignar responsable"}
                    className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-md text-zinc-400 outline-none transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-brand-red/25"
                  >
                    <Pencil className="size-3" />
                  </button>
                )}
              </div>
            </PropertyRow>

            <PropertyRow label="Departamento">
              <span className="block truncate" title={ticket.departmentName ?? undefined}>
                {ticket.departmentName ?? <span className="text-zinc-400 font-normal">—</span>}
              </span>
            </PropertyRow>

            <PropertyRow label="Motivo">
              <span className="block truncate" title={ticket.topicName ?? undefined}>
                {ticket.topicName ?? <span className="text-zinc-400 font-normal">—</span>}
              </span>
            </PropertyRow>

            <PropertyRow label="Línea">
              <span className="block truncate" title={ticket.productLineName ?? undefined}>
                {ticket.productLineName ?? <span className="text-zinc-400 font-normal">No aplica</span>}
              </span>
            </PropertyRow>

            <PropertyRow label="Prioridad">
              <PriorityCell priority={ticket.priority} />
            </PropertyRow>

            <PropertyRow label="Canal" isLast>
              <span className="capitalize text-zinc-800 whitespace-nowrap">{ticket.channel}</span>
            </PropertyRow>
          </div>
        </div>

        {/* SECCIÓN 3: SLA Y TIEMPOS */}
        <div>
          <SectionHeader
            title="SLA y tiempos"
            icon={Clock}
            action={<SlaCell sla={sla} />}
          />
          <div className="px-3.5 py-1">
            <PropertyRow label="Resolución">
              {ticket.resolutionDueAt ? (
                <span
                  className={`tabular-nums whitespace-nowrap ${
                    sla.tone === "overdue" ? "font-semibold text-brand-red" : "text-zinc-800"
                  }`}
                >
                  {formatDateTime(ticket.resolutionDueAt)}
                </span>
              ) : (
                <span className="text-zinc-400 font-normal whitespace-nowrap">Sin compromiso</span>
              )}
            </PropertyRow>

            <PropertyRow label="1.ª respuesta">
              {ticket.firstResponseAt ? (
                <span
                  className="text-emerald-700 font-medium tabular-nums whitespace-nowrap truncate block"
                  title={`Lograda el ${formatDateTime(ticket.firstResponseAt)}`}
                >
                  Lograda · {formatDateTime(ticket.firstResponseAt)}
                </span>
              ) : ticket.firstResponseDueAt ? (
                <span className="tabular-nums text-zinc-800 whitespace-nowrap">
                  Límite · {formatDateTime(ticket.firstResponseDueAt)}
                </span>
              ) : (
                <span className="text-zinc-400 font-normal whitespace-nowrap">Pendiente</span>
              )}
            </PropertyRow>

            {isPaused && (
              <PropertyRow label="En pausa">
                <span className="font-medium text-amber-700 tabular-nums whitespace-nowrap">
                  Desde {formatDateTime(ticket.pausedAt!)}
                </span>
              </PropertyRow>
            )}

            {ticket.pausedMinutes > 0 && (
              <PropertyRow label="Tiempo pausa">
                <span className="tabular-nums text-zinc-800 whitespace-nowrap">{ticket.pausedMinutes} min</span>
              </PropertyRow>
            )}

            {ticket.reopenedCount > 0 && (
              <PropertyRow label="Reaperturas">
                <span className="font-bold tabular-nums text-amber-700 whitespace-nowrap">{ticket.reopenedCount}</span>
              </PropertyRow>
            )}

            {ticket.resolvedAt && (
              <PropertyRow label="Resuelto">
                <span className="tabular-nums text-zinc-800 whitespace-nowrap">{formatDateTime(ticket.resolvedAt)}</span>
              </PropertyRow>
            )}

            {ticket.closedAt && (
              <PropertyRow label="Cerrado">
                <span className="tabular-nums text-zinc-800 whitespace-nowrap">{formatDateTime(ticket.closedAt)}</span>
              </PropertyRow>
            )}

            <PropertyRow label="Actividad" isLast>
              <span className="tabular-nums text-zinc-600 whitespace-nowrap">{formatDateTime(ticket.lastActivityAt)}</span>
            </PropertyRow>
          </div>
        </div>

        {/* SECCIÓN 4: OBSERVADORES (SI EXISTEN) */}
        {ticket.watchers.length > 0 && (
          <div>
            <SectionHeader title={`Observadores (${ticket.watchers.length})`} icon={Users} />
            <div className="px-3.5 py-2">
              <div className="flex flex-wrap gap-1.5">
                {ticket.watchers.map((watcher) => (
                  <div
                    key={watcher.id}
                    className="inline-flex h-6 items-center gap-1.5 rounded-md border border-zinc-200 bg-white pl-1 pr-2 text-[11px] text-zinc-800"
                    title={`${watcher.staffName} (${watcher.staffEmail})`}
                  >
                    <Avatar name={watcher.staffName} seed={watcher.id} size={16} />
                    <span className="max-w-[120px] truncate font-medium">{watcher.staffName}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SECCIÓN 5: ADJUNTOS (SI EXISTEN) */}
        {ticket.attachments.length > 0 && (
          <div>
            <SectionHeader title={`Adjuntos (${ticket.attachments.length})`} icon={FileText} />
            <div className="divide-y divide-zinc-100/80 px-3.5 py-1">
              {ticket.attachments.map((attachment) => (
                <button
                  key={attachment.id}
                  type="button"
                  onClick={() => onOpenAttachment(ticket.attachments, attachment.id)}
                  title={`Abrir ${attachment.fileName}`}
                  className="group flex w-full cursor-pointer items-center justify-between gap-2 rounded py-1.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-red/25"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className="flex size-5 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-500 transition-colors duration-200 group-hover:bg-brand-red/10 group-hover:text-brand-red"
                    >
                      <FileText className="size-3" strokeWidth={2.25} />
                    </span>
                    <span className="truncate text-[12px] font-medium text-zinc-700 group-hover:text-zinc-900">
                      {attachment.fileName}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 font-heading text-[10px] font-bold tabular-nums text-zinc-400">
                    <span>{formatBytes(attachment.sizeBytes)}</span>
                    <Eye className="size-3 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
