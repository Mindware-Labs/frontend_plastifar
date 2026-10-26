import { Pagination } from "./Pagination";

interface ListPaginationProps {
  /** La pagina cargada; sin datos o sin resultados no hay pie. */
  data: { total: number; totalPages: number } | null;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  noun: string;
  nounSingular?: string;
}

/** Pie de un listado paginado: la paginacion solo cuando hay algo que paginar. */
export function ListPagination({ data, ...props }: ListPaginationProps) {
  if (data === null || data.total === 0) return null;
  return <Pagination {...props} total={data.total} totalPages={data.totalPages} />;
}
