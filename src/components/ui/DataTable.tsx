import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";
import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

/**
 * Tabla de listado del panel. Sin tarjeta: la tabla es la pagina y solo lleva
 * filetes horizontales. La primera y la ultima celda pegan al borde del modulo.
 */
/**
 * `fixed` reparte el ancho entre las columnas en vez de dejar que lo pida el contenido:
 * la tabla cabe siempre y son las celdas las que recortan. Exige anchos en las cabeceras.
 */
export function DataTable({ fixed = false, children }: { fixed?: boolean; children: ReactNode }) {
  return (
    <div className={`rounded-xl border border-zinc-200/80 bg-white shadow-2xs overflow-hidden ${fixed ? "" : "overflow-x-auto"}`}>
      <table className={`w-full border-collapse text-left ${fixed ? "table-fixed" : ""}`}>
        {children}
      </table>
    </div>
  );
}

export function HeadRow({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-zinc-200/80 bg-zinc-50/40">
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
      className={`px-3 py-2 text-[12.5px] font-medium text-zinc-500 border-r border-zinc-100 last:border-r-0 ${className}`}
      {...props}
    >
      {sort ? (
        <button
          type="button"
          onClick={sort.onToggle}
          className="group inline-flex items-center gap-1.5 transition-colors hover:text-zinc-900 cursor-pointer"
        >
          {children}
          {sort.dir === null ? (
            <ChevronsUpDown className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 text-zinc-400" />
          ) : sort.dir === "asc" ? (
            <ChevronUp className="h-3 w-3 text-zinc-900" />
          ) : (
            <ChevronDown className="h-3 w-3 text-zinc-900" />
          )}
        </button>
      ) : (
        children
      )}
    </th>
  );
}

interface RowProps extends HTMLAttributes<HTMLTableRowElement> {
  /** Atenuada mientras una accion sobre ella esta en curso. */
  busy?: boolean;
  children: ReactNode;
}

export function Row({ busy = false, className = "", children, ...props }: RowProps) {
  return (
    <tr
      className={`border-b border-zinc-100 transition-colors last:border-0 hover:bg-zinc-50/50
        data-[checked=true]:bg-brand-red/[0.04] hover:data-[checked=true]:bg-brand-red/[0.07] ${busy ? "opacity-50" : ""} ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
}

export function Td({ className = "", ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`px-3 py-2 text-[13px] border-r border-zinc-100/80 last:border-r-0 ${className}`} {...props} />;
}
