import type { ReactNode } from "react";

interface StatTileProps {
  label: string;
  /** Icono o punto de estado a la derecha del rotulo. */
  indicator?: ReactNode;
  /** El valor, con su propio contenedor (cada ficha lo maqueta distinto). */
  children: ReactNode;
}

/** Metrica compacta de la fila superior de una ficha de detalle. */
export function StatTile({ label, indicator, children }: StatTileProps) {
  return (
    <div className="rounded-card border border-zinc-200/80 bg-white p-3 shadow-2xs">
      <div className="flex items-center justify-between text-zinc-400">
        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">{label}</span>
        {indicator}
      </div>
      {children}
    </div>
  );
}
