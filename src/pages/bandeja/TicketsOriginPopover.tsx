import { ArrowUpRight, Ticket as TicketIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/shadcn/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/shadcn/tooltip";
import { formatTicketCode } from "../../lib/format";

interface TicketsOriginPopoverProps {
  note: string;
  ticketId: number | null;
}

/** Indicador flotante en barra de herramientas con acceso al ticket vinculado. */
export function TicketsOriginPopover({ note, ticketId }: TicketsOriginPopoverProps) {
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
