import type { ReactNode } from "react";
import { staleClass } from "../../lib/listState";
import { TableSkeleton } from "./Skeleton";

interface ListBodyProps {
  /** La pagina cargada; null mientras llega la primera respuesta. */
  data: { items: readonly unknown[] } | null;
  error: string | null;
  isStale: boolean;
  /** Forma del esqueleto: una fila por registro esperado. */
  skeletonRows: number;
  skeletonColumns: number;
  /** Frase del vacio. */
  empty: ReactNode;
  /** Entrada animada de los resultados (`plf-results-in`). */
  animateIn?: boolean;
  children: ReactNode;
}

/**
 * Cuerpo de un listado paginado: esqueleto, vacio o la tabla atenuada mientras
 * se relee. Con error y sin datos no pinta nada: el aviso va fuera del panel.
 */
export function ListBody({
  data,
  error,
  isStale,
  skeletonRows,
  skeletonColumns,
  empty,
  animateIn = false,
  children,
}: ListBodyProps) {
  if (data === null) {
    return error === null ? <TableSkeleton rows={skeletonRows} columns={skeletonColumns} /> : null;
  }

  if (data.items.length === 0) {
    return <p className="py-14 text-center text-[13.5px] text-faint">{empty}</p>;
  }

  return (
    <div className={animateIn ? `plf-results-in ${staleClass(isStale)}` : staleClass(isStale)}>{children}</div>
  );
}
