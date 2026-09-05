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
  /** Singular, cuando la derivacion no sirve: "análisis", "reporte"… */
  nounSingular?: string;
}

const pageSizes = [10, 25, 50];

/**
 * Singular por defecto del plural castellano: "roles" → "rol", "solicitudes" →
 * "solicitud", "clientes" → "cliente". Los casos que esta regla no cubre se
 * pasan a mano con `nounSingular`.
 */
function toSingular(plural: string) {
  if (plural.endsWith("ces")) return `${plural.slice(0, -3)}z`;
  // El plural en "-es" solo existe cuando el singular acaba en consonante, y en
  // castellano solo estas quedan a final de palabra. Sin esa comprobacion
  // "clientes" caeria a "client" en vez de a "cliente".
  if (plural.endsWith("es") && /[lrndjsx]$/.test(plural.slice(0, -2))) return plural.slice(0, -2);
  if (plural.endsWith("s")) return plural.slice(0, -1);
  return plural;
}

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
  nounSingular,
}: PaginationProps) {
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  // "1 solicitudes" delataba que la frase se arma con una plantilla y no la
  // escribio nadie. El nombre concuerda con el total, no con el rango.
  const label = total === 1 ? (nounSingular ?? toSingular(noun)) : noun;

  const stepClass = `flex h-7 w-7 items-center justify-center rounded-edge border border-line-strong
    text-muted transition-colors outline-none hover:bg-fill hover:text-ink
    focus-visible:ring-3 focus-visible:ring-brand-red/25
    disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent`;

  return (
    <nav
      aria-label="Paginación"
      className="flex flex-wrap items-center justify-between gap-3 py-3 text-[12.5px] text-muted"
    >
      <p>
        Mostrando <span className="font-medium tabular-nums text-ink">{from}</span>–
        <span className="font-medium tabular-nums text-ink">{to}</span> de{" "}
        <span className="font-medium tabular-nums text-ink">{total}</span> {label}
      </p>

      <div className="flex items-center gap-4">
        <span className="flex items-center gap-2">
          Por página
          <Select
            size="sm"
            className="w-[74px]"
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
              className={`h-7 min-w-7 rounded-edge px-2 text-[12.5px] font-medium tabular-nums
                transition-colors outline-none focus-visible:ring-3 focus-visible:ring-brand-red/25 ${
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
    </nav>
  );
}
