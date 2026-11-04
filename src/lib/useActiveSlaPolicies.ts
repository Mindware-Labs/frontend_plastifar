import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import type { SlaPolicy, SlaPolicyType } from "../types/settings";
import { catalogs } from "./catalogQueries";
import { queryClient } from "./queryClient";

/*
 * Politicas de SLA activas, por tipo, sobre la cache de TanStack Query.
 *
 * Antes este modulo llevaba su propia cache a mano (un Map de promesas). Ahora
 * es la entrada `catalogs.activeSlaPolicies(type)`: la comparten el alta de
 * ticket, el detalle y el formulario de tarea, y se invalida sola con
 * cualquier escritura (incluida la de Configuracion › SLA).
 */

let prefetchStarted = false;

/** Precarga Ticket y Tarea en segundo plano (una sola vez por sesión). */
export function prefetchActiveSlaPolicies() {
  if (prefetchStarted) return;
  prefetchStarted = true;
  void queryClient.prefetchQuery(catalogs.activeSlaPolicies("Ticket"));
  void queryClient.prefetchQuery(catalogs.activeSlaPolicies("Tarea"));
}

/** Se conserva por compatibilidad: la escritura ya marca la cache como vieja. */
export function invalidateActiveSlaPoliciesCache(type?: SlaPolicyType) {
  void queryClient.invalidateQueries({
    queryKey: type ? catalogs.activeSlaPolicies(type).queryKey : ["catalog", "sla-policies"],
  });
}

const EMPTY: SlaPolicy[] = [];

export function useActiveSlaPolicies(type: SlaPolicyType) {
  useEffect(() => {
    prefetchActiveSlaPolicies();
  }, []);

  const query = useQuery(catalogs.activeSlaPolicies(type));

  // Mismo contrato que antes: `null` solo mientras no hay nada, `[]` si fallo.
  const policies = query.data ?? (query.isError ? EMPTY : null);
  return { policies, loading: query.isPending && !query.isError, failed: query.isError };
}
