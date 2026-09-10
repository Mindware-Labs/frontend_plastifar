import { ChevronLeft, ChevronRight } from "lucide-react";
import { Select } from "./Select";

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

  const stepClass = `flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white
    text-zinc-600 shadow-2xs transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900
    active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-zinc-200 disabled:hover:bg-white`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3.5 text-[12.5px] text-zinc-500">
      <p>
        Mostrando <span className="font-medium text-zinc-800">{from}</span>–
        <span className="font-medium text-zinc-800">{to}</span> de{" "}
        <span className="font-medium text-zinc-800">{total}</span> {noun}
      </p>

      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-zinc-600">
          Por página
          <Select
            size="sm"
            className="w-[66px]"
            aria-label="Filas por página"
            value={String(pageSize)}
            onChange={(next) => onPageSizeChange(Number(next))}
            options={pageSizes.map((size) => ({ value: String(size), label: String(size) }))}
          />
        </span>

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
              className={`h-8 min-w-8 rounded-lg px-2 text-[12.5px] font-medium transition-all active:scale-[0.97] ${
                number === page
                  ? "bg-brand-red text-white shadow-2xs font-semibold"
                  : "border border-zinc-200 bg-white text-zinc-700 shadow-2xs hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
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
