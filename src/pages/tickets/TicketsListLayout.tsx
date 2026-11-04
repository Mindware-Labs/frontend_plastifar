import { useLocation } from "react-router-dom";
import { TicketsPage } from "./TicketsPage";
import { ticketOriginFromPath } from "./ticketLegacy";

/** Misma instancia al alternar /tickets y /tickets/historico (transición fluida). */
export function TicketsListLayout() {
  const { pathname } = useLocation();
  const origin = ticketOriginFromPath(pathname);
  return <TicketsPage origin={origin} />;
}
