import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";
import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { useInListPanel } from "./listPanelContext";

/**
 * Tabla de datos con tipografia tabular y alineacion estructurada.
 *
 * ------------------------------------------------------------------
 * LA SUPERFICIE SOLO SE DIBUJA UNA VEZ
 * ------------------------------------------------------------------
 * Dentro de un `ListPanel` la tarjeta ya la puso el panel, junto con su scroll
 * horizontal. Volver a dibujarla aqui serian dos bordes, dos sombras y dos
 * radios peleando por el mismo canto. Suelta —una tabla embebida en una
 * pantalla de detalle— si se pone la suya, porque sobre el lienzo tintado
 * quedaria texto flotando.
 *
 * Usa `rounded-card` y `shadow-card`, los mismos del panel, para que una tabla
 * suelta y una enmarcada no se lean como dos componentes distintos.
 */
export function DataTable({ fixed = false, children }: { fixed?: boolean; children: ReactNode }) {
  const inPanel = useInListPanel();
  const table = (
    <table className={`w-full border-collapse text-left ${fixed ? "table-fixed" : ""}`}>
      {children}
    </table>
  );

  if (inPanel) return fixed ? table : <div className="overflow-x-auto">{table}</div>;

  return (
    <div
      className={`rounded-card border border-line bg-white shadow-card ${
        fixed ? "overflow-hidden" : "overflow-x-auto"
      }`}
    >
      {table}
    </div>
  );
}

export function HeadRow({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-line bg-white">
      {children}
    </tr>
  );
}

export type SortDir = "asc" | "desc";

interface ThProps extends ThHTMLAttributes<HTMLTableCellElement> {
  /** Presente = columna ordenable. `dir` es null cuando no es la columna activa. */
  sort?: { dir: SortDir | null; onToggle: () => void };
  children: ReactNode;
}

export function Th({ sort, className = "", children, ...props }: ThProps) {
  return (
    <th
      aria-sort={sort?.dir === "asc" ? "ascending" : sort?.dir === "desc" ? "descending" : undefined}
      className={`h-9 px-3 font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-faint select-none whitespace-nowrap ${
        sort?.dir ? "text-ink" : ""
      } ${className}`}
      {...props}
    >
      {sort ? (
        <button
          type="button"
          onClick={sort.onToggle}
          className="group inline-flex items-center gap-1.5 rounded transition-colors hover:text-ink cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand-red/25"
        >
          <span>{children}</span>
          {sort.dir === null ? (
            <ChevronsUpDown className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 text-faint" />
          ) : sort.dir === "asc" ? (
            <ChevronUp className="h-3 w-3 text-ink" />
          ) : (
            <ChevronDown className="h-3 w-3 text-ink" />
          )}
        </button>
      ) : (
        children
      )}
    </th>
  );
}

interface RowProps extends HTMLAttributes<HTMLTableRowElement> {
  /** Atenuada mientras una acción sobre ella está en curso. */
  busy?: boolean;
  children: ReactNode;
}

export function Row({ busy = false, className = "", children, ...props }: RowProps) {
  return (
    <tr
      className={`border-b border-line-soft transition-colors duration-150 last:border-0 hover:bg-fill/80
        data-[checked=true]:bg-brand-red/[0.035] hover:data-[checked=true]:bg-brand-red/[0.06] ${busy ? "opacity-50" : ""} ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
}

export function Td({ className = "", ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`px-3 py-2 text-[12.5px] align-middle ${className}`} {...props} />;
}
