import { Pagination } from "./Pagination";

interface ServerPaginationProps {
  /** La pagina cargada; sin datos no hay pie. Pagina y tamano son los de la respuesta. */
  data: { page: number; pageSize: number; total: number; totalPages: number } | null;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  noun: string;
  nounSingular?: string;
}

/**
 * Pie de un listado paginado que pinta la pagina y el tamano tal como los
 * devolvio el servidor, y que se muestra aun sin resultados.
 */
export function ServerPagination({ data, ...props }: ServerPaginationProps) {
  if (data === null) return null;
  return (
    <Pagination
      {...props}
      page={data.page}
      pageSize={data.pageSize}
      total={data.total}
      totalPages={data.totalPages}
    />
  );
}
