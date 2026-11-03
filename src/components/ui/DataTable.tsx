import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";
import {
  useLayoutEffect,
  useRef,
  type HTMLAttributes,
  type ReactNode,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from "react";
import { animateTablePageTurn, consumePageDirection } from "../../hooks/motion";
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
export function DataTable({
  fixed = false,
  bare = false,
  className = "",
  tableClassName = "",
  children,
}: {
  fixed?: boolean;
  bare?: boolean;
  className?: string;
  tableClassName?: string;
  children: ReactNode;
}) {
  const inPanel = useInListPanel();
  const tableRef = useRef<HTMLTableElement>(null);
  const prevRowKeysRef = useRef<string[] | null>(null);

  useLayoutEffect(() => {
    const table = tableRef.current;
    const tbody = table?.querySelector("tbody");
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll<HTMLTableRowElement>(":scope > tr"));
    const currentKeys = rows.map((row) => {
      const cells = row.cells;
      const c0 = cells[0]?.textContent?.trim() ?? "";
      const c1 = cells[1]?.textContent?.trim() ?? "";
      const c2 = cells[2]?.textContent?.trim() ?? "";
      return `${c0}|${c1}|${c2}`.slice(0, 64);
    });

    const prevKeys = prevRowKeysRef.current;
    prevRowKeysRef.current = currentKeys;

    if (prevKeys === null || rows.length === 0) return;

    const sameLength = prevKeys.length === currentKeys.length;
    const unchangedCount = currentKeys.filter((k, i) => prevKeys[i] === k).length;

    // Si las filas son las mismas (ej. marcar un checkbox o editar un estado en línea), no reanimamos la página.
    if (sameLength && unchangedCount >= Math.max(1, currentKeys.length - 1)) {
      return;
    }

    animateTablePageTurn(tbody, consumePageDirection());
  });

  const table = (
    <table
      ref={tableRef}
      className={`w-full border-collapse text-left ${fixed ? "table-fixed" : ""} ${tableClassName}`.trim()}
    >
      {children}
    </table>
  );

  if (inPanel || bare) {
    return fixed && !className ? (
      table
    ) : (
      <div className={`${fixed ? "" : "overflow-x-auto"} ${className}`.trim()}>{table}</div>
    );
  }

  return (
    <div
      className={`rounded-card border border-line bg-white shadow-card ${
        fixed ? "overflow-hidden" : "overflow-x-auto"
      } ${className}`.trim()}
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
