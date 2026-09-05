import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../api/client";

interface Options<T> {
  fetch: () => Promise<T>;
  /** Identifica la consulta: al cambiar, se vuelve a pedir. */
  key: string;
  fallbackError: string;
}

/**
 * Consulta no paginada de un reporte, con el mismo contrato que `usePagedList`:
 * descarta la respuesta que llega tarde, conserva el resultado anterior
 * atenuado mientras carga el nuevo y deja reintentar tras un fallo. Sin esto,
 * una respuesta lenta de un rango viejo pisaba las cifras del rango actual.
 */
export function useReportData<T>({ fetch, key, fallbackError }: Options<T>) {
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<{ key: string; data: T } | null>(null);

  // La funcion de consulta se lee por ref: el efecto no debe reejecutarse por ella.
  const fetchRef = useRef(fetch);
  useEffect(() => {
    fetchRef.current = fetch;
  });

  useEffect(() => {
    let cancelled = false;

    fetchRef
      .current()
      .then((data) => {
        if (cancelled) return;
        setSnapshot({ key, data });
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : fallbackError);
      });

    return () => {
      cancelled = true;
    };
  }, [key, reloadKey, fallbackError]);

  return {
    data: snapshot?.data ?? null,
    isStale: snapshot !== null && snapshot.key !== key,
    error,
    retry: () => {
      setError(null);
      setReloadKey((value) => value + 1);
    },
  };
}
