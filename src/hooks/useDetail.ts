import { useEffect, useRef, useState } from "react";
import { ApiError } from "../api/client";

interface Messages {
  /** 404: no existe o quien mira no tiene acceso; el servidor no distingue, y la pantalla tampoco. */
  notFound: string;
  /** Cualquier otro fallo de carga. */
  failed: string;
}

/**
 * La ficha de un registro por id: la carga, la descarta si llega tarde (otro
 * id o la pantalla ya se fue) y la reinicia al cambiar de id.
 *
 * `reload` vuelve a pedirla sin vaciar lo que se ve: sirve para reintentar
 * tras un error y para refrescar tras un 409. Limpia el error antes, porque si
 * no la pantalla de error se queda aunque la recarga funcione.
 */
export function useDetail<T>(id: number, fetch: (id: number) => Promise<T>, messages: Messages) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const [lastId, setLastId] = useState(id);
  if (id !== lastId) {
    setLastId(id);
    setData(null);
    setError(null);
  }

  // La funcion y los textos se leen por ref: el efecto depende solo del id y del intento.
  const fetchRef = useRef(fetch);
  const messagesRef = useRef(messages);
  useEffect(() => {
    fetchRef.current = fetch;
    messagesRef.current = messages;
  });

  useEffect(() => {
    let cancelled = false;
    fetchRef
      .current(id)
      .then((value) => {
        if (!cancelled) setData(value);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError && err.status === 404 ? messagesRef.current.notFound : messagesRef.current.failed);
      });
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  function reload() {
    setError(null);
    setAttempt((value) => value + 1);
  }

  return { data, setData, error, reload };
}
