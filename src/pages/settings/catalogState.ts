// Piezas de estado compartidas por los catalogos de Configuracion.
//
// Viven aparte de catalogSection.tsx porque mezclar hooks y componentes en un
// mismo modulo rompe el refresco rapido de Vite.

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Catalogo de apoyo de una seccion: departamentos, politicas, los años que
 * tienen feriados. No es el listado que se pagina --ese lo lleva usePagedList
 * contra el servidor-- sino lo que la tabla necesita para nombrar lo que
 * muestra y lo que el dialogo necesita para ofrecer opciones.
 *
 * Un fallo aqui no vacia la pantalla: se expone en `failed` para que la seccion
 * lo diga con su reintento en vez de pintar guiones como si no hubiera datos.
 */
export function useReferenceData<T>(
  /** Clave en la cache de TanStack Query. Si `load` es un catalogo, la del catalogo. */
  queryKey: readonly unknown[],
  load: () => Promise<T>,
  initial: T,
) {
  // La funcion se lee por ref: la seccion la vuelve a crear en cada render y la
  // consulta no debe cambiar por eso.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const query = useQuery({
    queryKey: ["reference", ...queryKey],
    queryFn: () => loadRef.current(),
  });

  // El valor inicial se fija una vez: quien llama suele pasar un `[]` literal
  // nuevo en cada render, y devolverlo tal cual reejecutaba sus efectos.
  const [fallback] = useState(initial);

  const { refetch } = query;
  const reload = useCallback(() => {
    void refetch();
  }, [refetch]);

  return { data: query.data ?? fallback, failed: query.isError, reload };
}

/**
 * Relee el registro justo antes de escribirlo.
 *
 * El API no expone activar/desactivar por separado: hay que reenviar el
 * registro entero con una bandera cambiada, y reenviar el que se capturo al
 * pintar la fila revierte en silencio cualquier cambio hecho entretanto.
 *
 * La relectura va por identificador contra GET /{id}, no buscando en la pagina
 * cargada: con paginacion en servidor el registro casi nunca esta en memoria, y
 * la version anterior --que en ese caso escribia la copia vieja-- provocaba
 * justo el pisoton que existia para evitar. Si la relectura falla, el error
 * sube: el dialogo lo muestra y no se escribe nada.
 */
export function freshCopy<T extends { id: number }>(
  read: (id: number) => Promise<T>,
  record: T,
): Promise<T> {
  return read(record.id);
}
