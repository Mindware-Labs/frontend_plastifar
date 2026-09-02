import { useEffect, useRef, useState } from "react";
import { ApiError } from "../api/client";

interface PagedData {
  page: number;
  totalPages: number;
}

interface Options<TQuery extends { page: number }, TData extends PagedData> {
  fetch: (query: TQuery) => Promise<TData>;
  /** Todo lo que no es la pagina. Cambiar cualquier criterio vuelve a la primera. */
  criteria: Omit<TQuery, "page">;
  fallbackError: string;
}

/**
 * Listado paginado contra el servidor: consulta cuando cambian los criterios,
 * descarta respuestas que llegan tarde, conserva la pagina anterior atenuada
 * mientras carga la nueva y corrige la pagina si se queda fuera de rango.
 */
export function usePagedList<TQuery extends { page: number }, TData extends PagedData>({
  fetch,
  criteria,
  fallbackError,
}: Options<TQuery, TData>) {
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<{ key: string; data: TData } | null>(null);

  const criteriaKey = JSON.stringify(criteria);
  const [lastCriteria, setLastCriteria] = useState(criteriaKey);
  if (criteriaKey !== lastCriteria) {
    setLastCriteria(criteriaKey);
    setPage(1);
  }

  const queryJson = JSON.stringify({ ...criteria, page });
  const queryKey = `${queryJson}|${reloadKey}`;

  // La funcion de consulta se lee por ref: el efecto no debe reejecutarse por ella.
  const fetchRef = useRef(fetch);
  useEffect(() => {
    fetchRef.current = fetch;
  });

  useEffect(() => {
    let cancelled = false;

    fetchRef
      .current(JSON.parse(queryJson) as TQuery)
      .then((data) => {
        if (cancelled) return;
        setSnapshot({ key: `${queryJson}|${reloadKey}`, data });
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : fallbackError);
      });

    return () => {
      cancelled = true;
    };
  }, [queryJson, reloadKey, fallbackError]);

  const data = snapshot?.data ?? null;
  const isStale = snapshot !== null && snapshot.key !== queryKey;

  // Borrar la ultima fila de la ultima pagina deja la pagina fuera de rango.
  if (data && data.totalPages > 0 && page > data.totalPages) setPage(data.totalPages);

  /** Tras cada cambio se relee la pagina: totales y contadores vienen del servidor. */
  function refresh() {
    setReloadKey((value) => value + 1);
  }

  return { data, isStale, error, page, setPage, refresh };
}
