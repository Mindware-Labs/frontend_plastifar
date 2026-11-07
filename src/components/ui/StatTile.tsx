import type { ReactNode } from "react";

interface StatTileProps {
  label: string;
  /** Icono o punto de estado a la derecha del rotulo. */
  indicator?: ReactNode;
  /** El valor, con su propio contenedor (cada ficha lo maqueta distinto). */
  children: ReactNode;
  /** Clases extra para la superficie (p. ej. estado hover cuando va dentro de un enlace). */
  className?: string;
}

/** Metrica compacta de la fila superior de una ficha de detalle. */
export function StatTile({ label, indicator, children, className = "" }: StatTileProps) {
  return (
    <div className={`rounded-card border border-line bg-white p-3 shadow-2xs ${className}`}>
      <div className="flex items-center justify-between text-faint">
        <span className="text-[11px] font-medium uppercase tracking-wider text-faint">{label}</span>
        {indicator}
      </div>
      {children}
    </div>
  );
}
