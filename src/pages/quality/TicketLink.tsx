import { Ticket } from "lucide-react";
import { Tooltip } from "../../components/ui/Tooltip";

interface TicketLinkProps {
  number: string | null;
}

/**
 * Vinculo con el ticket que origino la hoja o la solicitud (10.3, regla 8).
 *
 * El dato existe y se muestra; lo que no existe todavia es la Bandeja, asi que
 * el enlace se pinta apagado y dice por que en lugar de fingir que lleva a algun
 * sitio. Cuando Richard entregue el modulo, esto pasa a ser un <Link>.
 */
export function TicketLink({ number }: TicketLinkProps) {
  if (number === null) {
    return <span className="text-[12.5px] text-faint">Sin ticket</span>;
  }

  return (
    <Tooltip
      content="La Bandeja de tickets todavía no existe: el vínculo se activa cuando se entregue."
    >
      <span className="inline-flex cursor-not-allowed items-center gap-1.5 whitespace-nowrap text-[12.5px] text-muted">
        <Ticket aria-hidden className="h-3.5 w-3.5 text-faint" />
        <span className="font-mono text-[12px]">{number}</span>
      </span>
    </Tooltip>
  );
}
