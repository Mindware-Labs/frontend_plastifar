import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Navegación desde el tablero hacia las listas que producen cada cifra.
 *
 * Ya NO es un no-op. `TicketsPage` hidrata su filtro desde `?estado=`, así que
 * un click en «19 vencidos» abre la bandeja mostrando esos 19 — que es lo único
 * que justifica que la cifra sea clicable.
 *
 * Los valores de `estado` son exactamente las claves de `TicketFilterKey`:
 * `todos · abiertos · por-vencer · vencidos · espera · cerrados`. No hay
 * traducción en el medio a propósito: un mapa entre dos vocabularios es un
 * sitio donde se desincronizan.
 *
 * ------------------------------------------------------------------
 * LO QUE TODAVÍA NO FILTRA
 * ------------------------------------------------------------------
 * Tema, canal y responsable llevan a la bandeja completa. `TicketQuery` ya
 * acepta `topicId`, `assignedStaffId` y el canal, pero `TicketsPage` sólo lee
 * `estado` de la URL; extenderlo es repetir el mismo patrón tres veces. Hasta
 * entonces el destino es honesto —la bandeja— y el rótulo del enlace lo dice.
 */

export type DashboardFilter =
  | { kind: "estado"; value: string; label: string }
  | { kind: "tema"; value: string; label: string }
  | { kind: "responsable"; value: string; label: string }
  | { kind: "canal"; value: string; label: string }
  | { kind: "hca"; value: string; label: string };

/** A dónde lleva cada filtro. */
export function pathFor(filter: DashboardFilter): string {
  switch (filter.kind) {
    case "estado":
      return `/tickets?estado=${encodeURIComponent(filter.value)}`;
    case "hca":
      return `/calidad/hca?estado=${encodeURIComponent(filter.value)}`;
    default:
      // Tema, canal y responsable: la bandeja sin acotar, todavía.
      return "/tickets";
  }
}

/** Navega al destino de un filtro del tablero. */
export function useApplyFilter() {
  const navigate = useNavigate();
  return useCallback((filter: DashboardFilter) => navigate(pathFor(filter)), [navigate]);
}
