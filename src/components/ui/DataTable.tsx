import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";
import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

/**
 * Tabla de listado del panel. Sin tarjeta: la tabla es la pagina y solo lleva
 * filetes horizontales. La primera y la ultima celda pegan al borde del modulo.
 */
export function DataTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  );
}

export function HeadRow({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-line [&>th:first-child]:pl-0 [&>th:last-child]:pr-0">
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
      className={`px-3.5 py-2.5 font-heading text-[10px] font-semibold uppercase tracking-[0.08em]
        text-faint ${className}`}
      {...props}
    >
      {sort ? (
        <button
          type="button"
          onClick={sort.onToggle}
          // Repite versalita y color: un <button> reinicia `text-transform` y el
          // color por las reglas de control de formulario, asi que sin esto la
          // cabecera ordenable salia en caja mixta y mas oscura que sus vecinas.
          className="inline-flex items-center gap-1.5 uppercase tracking-[0.08em] text-inherit
            transition-colors hover:text-ink"
        >
          {children}
          {sort.dir === null ? (
            <ChevronsUpDown className="h-3 w-3" />
          ) : sort.dir === "asc" ? (
            <ChevronUp className="h-3 w-3 text-brand-red" />
          ) : (
            <ChevronDown className="h-3 w-3 text-brand-red" />
          )}
        </button>
      ) : (
        children
      )}
    </th>
  );
}

interface RowProps {
  /** Atenuada mientras una accion sobre ella esta en curso. */
  busy?: boolean;
  /** Para lo puntual que el filete comun no resuelve, p.ej. `group` cuando la
   *  fila revela sus acciones solo al pasar el mouse. */
  className?: string;
  children: ReactNode;
}

export function Row({ busy = false, className = "", children }: RowProps) {
  return (
    <tr
      className={`border-b border-line-soft transition-colors last:border-0 hover:bg-canvas
        [&>td:first-child]:pl-0 [&>td:last-child]:pr-0 ${busy ? "opacity-50" : ""} ${className}`}
    >
      {children}
    </tr>
  );
}

export function Td({ className = "", ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`px-3.5 py-2.5 ${className}`} {...props} />;
}
