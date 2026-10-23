// Texto y búsquedas de la investigación de discrepancia de carga, sin React.
import { ticketsApi } from "../api/tickets";
import type { LookupResult } from "../components/ui/LookupSelect";
import type { DiscrepancyStatus } from "../types/discrepancies";

/** Control documental de la cabecera del PF-FOR-291, tal como está en la plantilla. */
export const DISCREPANCY_FORM_CONTROL = {
  code: "PF-FOR-291",
  title: "Formulario de Investigación de Discrepancia de Carga",
  issuedOn: "30 de mayo de 2019",
  revision: "1",
  revisedOn: "27 de agosto de 2020",
} as const;

/** El punto 9 no evalúa la carga: pregunta si se notificó, y solo aplica con un positivo del 1 al 8. */
export const NOTIFICATION_ITEM = 9;

export function describeStatus(status: DiscrepancyStatus): string {
  switch (status) {
    case "En investigación":
      return "Monitoreo la está llenando; se da por completa cuando están las líneas y los puntos de seguridad.";
    case "Completada":
      return "Realizada; a la espera de que quien aprueba la firme o la devuelva.";
    case "Aprobada":
      return "Aprobada. Es el estado final y ya no se edita.";
    default:
      return "Devuelta con nota; se reabre para corregirla.";
  }
}

/**
 * Búsqueda de tickets para ligar la investigación. Mismo adaptador que el
 * resto de los `LookupField`: veinte como mucho, y se invita a acotar.
 */
export async function searchTickets(term: string): Promise<LookupResult> {
  const { items, total } = await ticketsApi.list({ page: 1, pageSize: 20, search: term || undefined });
  return {
    options: items.map((ticket) => ({
      value: String(ticket.id),
      label: `${ticket.number} · ${ticket.subject}`,
      hint: ticket.clientName ?? undefined,
    })),
    hasMore: total > items.length,
  };
}

export async function resolveTicketLabel(value: string): Promise<string | null> {
  const ticket = await ticketsApi.getById(Number(value));
  return `${ticket.number} · ${ticket.subject}`;
}

