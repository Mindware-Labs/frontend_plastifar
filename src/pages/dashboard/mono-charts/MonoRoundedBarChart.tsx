// Adaptado de MonoRoundedBarChart.tsx —
// https://github.com/Subhan-code/Amicro--Micro-transitions- (MIT). Estructura y
// comportamiento (toggle Col/Fila, barras redondeadas) sin cambios; recoloreado
// a la paleta de marca (antes monocromo negro/blanco) para que combine con el
// resto del Dashboard — mismo shell que DashboardCard.
import { useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { MonoChartTooltip } from "./MonoChartTooltip";
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

export function MonoRoundedBarChart({ data, total, compact = false }: MonoRoundedBarChartProps) {
  const isMobile = useIsMobile();
  const [layout, setLayout] = useState<"vertical" | "horizontal">("vertical");
  const isHorizontal = layout === "horizontal";

  return (
    <div
      className={`relative w-full rounded-2xl border border-line-soft bg-white shadow-[0_1px_2px_rgba(27,27,29,0.04),0_8px_24px_-12px_rgba(27,27,29,0.10)]
        transition-shadow duration-300 flex flex-col justify-between overflow-hidden p-4 sm:p-5 ${
          compact ? "h-[220px] sm:h-[268px]" : "min-h-[290px]"
        }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-wider uppercase text-faint">Volumen de tickets</span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-brand-red/10 text-brand-red border border-brand-red/20">
              Esta semana
            </span>
          </div>
          <div className="text-xl font-bold tracking-tight tabular-nums mt-0.5 font-sans text-ink">
            {total} <span className="text-xs font-normal text-muted">tickets creados</span>
          </div>
        </div>

        <div className="p-0.5 rounded-full border border-line bg-fill flex items-center gap-0.5">
          {(["vertical", "horizontal"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLayout(l)}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium capitalize transition-all cursor-pointer ${
                layout === l ? "bg-brand-red text-white font-semibold shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {l === "vertical" ? "Col" : "Fila"}
            </button>
          ))}
        </div>
      </div>

      <div className="relative w-full flex-1 rounded-[14px] overflow-hidden p-2 bg-canvas touch-pan-y">
        <ResponsiveContainer width="100%" height={compact ? 130 : 160}>
          <BarChart data={data} layout={isHorizontal ? "vertical" : "horizontal"} margin={{ top: 12, right: 12, left: isHorizontal ? 0 : -22, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="rgba(27,27,29,0.06)" />
            {isHorizontal ? (
              <>
                <XAxis type="number" hide />
                <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#A1A1AA" }} />
              </>
            ) : (
              <>
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#A1A1AA" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#A1A1AA" }} />
              </>
            )}
            <Tooltip content={<MonoChartTooltip indicator="dot" />} />

            <Bar dataKey="primary" name="Creados" fill="var(--color-brand-red)" radius={isHorizontal ? [0, 8, 8, 0] : [8, 8, 8, 8]} barSize={isHorizontal ? 12 : 16} isAnimationActive={!isMobile} animationDuration={isMobile ? 0 : 800} />
            <Bar dataKey="secondary" name="Resueltos" fill="var(--color-line-strong)" radius={isHorizontal ? [0, 8, 8, 0] : [8, 8, 8, 8]} barSize={isHorizontal ? 12 : 16} isAnimationActive={!isMobile} animationDuration={isMobile ? 0 : 1000} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
