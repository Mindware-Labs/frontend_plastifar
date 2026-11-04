import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { ApiError } from "../../api/client";

interface Options<T> {
  /**
   * Nombre del recurso en la cache. La clave lleva ademas `"print"`: estas
   * vistas suelen transformar la respuesta (`.claim`, `.discrepancy`) y no
   * deben compartir entrada con la ficha, que guarda la respuesta entera.
   * Opcional: sin el, la clave sale de `failed`, distinto en cada vista.
   */
  resource?: string;
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
  const query = useQuery({
    queryKey: [options.resource ?? options.failed, id, "print"],
    queryFn: () => fetch(id),
  });

  // Solo la lectura de este montaje: se imprime lo que hay en el servidor ahora.
  const data = query.isFetchedAfterMount ? (query.data ?? null) : null;
  const error = query.isError
    ? query.error instanceof ApiError
      ? query.error.message
      : options.failed
    : null;

  const titleRef = useRef(options.documentTitle);
  useEffect(() => {
    titleRef.current = options.documentTitle;
  });

  useEffect(() => {
    if (data !== null) document.title = titleRef.current(data);
  }, [data]);

  // El diálogo se abre una vez por registro, no con cada relectura en segundo plano.
  const printedFor = useRef<number | null>(null);
  useEffect(() => {
    if (data === null || printedFor.current === id) return;
    if (window.location.search.includes("mode=print")) {
      // Se marca al abrir el dialogo, no antes: si el efecto se limpia antes de
      // tiempo (StrictMode, relectura), el siguiente lo vuelve a programar.
      const timer = window.setTimeout(() => {
        printedFor.current = id;
        window.print();
      }, PRINT_DELAY_MS);
      return () => window.clearTimeout(timer);
    }
  }, [data, id]);

  return { data, error };
}
