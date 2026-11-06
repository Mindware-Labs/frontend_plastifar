
export type TicketOriginFilter = "plastifar" | "legacy";

export const TICKETS_LIST_ROUTES = {
  actuales: "/tickets",
  historico: "/tickets/historico",
} as const;

export function ticketOriginFromPath(pathname: string): TicketOriginFilter {
  return pathname.startsWith(TICKETS_LIST_ROUTES.historico) ? "legacy" : "plastifar";
}

const TICKET_DETAIL_RESERVED_SLUGS = {
  historico: TICKETS_LIST_ROUTES.historico,
  motivos: "/tickets/motivos",
  veredictos: "/tickets/veredictos",
} as const;

/** Slugs de listado que no deben interpretarse como id de ticket en /tickets/:id. */
export function ticketDetailReservedRedirect(pathSegment: string | undefined): string | null {
  if (!pathSegment) return null;
  const key = pathSegment.toLowerCase() as keyof typeof TICKET_DETAIL_RESERVED_SLUGS;
  return TICKET_DETAIL_RESERVED_SLUGS[key] ?? null;
}

export function parseTicketDetailId(raw: string | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return id > 0 ? id : null;
}
