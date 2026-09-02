import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  /** Plural del elemento listado: "colaboradores", "roles"… */
  noun: string;
}

const pageSizes = [10, 25, 50];

/** Ventana de 5 paginas alrededor de la actual, sin salirse del rango. */
function pageWindow(page: number, totalPages: number) {
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  noun,
}: PaginationProps) {
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const stepClass = `flex h-7 w-7 items-center justify-center rounded-edge border border-line-strong
    text-muted transition-colors hover:bg-fill hover:text-ink
    disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-[12.5px] text-muted">
      <p>
        Mostrando <span className="font-medium text-ink">{from}</span>–
        <span className="font-medium text-ink">{to}</span> de{" "}
        <span className="font-medium text-ink">{total}</span> {noun}
      </p>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2">
          Por página
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            aria-label="Filas por página"
            className="h-7 rounded-edge border border-line-strong bg-white px-2 text-[12.5px]
              font-medium text-brand-gray outline-none transition-colors
              hover:border-zinc-400 focus:border-brand-red"
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Página anterior"
            className={stepClass}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {pageWindow(page, totalPages).map((number) => (
            <button
              key={number}
              type="button"
              onClick={() => onPageChange(number)}
              aria-current={number === page ? "page" : undefined}
              className={`h-7 min-w-7 rounded-edge px-2 text-[12.5px] font-medium transition-colors ${
                number === page
                  ? "bg-brand-red text-white"
                  : "border border-line-strong text-brand-gray hover:bg-fill hover:text-ink"
              }`}
            >
              {number}
            </button>
          ))}

          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Página siguiente"
            className={stepClass}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
