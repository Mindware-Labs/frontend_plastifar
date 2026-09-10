import { Eye, Mail, Pencil, Phone, UserCheck } from "lucide-react";
import type { ReactNode } from "react";
import { formatBytes, formatDateTime, type formatSlaRemaining } from "../../lib/format";
import type { TicketAttachmentResponse, TicketDetailResponse } from "../../types/api";
import { AssigneeCell, PriorityCell, SlaCell } from "./ticketCells";

interface SectionProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}

function Section({ title, action, children }: SectionProps) {
  return (
    <section className="border-b border-line py-4 first:pt-0 last:border-0 last:pb-0">
      <div className="mb-2.5 flex h-6 items-center justify-between gap-2">
        <h2 className="font-heading text-[10.5px] font-bold uppercase tracking-[0.08em] text-faint">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Accion de seccion: texto corto en rojo, sin peso de boton, porque la seccion es lo que manda. */
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
      className="-mr-1.5 inline-flex h-6 items-center gap-1 rounded-edge px-1.5 font-heading text-[10.5px] font-semibold
        uppercase tracking-[0.06em] text-brand-red-dark outline-none transition-colors hover:bg-brand-red/[0.06]
        focus-visible:ring-3 focus-visible:ring-brand-red/20"
    >
      <Icon aria-hidden className="h-3 w-3" />
      {label}
    </button>
  );
}

function Field({ label, children, title }: { label: string; children: ReactNode; title?: string }) {
  return (
    <>
      <dt className="text-[12px] text-subtle">{label}</dt>
      <dd className="min-w-0 truncate text-[12.5px] text-ink" title={title}>
        {children}
      </dd>
    </>
  );
}

const Empty = ({ children }: { children: ReactNode }) => <span className="text-faint">{children}</span>;

const listClass = "grid grid-cols-[96px_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1.5";

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

/** Ficha del ticket: todo lo que no es conversacion, siempre a la vista junto al hilo. */
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
      <Section title="Cliente">
        <dl className={listClass}>
          <Field label="Razón social" title={ticket.clientName ?? undefined}>
            {ticket.clientName ? (
              <span className="font-medium">{ticket.clientName}</span>
            ) : (
              <Empty>Sin cliente</Empty>
            )}
          </Field>
          {ticket.clientCode && (
            <Field label="Código">
              <span className="tabular-nums">{ticket.clientCode}</span>
            </Field>
          )}
          <Field label="Contacto" title={ticket.contactName ?? undefined}>
            {ticket.contactName ?? <Empty>Sin contacto</Empty>}
          </Field>
          {email && (
            <Field label="Correo" title={email}>
              <a
                href={`mailto:${email}`}
                className="inline-flex max-w-full items-center gap-1.5 rounded-edge outline-none hover:underline
                  focus-visible:ring-3 focus-visible:ring-brand-red/20"
              >
                <Mail aria-hidden className="h-3.5 w-3.5 shrink-0 text-faint" />
                <span className="truncate">{email}</span>
              </a>
            </Field>
          )}
          {ticket.contactPhone && (
            <Field label="Teléfono">
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Phone aria-hidden className="h-3.5 w-3.5 shrink-0 text-faint" />
                {ticket.contactPhone}
              </span>
            </Field>
          )}
        </dl>
      </Section>

      <Section
        title="Clasificación"
        action={canEdit && <SectionAction label="Editar" icon={Pencil} onClick={onEdit} />}
      >
        <dl className={listClass}>
          <Field label="Departamento" title={ticket.departmentName ?? undefined}>
            {ticket.departmentName ?? <Empty>Sin departamento</Empty>}
          </Field>
          <Field label="Motivo" title={ticket.topicName ?? undefined}>
            {ticket.topicName ?? <Empty>Sin motivo</Empty>}
          </Field>
          <Field label="Línea" title={ticket.productLineName ?? undefined}>
            {ticket.productLineName ?? <Empty>No aplica</Empty>}
          </Field>
          <Field label="Prioridad">
            <PriorityCell priority={ticket.priority} />
          </Field>
          <Field label="Canal">{ticket.channel}</Field>
        </dl>
      </Section>

      <Section
        title="Asignación"
        action={
          canAssign && (
            <SectionAction
              label={ticket.assignedStaffId ? "Cambiar" : "Asignar"}
              icon={UserCheck}
              onClick={onAssign}
            />
          )
        }
      >
        <AssigneeCell id={ticket.assignedStaffId} name={ticket.assignedStaffName} />
      </Section>

      <Section title="SLA" action={<SlaCell sla={sla} />}>
        <dl className={listClass}>
          <Field label="Resolución">
            {ticket.resolutionDueAt ? (
              <span className={sla.tone === "overdue" ? "font-medium text-brand-red-dark" : ""}>
                {formatDateTime(ticket.resolutionDueAt)}
              </span>
            ) : (
              <Empty>Sin compromiso</Empty>
            )}
          </Field>
          <Field label="1.ª respuesta">
            {ticket.firstResponseAt ? (
              <span className="text-brand-green">Lograda · {formatDateTime(ticket.firstResponseAt)}</span>
            ) : ticket.firstResponseDueAt ? (
              <span>Límite · {formatDateTime(ticket.firstResponseDueAt)}</span>
            ) : (
              <Empty>Pendiente</Empty>
            )}
          </Field>
          {isPaused && (
            <Field label="En pausa">
              <span className="text-warn">Desde {formatDateTime(ticket.pausedAt!)}</span>
            </Field>
          )}
          {ticket.pausedMinutes > 0 && (
            <Field label="Tiempo en pausa">
              <span className="tabular-nums">{ticket.pausedMinutes} min</span>
            </Field>
          )}
          {ticket.reopenedCount > 0 && (
            <Field label="Reaperturas">
              <span className="font-medium tabular-nums text-warn">{ticket.reopenedCount}</span>
            </Field>
          )}
          {ticket.resolvedAt && <Field label="Resuelto">{formatDateTime(ticket.resolvedAt)}</Field>}
          {ticket.closedAt && <Field label="Cerrado">{formatDateTime(ticket.closedAt)}</Field>}
          <Field label="Actividad">{formatDateTime(ticket.lastActivityAt)}</Field>
        </dl>
      </Section>

      {ticket.watchers.length > 0 && (
        <Section title={`Observadores · ${ticket.watchers.length}`}>
          <ul className="space-y-1.5">
            {ticket.watchers.map((watcher) => (
              <li key={watcher.id} className="min-w-0 text-[12.5px]" title={watcher.staffEmail}>
                <span className="text-ink">{watcher.staffName}</span>
                <span className="block truncate text-[11.5px] text-subtle">{watcher.staffEmail}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {ticket.attachments.length > 0 && (
        <Section title={`Adjuntos · ${ticket.attachments.length}`}>
          {/* La fila entera es el control: el ojo solo senala que hace. */}
          <ul className="-mx-2 space-y-0.5">
            {ticket.attachments.map((attachment) => (
              <li key={attachment.id}>
                <button
                  type="button"
                  onClick={() => onOpenAttachment(ticket.attachments, attachment.id)}
                  title={`Abrir ${attachment.fileName}`}
                  className="group flex w-full items-center justify-between gap-2 rounded-edge px-2 py-1.5 text-left
                    outline-none transition-colors hover:bg-fill focus-visible:ring-3 focus-visible:ring-brand-red/12"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] text-ink">{attachment.fileName}</span>
                    <span className="block text-[11px] tabular-nums text-subtle">
                      {formatBytes(attachment.sizeBytes)} · {formatDateTime(attachment.createdAt)}
                    </span>
                  </span>
                  <Eye aria-hidden className="h-3.5 w-3.5 shrink-0 text-faint transition-colors group-hover:text-ink" />
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </aside>
  );
}
