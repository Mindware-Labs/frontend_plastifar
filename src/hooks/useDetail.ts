import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useContext, useState, type SetStateAction } from "react";
import { ApiError } from "../api/client";
import { KEPT_VIEW_TTL_MS, KeptViewContext } from "../lib/keptViews";

interface Messages {
  /**
   * Nombre del recurso en la cache: la clave es `[resource, id]`. Debe ser el
   * mismo que usa cualquier otra pantalla que lea ese registro con la misma
   * funcion (los paneles de resumen usan `["claims", id]`, etc.).
   */
  resource: string;
  /** 404: no existe o quien mira no tiene acceso; el servidor no distingue, y la pantalla tampoco. */
  notFound: string;
  /** Cualquier otro fallo de carga. */
  failed: string;
}

/**
 * La ficha de un registro por id, sobre TanStack Query.
 *
 * Cada id tiene su propia clave, asi que una respuesta tardia de otro id no
 * puede pisar la ficha y al cambiar de id la pantalla arranca vacia, como antes.
 *
 * `setData` escribe en la cache (las pantallas lo usan tras guardar para no
 * releer). `reload` vuelve a pedirla sin vaciar lo que se ve: sirve para
 * reintentar tras un error y para refrescar tras un 409. Oculta el error
 * mientras dura, porque si no la pantalla de error se queda aunque la recarga
 * funcione.
 */
export function useDetail<T>(id: number, fetch: (id: number) => Promise<T>, messages: Messages) {
  const queryClient = useQueryClient();
  const queryKey = [messages.resource, id] as const;

  // En una vista viva solo se alarga la vida en caché: la ficha espera su lectura de montaje y un staleTime la saltaría.
  const kept = useContext(KeptViewContext);
  const query = useQuery({ queryKey, queryFn: () => fetch(id), ...(kept ? { gcTime: KEPT_VIEW_TTL_MS } : {}) });

  const [reloading, setReloading] = useState(false);

  const error =
    query.isError && !reloading
      ? query.error instanceof ApiError && query.error.status === 404
        ? messages.notFound
        : messages.failed
      : null;

  const resource = messages.resource;
  const setData = useCallback(
    (next: SetStateAction<T | null>) => {
      queryClient.setQueryData<T | null>([resource, id], (current) =>
        typeof next === "function" ? (next as (value: T | null) => T | null)(current ?? null) : next,
      );
    },
    [queryClient, resource, id],
  );

  const { refetch } = query;
  function reload() {
    setReloading(true);
    void refetch().finally(() => setReloading(false));
  }

  // Al abrir la ficha se espera la lectura de este montaje, como antes: la copia
  // de la cache podria sembrar los formularios de edicion con datos ya cambiados.
  const data = query.isFetchedAfterMount ? (query.data ?? null) : null;

  return { data, setData, error, reload };
}
