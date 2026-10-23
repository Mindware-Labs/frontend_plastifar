import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../api/client";

interface Options<T> {
  /** Título de la pestaña, que es el nombre que el navegador propone al guardar en PDF. */
  documentTitle: (data: T) => string;
  failed: string;
}

/** Pausa entre pintar el formulario y abrir el diálogo: sin ella, algunos navegadores imprimen la página a medias. */
const PRINT_DELAY_MS = 300;

/**
 * El registro de una vista de impresión: lo carga, nombra la pestaña y abre el
 * diálogo de impresión en cuanto está pintado. La ventana existe para eso.
 */
export function usePrintRecord<T>(id: number, fetch: (id: number) => Promise<T>, options: Options<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchRef = useRef(fetch);
  const optionsRef = useRef(options);
  useEffect(() => {
    fetchRef.current = fetch;
    optionsRef.current = options;
  });

  useEffect(() => {
    let cancelled = false;
    fetchRef
      .current(id)
      .then((value) => {
        if (cancelled) return;
        setData(value);
        document.title = optionsRef.current.documentTitle(value);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : optionsRef.current.failed);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (data === null) return;
    const timer = window.setTimeout(() => window.print(), PRINT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [data]);

  return { data, error };
}
