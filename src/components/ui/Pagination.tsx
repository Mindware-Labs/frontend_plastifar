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
  /**
   * Singular del mismo elemento. Sin esto el pie decia "1 colaboradores" en
   * cuanto la lista quedaba con un solo resultado —justo el caso al que lleva
   * cualquier busqueda que acierta—. Si no se pasa, se usa el plural.
   */
  nounSingular?: string;
}

const pageSizes = [10, 25, 50];

/**
 * Los tamaños ofrecidos, incluyendo SIEMPRE el que está en uso.
 *
 * El desplegable recibía `value={pageSize}` contra una lista fija, así que
 * cualquier pantalla que arrancara con un tamaño fuera de esa lista —tickets
 * abre en 8— pintaba el control vacío: ni el valor actual ni un aviso, sólo un
 * hueco. Y quien lo tocara no podría volver a su tamaño de partida, porque no
 * estaba entre las opciones.
 *
 * Se inserta ordenado para que la lista siga leyéndose de menor a mayor.
 */
function opcionesDeTamano(actual: number): number[] {
  return pageSizes.includes(actual) ? pageSizes : [...pageSizes, actual].sort((a, b) => a - b);
}

/** Cantidad fija de casillas del grupo central cuando hay mas paginas de las que caben. */
const SLOTS = 7;

type Slot = number | "gap-start" | "gap-end";

/**
 * Casillas del grupo central: SIEMPRE las mismas siete cuando hay paginas de
 * sobra, con la primera y la ultima ancladas y puntos suspensivos donde se
 * salta. Con un numero de casillas constante el grupo no cambia de ancho al
 * paginar —los botones no "bailan" bajo el cursor— y su centro queda fijo.
 *
 *   1 2 3 4 5 … 20   |   1 … 8 9 10 … 20   |   1 … 16 17 18 19 20
 */
function pageSlots(page: number, totalPages: number): Slot[] {
  if (totalPages <= SLOTS) return Array.from({ length: totalPages }, (_, i) => i + 1);

  if (page <= 4) return [1, 2, 3, 4, 5, "gap-end", totalPages];
  if (page >= totalPages - 3) {
    return [1, "gap-start", ...Array.from({ length: 5 }, (_, i) => totalPages - 4 + i)];
  }
  return [1, "gap-start", page - 1, page, page + 1, "gap-end", totalPages];
}

/**
 * Pie de tabla compacto, en una sola fila de 28px: a la izquierda el total
 * (lo que importa) con el rango como dato secundario; a la derecha, pegados,
 * el tamano de pagina y la navegacion.
 *
 * La navegacion es UN solo control segmentado —anterior, paginas, siguiente
 * dentro de un unico recuadro— en vez de una hilera de cajas sueltas: ocupa
 * menos, se lee como un bloque y solo la pagina activa lleva el rojo de marca.
 * Siempre hay siete casillas como maximo, asi el bloque no cambia de ancho al
 * paginar. El radio es el del sistema (`rounded-edge`).
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

  const cell = `flex h-7 min-w-7 shrink-0 cursor-pointer items-center justify-center px-1.5
    text-[12px] font-medium tabular-nums outline-none transition-colors
    focus-visible:relative focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-brand-red/30`;

  const arrow = `${cell} text-subtle hover:bg-canvas hover:text-ink
    disabled:cursor-not-allowed disabled:text-line-strong disabled:hover:bg-transparent`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2 text-[12px] text-subtle">
      <p
        className="flex items-center gap-2.5 tabular-nums"
        title={`Mostrando ${from} a ${to} de ${total}`}
      >
        <span>
          <span className="font-semibold text-ink">{total}</span>{" "}
          {total === 1 ? (nounSingular ?? noun) : noun}
        </span>
        {/* Posicion de la pagina dentro del total: el rango sin escribir numeros. */}
        <span
          aria-hidden="true"
          className="relative hidden h-1 w-14 overflow-hidden rounded-pill bg-fill sm:block"
        >
          <span
            className="absolute inset-y-0 rounded-pill bg-brand-red"
            style={{
              left: `${((from - 1) / total) * 100}%`,
              width: `${Math.max(((to - from + 1) / total) * 100, 8)}%`,
            }}
          />
        </span>
        <span className="sr-only">
          Mostrando {from} a {to} de {total}
        </span>
      </p>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5">
          Filas
          <Select
            size="xs"
            className="w-[50px]"
            buttonClassName="!gap-1 !px-1.5"
            matchTriggerWidth
            aria-label="Filas por página"
            value={String(pageSize)}
            onChange={(next) => onPageSizeChange(Number(next))}
            options={opcionesDeTamano(pageSize).map((size) => ({
              value: String(size),
              label: String(size),
            }))}
          />
        </label>
        <nav
          aria-label="Paginación"
          className="flex items-center divide-x divide-line-strong overflow-hidden rounded-edge border border-line-strong bg-white"
        >
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Página anterior"
            title="Página anterior"
            className={arrow}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {pageSlots(page, totalPages).map((slot) =>
            typeof slot === "number" ? (
              <button
                key={slot}
                type="button"
                onClick={() => onPageChange(slot)}
                aria-label={`Página ${slot}`}
                aria-current={slot === page ? "page" : undefined}
                className={`${cell} ${
                  slot === page
                    ? "bg-brand-red text-white"
                    : "text-brand-gray hover:bg-canvas hover:text-ink"
                }`}
              >
                {slot}
              </button>
            ) : (
              <span
                key={slot}
                aria-hidden="true"
                className="flex h-7 w-6 select-none items-center justify-center text-faint"
              >
                …
              </span>
            ),
          )}

          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Página siguiente"
            title="Página siguiente"
            className={arrow}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      </div>
    </div>
  );
}
