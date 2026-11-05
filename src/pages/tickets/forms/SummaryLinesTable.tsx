import type { ReactNode } from "react";

interface SummaryLinesTableProps {
  title: ReactNode;
  /** Celdas `th` de la cabecera. */
  head: ReactNode;
  /** Filas `tr` del cuerpo. */
  children: ReactNode;
}

/** Tabla compacta de lineas de producto en el resumen de un formulario del ticket. */
export function SummaryLinesTable({ title, head, children }: SummaryLinesTableProps) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-zinc-800 mb-2">{title}</h4>
      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-50 text-[10.5px] uppercase font-bold text-zinc-500 border-b border-zinc-200">
            <tr>{head}</tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 text-zinc-700">{children}</tbody>
        </table>
      </div>
    </div>
  );
}
