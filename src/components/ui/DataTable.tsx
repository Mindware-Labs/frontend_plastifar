import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";
import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { useInListPanel } from "./listPanelContext";

/**
 * Tabla de listado del panel.
 *
 * La tabla vive en un PANEL: superficie blanca con radio y sombra, flotando
 * sobre el lienzo tintado. Antes no llevaba tarjeta —«la tabla es la pagina»—
 * y eso era correcto mientras el fondo era blanco: no habia nada que separar.
 * Sobre el lienzo si lo hay, y el panel es lo que hace que la tabla se lea
 * como una superficie de trabajo y no como texto suelto sobre gris.
 *
 * Cambiarlo aca alcanza a las doce pantallas de listado a la vez, que es la
 * razon por la que este primitivo existe.
 */
export function DataTable({ children }: { children: ReactNode }) {
  const inPanel = useInListPanel();
  const table = <table className="w-full border-collapse text-left">{children}</table>;

  // Dentro de un `ListPanel` la superficie ya la puso el panel, junto con su
  // scroll horizontal. Volver a dibujarla aca serian dos bordes, dos sombras y
  // dos radios peleando por el mismo canto.
  if (inPanel) return table;

  // Suelta —una tabla embebida en una pantalla de detalle— se pone su propia
  // superficie: sobre el lienzo tintado, sin tarjeta, quedaria texto flotando.
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-white shadow-card">
      {table}
    </div>
  );
}

export function HeadRow({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-line [&>th:first-child]:pl-4 [&>th:last-child]:pr-4">
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
      className={`px-3.5 py-2.5 font-heading text-[10.5px] font-medium uppercase tracking-[0.06em]
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
          className="group inline-flex items-center gap-1.5 rounded-edge uppercase tracking-[0.06em]
            text-inherit outline-none transition-colors hover:text-ink
            focus-visible:ring-3 focus-visible:ring-brand-red/25"
        >
          {children}
          {sort.dir === null ? (
            <ChevronsUpDown className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
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

interface RowProps extends HTMLAttributes<HTMLTableRowElement> {
  /** Atenuada mientras una accion sobre ella esta en curso. */
  busy?: boolean;
  /** Para lo puntual que el filete comun no resuelve, p.ej. `group` cuando la
   *  fila revela sus acciones solo al pasar el mouse. */
  className?: string;
  children: ReactNode;
}

export function Row({ busy = false, className = "", children, ...props }: RowProps) {
  return (
    <tr
      className={`border-b border-line-soft transition-colors last:border-0 hover:bg-fill
        [&>td:first-child]:pl-4 [&>td:last-child]:pr-4 ${busy ? "opacity-50" : ""} ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
}

export function Td({ className = "", ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`px-3.5 py-2.5 ${className}`} {...props} />;
}
