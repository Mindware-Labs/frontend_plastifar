import { ArrowLeft, ArrowRight } from "lucide-react";
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
  /**
   * Singular del mismo elemento. Sin esto el pie decia "1 colaboradores" en
   * cuanto la lista quedaba con un solo resultado —justo el caso al que lleva
   * cualquier busqueda que acierta—. Si no se pasa, se usa el plural.
   */
  nounSingular?: string;
}

const pageSizes = [10, 25, 50];

/** Ventana de 5 paginas alrededor de la actual, sin salirse del rango. */
function pageWindow(page: number, totalPages: number) {
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

/**
 * Pie de tabla: rango a la izquierda, tamano de pagina y ventana a la derecha.
 *
 * Las flechas son FLECHAS, no galones dentro de una caja. Antes los tres tipos
 * de control del pie —ir atras, ir a una pagina, cambiar el tamano— llevaban el
 * mismo recuadro de 1px, asi que "anterior" pesaba visualmente igual que "3" y
 * habia que leer el icono para distinguirlos. Con la flecha desnuda la
 * direccion se lee por su forma y las unicas cajas que quedan son las paginas,
 * que es lo unico enumerable del grupo.
 *
 * Cada pagina es un cuadrado de 32px, no una pastilla que crece con el numero:
 * un grupo de cajas del mismo tamano se cuenta de un vistazo. Solo se ensancha
 * a partir de tres digitos, donde el numero manda sobre la geometria.
 *
 * El radio sigue siendo el unico del sistema (2px, `rounded-edge`): el trazo
 * industrial del logotipo. La referencia venia mas redondeada, pero un segundo
 * radio en un control que aparece en las catorce tablas del panel seria la
 * grieta por donde se va la uniformidad.
 */
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

  const arrowClass = `flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-edge
    text-subtle outline-none transition-colors
    hover:text-ink focus-visible:ring-3 focus-visible:ring-brand-red/25
    disabled:cursor-not-allowed disabled:text-line-strong disabled:hover:text-line-strong`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-[12.5px] text-subtle">
      <p>
        Mostrando <span className="font-medium text-ink">{from}</span>–
        <span className="font-medium text-ink">{to}</span> de{" "}
        <span className="font-medium text-ink">{total}</span>{" "}
        {total === 1 ? (nounSingular ?? noun) : noun}
      </p>

      <div className="flex items-center gap-5">
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

        <nav aria-label="Paginación" className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Página anterior"
            className={arrowClass}
          >
            <ArrowLeft className="h-[18px] w-[18px]" />
          </button>

          <div className="flex items-center gap-1.5">
            {pageWindow(page, totalPages).map((number) => (
              <button
                key={number}
                type="button"
                onClick={() => onPageChange(number)}
                aria-label={`Página ${number}`}
                aria-current={number === page ? "page" : undefined}
                className={`flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-edge
                  border px-1.5 text-[12.5px] font-medium tabular-nums outline-none
                  transition-colors focus-visible:ring-3 focus-visible:ring-brand-red/25 ${
                    number === page
                      ? "border-brand-red bg-brand-red text-white"
                      : "border-line-strong text-brand-gray hover:border-hairline-hover hover:text-ink"
                  }`}
              >
                {number}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Página siguiente"
            className={arrowClass}
          >
            <ArrowRight className="h-[18px] w-[18px]" />
          </button>
        </nav>
      </div>
    </div>
  );
}
