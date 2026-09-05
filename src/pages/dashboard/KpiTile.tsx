import { ArrowDown, ArrowUp, MoreHorizontal } from "lucide-react";
import type { ComponentType } from "react";
import { Bar, BarChart, ResponsiveContainer } from "recharts";
import { Tooltip } from "../../components/ui/Tooltip";
import type { Delta } from "../../types/dashboard";
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
  delta?: Delta;
  /** Ultimos puntos para la mini-barra de contexto; opcional. */
  sparkline?: number[];
}

// 8% es el tinte que DESIGN.md fija para toda insignia del panel; al 10% estas
// cuatro se salian del mismo valor que usan Badge y la matriz de permisos.
const toneIconBadge: Record<NonNullable<KpiTileProps["tone"]>, string> = {
  neutral: "bg-brand-gray/8 text-brand-gray",
  red: "bg-brand-red/8 text-brand-red",
  green: "bg-brand-green/8 text-brand-green",
  warn: "bg-warn/8 text-warn",
};

const toneBar: Record<NonNullable<KpiTileProps["tone"]>, string> = {
  neutral: "var(--color-brand-gray)",
  red: "var(--color-brand-red)",
  green: "var(--color-brand-green)",
  warn: "var(--color-warn)",
};

const toneRing: Record<NonNullable<KpiTileProps["tone"]>, string> = {
  neutral: "ring-brand-gray/30",
  red: "ring-brand-red/45",
  green: "ring-brand-green/40",
  warn: "ring-warn/45",
};

/**
 * KPI con delta contra el periodo anterior. El color del delta no sale del
 * signo: sale de si crecer es bueno para ESTE numero — "Sin asignar" bajando
 * es una buena noticia aunque el signo sea negativo.
 */
export function KpiTile({
  icon: Icon,
  label,
  value,
  tone = "neutral",
  emphasis = false,
  delta,
  sparkline,
}: KpiTileProps) {
  const isPositive = delta ? delta.percent >= 0 : null;
  const isGood = delta ? isPositive === delta.increaseIsGood : null;

  return (
    <DashboardCard
      padding="sm"
      className={`flex h-full flex-col gap-4 ${emphasis ? `ring-2 ${toneRing[tone]}` : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted">
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center ${INSET_RADIUS} ${toneIconBadge[tone]}`}>
            <Icon className="h-3 w-3" />
          </span>
          <span className="truncate">{label}</span>
        </span>

        {/* `aria-disabled` y no `disabled`: un boton deshabilitado de verdad
            sale del orden de tabulacion, y entonces la unica explicacion de por
            que no hace nada — el tooltip — quedaba fuera del alcance del
            teclado. Sigue sin accion; el onClick la corta explicitamente. */}
        <Tooltip content="Más opciones (próximamente)">
          <button
            type="button"
            aria-disabled
            aria-label="Más opciones (próximamente)"
            onClick={(event) => event.preventDefault()}
            className={`flex h-6 w-6 shrink-0 cursor-not-allowed items-center justify-center ${INSET_RADIUS}
              text-faint outline-none focus-visible:ring-3 focus-visible:ring-brand-red/25`}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
      </div>

      <div className="flex flex-1 items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="font-heading text-[28px] font-bold leading-none tracking-[-0.02em] text-ink">
            {value}
          </span>
          {delta && (
            <span className="flex items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-bold ${
                  isGood ? "bg-brand-green/8 text-brand-green" : "bg-brand-red/8 text-brand-red"
                }`}
              >
                {isPositive ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
                {Math.abs(delta.percent)}%
              </span>
              <span className="text-[10.5px] text-faint">{delta.comparisonLabel}</span>
            </span>
          )}
        </div>

        {sparkline && sparkline.length > 1 && (
          <div className="h-8 w-14 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sparkline.map((v) => ({ v }))} barCategoryGap="30%">
                <Bar dataKey="v" fill={toneBar[tone]} radius={[2, 2, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </DashboardCard>
  );
}
