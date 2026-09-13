import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";
import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

/** Tabla de datos con tipografía tabular y alineación estructurada. */
export function DataTable({ fixed = false, children }: { fixed?: boolean; children: ReactNode }) {
  return (
    <div className={`rounded-lg border border-zinc-200 bg-white shadow-2xs overflow-hidden ${fixed ? "" : "overflow-x-auto"}`}>
      <table className={`w-full border-collapse text-left ${fixed ? "table-fixed" : ""}`}>
        {children}
      </table>
    </div>
  );
}

export function HeadRow({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-zinc-200 bg-white">
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
      className={`h-9 px-3 font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400 select-none whitespace-nowrap ${
        sort?.dir ? "text-zinc-900" : ""
      } ${className}`}
      {...props}
    >
      {sort ? (
        <button
          type="button"
          onClick={sort.onToggle}
          className="group inline-flex items-center gap-1.5 rounded transition-colors hover:text-zinc-900 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand-red/25"
        >
          <span>{children}</span>
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
  /** Atenuada mientras una acción sobre ella está en curso. */
  busy?: boolean;
  children: ReactNode;
}

export function Row({ busy = false, className = "", children, ...props }: RowProps) {
  return (
    <tr
      className={`border-b border-zinc-100 transition-colors duration-150 last:border-0 hover:bg-zinc-50/80
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
