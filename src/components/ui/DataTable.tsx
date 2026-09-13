import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";
import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "../../lib/utils";
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
      /* `transition-colors` no alcanza a `opacity`, asi que la fila que espera al
         servidor se apagaba de golpe: el salto a medio tono se lee como un
         parpadeo de error, no como «esto esta en marcha». Con la opacidad
         incluida, atenuarse ES la señal de que la accion salio. */
      className={`border-b border-line-soft transition-[background-color,opacity] duration-150
        last:border-0 hover:bg-fill
        [&>td:first-child]:pl-4 [&>td:last-child]:pr-4 ${busy ? "opacity-50" : ""} ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
}

/**
 * Una celda.
 *
 * Declara su tamano de texto —13 px, el de la casa— porque sin el, una celda
 * que se olvide de poner el suyo hereda los 16 px del `body`. Eso paso en la
 * tabla de tickets: asunto y cliente salian a 16 px contra 11,5 y 12,5 del
 * resto de la misma fila, y no era una decision de jerarquia sino un olvido.
 *
 * Se compone con `cn` y no interpolando la clase: con dos clases de la misma
 * especificidad gana la que el compilador emitio ultima, que es impredecible.
 * `tailwind-merge` resuelve el conflicto por familia, asi que una celda que
 * pida `text-[12.5px]` lo obtiene siempre.
 */
export function Td({ className = "", ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-3.5 py-2.5 text-[13px]", className)} {...props} />;
}
