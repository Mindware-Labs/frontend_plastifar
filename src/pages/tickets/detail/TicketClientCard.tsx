import { ArrowRight, Building2, Mail, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import { CopyButton } from "../../../components/ui/CopyButton";
import { DetailCard } from "../../../components/ui/DetailCard";
import { formatPhoneNumber } from "../../../lib/format";
import type { TicketDetailResponse } from "../../../types/api";

interface TicketClientCardProps {
  ticket: TicketDetailResponse;
  recipientEmail: string | null;
}

/** Card: Cliente y Contacto. */
export function TicketClientCard({ ticket, recipientEmail }: TicketClientCardProps) {
  return (
    <DetailCard
      icon={Building2}
      title="Cliente y Contacto"
      aside={
        ticket.clientCode && (
          <span className="font-mono text-[11px] font-medium text-zinc-500 bg-white border border-zinc-200/80 px-2 py-0.5 rounded shadow-2xs tabular-nums">
            #{ticket.clientCode}
          </span>
        )
      }
    >
      <div className="p-4 space-y-3">
        {ticket.clientName ? (
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 font-heading text-[11px] font-bold tracking-[0.04em] text-zinc-700">
                {ticket.clientName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <span className="block truncate text-[13.5px] font-bold text-zinc-900 leading-tight" title={ticket.clientName}>
                  {ticket.clientName}
                </span>
                {ticket.clientId && (
                  <Link
                    to={`/clientes/${ticket.clientId}`}
                    className="inline-flex items-center gap-1 text-[11.5px] text-brand-red font-medium hover:underline mt-0.5"
                  >
                    <span>Ver ficha de cliente</span>
                    <ArrowRight className="size-3" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-2 text-[12.5px] text-zinc-400 italic">Sin cliente asociado</div>
        )}

        <div className="pt-2 border-t border-zinc-100 divide-y divide-zinc-100 text-[12.5px]">
          <div className="flex items-center justify-between py-2">
            <span className="text-zinc-500 font-medium">Contacto</span>
            <span className="font-semibold text-zinc-800 text-right truncate max-w-[65%]" title={ticket.contactName ?? undefined}>
              {ticket.contactName ?? <span className="text-zinc-400 font-normal">Sin contacto</span>}
            </span>
          </div>

          {recipientEmail && (
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-1.5 text-zinc-500 font-medium">
                <Mail className="size-3 text-zinc-400" />
                <span>Correo</span>
              </div>
              <div className="flex items-center gap-1.5 max-w-[65%]">
                <a
                  href={`mailto:${recipientEmail}`}
                  title={recipientEmail}
                  className="text-zinc-900 font-medium hover:text-brand-red truncate"
                >
                  {recipientEmail}
                </a>
                <CopyButton text={recipientEmail} label="Copiar correo" className="cursor-pointer" />
              </div>
            </div>
          )}

          {ticket.contactPhone && (
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-1.5 text-zinc-500 font-medium">
                <Phone className="size-3 text-zinc-400" />
                <span>Teléfono</span>
              </div>
              <div className="flex items-center gap-1.5">
                <a
                  href={`tel:${ticket.contactPhone}`}
                  className="font-mono text-zinc-900 font-medium hover:text-brand-red tabular-nums"
                >
                  {formatPhoneNumber(ticket.contactPhone)}
                </a>
                <CopyButton text={ticket.contactPhone} label="Copiar teléfono" className="cursor-pointer" />
              </div>
            </div>
          )}
        </div>
      </div>
    </DetailCard>
  );
}
