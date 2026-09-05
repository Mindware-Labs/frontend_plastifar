// Ciclo de carga compartido por los ocho catalogos de Configuracion.
//
// Vive aparte de catalogSection.tsx porque mezclar hooks y componentes en un
// mismo modulo rompe el refresco rapido de Vite.

import { useCallback, useEffect, useRef, useState } from "react";

export type SectionStatus = "loading" | "ready" | "error";

/**
 * Ciclo de carga de una seccion.
 *
 * Distingue la primera carga del refresco porque son dos cosas distintas en
 * pantalla: la primera muestra el spinner, el refresco solo atenua la tabla al
 * 60 % (DESIGN.md, «Stale data»). Un fallo de primera carga deja la seccion en
 * error con reintento, nunca en un spinner eterno.
 */
export function useSectionLoad(load: () => Promise<unknown>, errorMessage: string) {
  const [status, setStatus] = useState<SectionStatus>("loading");
  const [isRefetching, setIsRefetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El efecto de arranque no debe depender de `load`: la seccion la vuelve a
  // crear en cada render y el listado se recargaria en bucle.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  // `status` ya arranca en "loading", asi que la carga inicial no necesita
  // fijarlo: hacerlo era un setState sincrono dentro del efecto de montaje, un
  // render extra antes de la primera pintura. Quien reintenta si lo fija, pero
  // desde el manejador del boton, que es donde ese cambio pertenece.
  const run = useCallback(
    async (mode: "first" | "refetch") => {
      if (mode === "refetch") setIsRefetching(true);

      try {
        await loadRef.current();
        setError(null);
        setStatus("ready");
      } catch {
        setError(errorMessage);
        // Un refresco fallido conserva lo que ya se ve: tirar la tabla porque
        // una relectura no llego seria perder datos buenos.
        if (mode === "first") setStatus("error");
      } finally {
        setIsRefetching(false);
      }
    },
    [errorMessage],
  );

  useEffect(() => {
    // `run("first")` no fija nada de forma sincrona: la rama que lo hacia es
    // la de "refetch", y
    // todo lo demas ocurre ya resuelta la promesa. El linter no puede seguir
    // esa distincion a traves de una funcion async, pero el arranque de una
    // seccion es sincronizacion con algo externo, que es justo para lo que el
    // efecto existe.
    // eslint-disable-next-line react/set-state-in-effect
    void run("first");
  }, [run]);

  const reload = useCallback(() => run("refetch"), [run]);
  const retry = useCallback(() => {
    setStatus("loading");
    return run("first");
  }, [run]);

  return { status, isRefetching, error, setError, reload, retry };
}

/** Atenuacion del 60 % mientras hay una relectura en vuelo. */
export function staleClass(isRefetching: boolean): string {
  return `transition-opacity ${isRefetching ? "opacity-60" : ""}`;
}

/**
 * Relee el registro justo antes de escribirlo.
 *
 * El API no expone activar/desactivar por separado: hay que reenviar el registro
 * entero con una bandera cambiada. Reenviar el que se capturo al abrir el
 * dialogo revierte en silencio cualquier cambio hecho entretanto, asi que se
 * vuelve a leer del listado. La ventana entre esta lectura y el PUT sigue
 * abierta: se cierra el dia que exista un PATCH de estado.
 */
export async function freshCopy<T extends { id: number }>(
  list: () => Promise<{ items: T[] }>,
  record: T,
): Promise<T> {
  try {
    const { items } = await list();
    return items.find((item) => item.id === record.id) ?? record;
  } catch {
    // Si la relectura falla se escribe lo que se tenia: peor seria dejar al
    // administrador sin poder desactivar nada porque el listado no respondio.
    return record;
  }
}
