// Adaptado de MonoRoundedBarChart.tsx —
// https://github.com/Subhan-code/Amicro--Micro-transitions- (MIT). Estructura y
// comportamiento (toggle Col/Fila, barras redondeadas) sin cambios; recoloreado
// a la paleta de marca (antes monocromo negro/blanco) para que combine con el
// resto del Dashboard — mismo shell que DashboardCard.
import { CheckCircle2, Plus } from "lucide-react";
import { useId, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { DashboardCard } from "../DashboardCard";
import { MonoChartLegend, MonoChartTable, type LegendItem } from "./MonoChartA11y";
import { MonoChartTooltip } from "./MonoChartTooltip";
import { INSET_RADIUS } from "../radii";
import { AXIS_TICK, GRID_STROKE } from "./chartTheme";
import { useIsMobile } from "./useIsMobile";

interface BarPoint {
  label: string;
  primary: number;
  secondary: number;
}

interface MonoRoundedBarChartProps {
  data: BarPoint[];
  total: number;
  compact?: boolean;
}

// Creados vs. resueltos es el semaforo que ya usa el resto del Dashboard. No se
// reutiliza un gris de la escala de filetes como identidad de serie: `line-strong`
// sobre `bg-canvas` daba ~1.1:1 y la barra practicamente no se veia.
const LEGEND: LegendItem[] = [
  { label: "Creados", color: "var(--color-brand-red)", shape: "solid", icon: Plus },
  { label: "Resueltos", color: "var(--color-brand-green)", shape: "hatch", icon: CheckCircle2 },
];

export function MonoRoundedBarChart({ data, total, compact = false }: MonoRoundedBarChartProps) {
  const isMobile = useIsMobile();
  const idPrefix = useId().replace(/:/g, "");
  const [layout, setLayout] = useState<"vertical" | "horizontal">("vertical");
  const isHorizontal = layout === "horizontal";

  return (
    <DashboardCard
      padding="chart"
      className={`relative w-full transition-shadow duration-300 flex flex-col justify-between overflow-hidden ${
        compact ? "h-[220px] sm:h-[268px]" : "min-h-[290px]"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold tracking-wider uppercase text-faint">Volumen de tickets</h2>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] bg-brand-red/8 text-brand-red border border-brand-red/20">
              Esta semana
            </span>
          </div>
          <p className="text-xl font-bold tracking-tight tabular-nums mt-0.5 font-heading text-ink">
            {total} <span className="text-xs font-normal text-muted">tickets creados</span>
          </p>
        </div>

        <div className="p-0.5 rounded-full border border-line bg-fill flex items-center gap-0.5">
          {(["vertical", "horizontal"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLayout(l)}
              aria-pressed={layout === l}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium capitalize transition-all cursor-pointer ${
                layout === l ? "bg-brand-red text-white font-semibold shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {l === "vertical" ? "Col" : "Fila"}
            </button>
          ))}
        </div>
      </div>

      <div
        role="img"
        aria-label={`Tickets creados y resueltos por dia de la semana. Total creados: ${total}.`}
        className={`relative w-full flex-1 ${INSET_RADIUS} overflow-hidden p-2 bg-canvas touch-pan-y`}
      >
        <ResponsiveContainer width="100%" height={compact ? 130 : 160}>
          <BarChart data={data} layout={isHorizontal ? "vertical" : "horizontal"} margin={{ top: 12, right: 12, left: isHorizontal ? 0 : -22, bottom: 0 }}>
            {/* Trama diagonal para "Resueltos": el par rojo/verde es el peor
                posible para la deuteranopia, asi que la serie tambien se
                distingue por textura, no solo por color. */}
            <defs>
              <pattern id={`${idPrefix}bar-hatch`} width="4" height="4" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                <rect width="4" height="4" fill="var(--color-brand-green)" />
                <line x1="0" y1="0" x2="0" y2="4" stroke="#ffffff" strokeWidth="1.4" strokeOpacity="0.85" />
              </pattern>
            </defs>
            <CartesianGrid strokeDasharray="2 2" vertical={false} stroke={GRID_STROKE} />
            {isHorizontal ? (
              <>
                <XAxis type="number" hide />
                <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} tick={AXIS_TICK} />
              </>
            ) : (
              <>
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} />
                <YAxis tickLine={false} axisLine={false} tick={AXIS_TICK} />
              </>
            )}
            <Tooltip content={<MonoChartTooltip indicator="dot" />} />

            <Bar dataKey="primary" name="Creados" fill="var(--color-brand-red)" radius={isHorizontal ? [0, 8, 8, 0] : [8, 8, 8, 8]} barSize={isHorizontal ? 12 : 16} isAnimationActive={!isMobile} animationDuration={isMobile ? 0 : 800} />
            <Bar dataKey="secondary" name="Resueltos" fill={`url(#${idPrefix}bar-hatch)`} radius={isHorizontal ? [0, 8, 8, 0] : [8, 8, 8, 8]} barSize={isHorizontal ? 12 : 16} isAnimationActive={!isMobile} animationDuration={isMobile ? 0 : 1000} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <MonoChartLegend items={LEGEND} />

      <MonoChartTable
        caption="Tickets creados y resueltos por dia"
        columns={["Dia", "Creados", "Resueltos"]}
        rows={data.map((point) => [point.label, point.primary, point.secondary])}
      />
    </DashboardCard>
  );
}
