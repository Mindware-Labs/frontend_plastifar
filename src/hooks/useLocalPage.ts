import { useState } from "react";

/**
 * Paginacion de la vista sobre una lista ya cargada.
 *
 * Es andamiaje, no el destino: el plan exige que todo listado se corte en la
 * base de datos (seccion 4.1), y esto existe solo mientras los modulos de
 * Clientes, Configuracion y Calidad corren sobre datos de prueba. Al llegar el
 * API se sustituye por usePagedList, que consulta al servidor — por eso este
 * hook devuelve exactamente los mismos campos que el componente Pagination
 * necesita, para que el cambio sea el import y nada mas.
 *
 * `criteriaKey` es todo lo que no es la pagina: cambiar cualquier criterio
 * vuelve a la primera, que es lo que el plan pide en la seccion 4.4.
 */
export function useLocalPage<T>(rows: T[], criteriaKey: string) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [lastCriteria, setLastCriteria] = useState(criteriaKey);
  if (criteriaKey !== lastCriteria) {
    setLastCriteria(criteriaKey);
    setPage(1);
  }

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  // Borrar la ultima fila de la ultima pagina la deja fuera de rango.
  const currentPage = Math.min(page, totalPages);
  const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function changePageSize(size: number) {
    setPageSize(size);
    setPage(1);
  }

  return { page: currentPage, pageSize, total, totalPages, pageRows, setPage, changePageSize };
}
