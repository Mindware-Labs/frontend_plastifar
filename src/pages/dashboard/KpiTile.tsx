import type { ComponentType } from "react";
import { DashboardCard } from "./DashboardCard";
import { INSET_RADIUS } from "./radii";

interface KpiTileProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "neutral" | "red" | "green" | "warn";
  /** La metrica que pide accion ahora se marca con un anillo de color en vez
   *  de ser un clon mas de la fila — la referencia usa el mismo recurso. */
  emphasis?: boolean;
  /** Una linea que explica de donde sale la cifra. */
  hint?: string;
}

// 8% es el tinte que DESIGN.md fija para toda insignia del panel; al 10% estas
// cuatro se salian del mismo valor que usan Badge y la matriz de permisos.
const toneIconBadge: Record<NonNullable<KpiTileProps["tone"]>, string> = {
  neutral: "bg-brand-gray/8 text-brand-gray",
  red: "bg-brand-red/8 text-brand-red",
  green: "bg-brand-green/8 text-brand-green",
  warn: "bg-warn/8 text-warn",
};

const toneRing: Record<NonNullable<KpiTileProps["tone"]>, string> = {
  neutral: "ring-brand-gray/30",
  red: "ring-brand-red/45",
  green: "ring-brand-green/40",
  warn: "ring-warn/45",
};

/**
 * Cifra de cabecera del resumen.
 *
 * Tenia ademas un delta contra el periodo anterior y una mini-barra de
 * tendencia. Las dos salian del mock del Dashboard, y ningun endpoint devuelve
 * hoy una comparacion contra el periodo previo ni la serie por punto: se
 * retiraron con el. Vuelven el dia que el servidor las calcule — inventarlas en
 * el cliente era justo lo que hacia de esta pantalla una maqueta.
 */
export function KpiTile({
  icon: Icon,
  label,
  value,
  tone = "neutral",
  emphasis = false,
  hint,
}: KpiTileProps) {
  return (
    <DashboardCard
      padding="sm"
      className={`flex h-full flex-col gap-4 ${emphasis ? `ring-2 ${toneRing[tone]}` : ""}`}
    >
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-subtle">
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center ${INSET_RADIUS} ${toneIconBadge[tone]}`}
        >
          <Icon className="h-3 w-3" />
        </span>
        <span className="truncate">{label}</span>
      </span>

      <div className="flex flex-1 flex-col justify-end gap-1">
        <span className="font-heading text-[28px] font-bold leading-none tracking-[-0.02em] text-ink">
          {value}
        </span>
        {hint && <span className="text-[11.5px] leading-tight text-faint">{hint}</span>}
      </div>
    </DashboardCard>
  );
}
