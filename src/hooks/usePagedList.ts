import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { ApiError } from "../api/client";

interface PagedData {
  page: number;
  totalPages: number;
}

interface Options<TQuery extends { page: number }, TData extends PagedData> {
  /**
   * Identifica el listado en la cache. Debe incluir todo lo que la funcion
   * `fetch` lee por fuera de `criteria` (p. ej. el id del cliente en sus
   * contactos): dos listados con la misma clave comparten datos.
   *
   * Opcional: sin ella la clave sale de `fallbackError`, que es distinto en cada
   * listado. Asi las pantallas que no se migraron siguen funcionando sin tocarlas.
   */
  queryKey?: readonly unknown[];
  fetch: (query: TQuery) => Promise<TData>;
  /** Todo lo que no es la pagina. Cambiar cualquier criterio vuelve a la primera. */
  criteria: Omit<TQuery, "page">;
  fallbackError: string;
  /** Si es false, no se dispara la peticion (p. ej. esperar pestañas de bandeja). */
  enabled?: boolean;
  /** Nombre del query param de pagina en la URL (reservado; compatibilidad con listados). */
  pageKey?: string;
}

/**
 * Listado paginado sobre TanStack Query.
 *
 * Conserva la interfaz de la version con `useEffect` —`data`, `isStale`,
 * `error`, `page`, `setPage`, `refresh`— para que las pantallas no cambien:
 *
 * - `data` es la ultima respuesta, aunque sea de los criterios anteriores
 *   (`keepPreviousData`): la tabla no se vacia mientras llega la nueva pagina.
 * - `isStale` es true mientras se muestra esa respuesta anterior.
 * - `error` es el mensaje en español del ultimo fallo, o null.
 * - `refresh` relee en segundo plano sin marcar la vista como obsoleta.
 *
 * Lo que gana: volver a una lista ya visitada pinta al instante lo que habia y
 * la relee detras, y dos montajes simultaneos (StrictMode) piden una sola vez.
 * Las respuestas viejas se descartan solas porque cada pagina tiene su clave.
 */
export function usePagedList<TQuery extends { page: number }, TData extends PagedData>({
  queryKey,
  fetch,
  criteria,
  fallbackError,
  enabled = true,
}: Options<TQuery, TData>) {
  const [page, setPage] = useState(1);

  const criteriaKey = JSON.stringify(criteria);
  const [lastCriteria, setLastCriteria] = useState(criteriaKey);
  if (criteriaKey !== lastCriteria) {
    setLastCriteria(criteriaKey);
    setPage(1);
  }

  const queryJson = JSON.stringify({ ...criteria, page });

  const query = useQuery({
    queryKey: [...(queryKey ?? ["paged-list", fallbackError]), "paged", queryJson],
    queryFn: () => fetch(JSON.parse(queryJson) as TQuery),
    enabled,
    placeholderData: keepPreviousData,
  });

  /*
   * `keepPreviousData` solo cubre la espera: si la pagina nueva FALLA, TanStack
   * deja `data` en undefined y la tabla se vaciaba. La version anterior
   * conservaba las ultimas filas buenas (atenuadas) junto al aviso, y el aviso
   * seguia hasta la siguiente carga correcta. Se guarda aqui esa ultima
   * respuesta buena y el ultimo error para reproducirlo.
   */
  const [lastGood, setLastGood] = useState<TData | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  if (query.data && !query.isPlaceholderData && query.data !== lastGood) {
    setLastGood(query.data);
    if (lastError !== null) setLastError(null);
  }
  if (query.isError) {
    const message = query.error instanceof ApiError ? query.error.message : fallbackError;
    if (message !== lastError) setLastError(message);
  }

  const data = query.data ?? (query.isError ? lastGood : null);
  const isStale = query.isPlaceholderData || (query.isError && lastGood !== null);
  const error = lastError;

  // Borrar la ultima fila de la ultima pagina deja la pagina fuera de rango.
  if (data && !isStale && data.totalPages > 0 && page > data.totalPages) setPage(data.totalPages);

  const { refetch } = query;
  /** Tras cada cambio se relee la pagina en segundo plano sin marcar la vista como obsoleta. */
  // Con `enabled: false` la version anterior tampoco pedia nada al refrescar.
  const refresh = useCallback(() => {
    if (enabled) void refetch();
  }, [refetch, enabled]);

  return { data, isStale, error, page, setPage, refresh };
}
