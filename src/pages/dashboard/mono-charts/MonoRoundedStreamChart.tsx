// Adaptado de MonoRoundedStreamChart.tsx —
// https://github.com/Subhan-code/Amicro--Micro-transitions- (MIT). Estructura y
// comportamiento (curva natural, doble area con gradiente) sin cambios;
// recoloreado a la paleta de marca (antes monocromo negro/blanco) — rojo para
// creados, verde para resueltos, mismo semaforo que el resto del Dashboard.
import { useId } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { MonoChartTooltip } from "./MonoChartTooltip";

interface StreamPoint {
  t: string;
  w1: number;
  w2: number;
}

interface MonoRoundedStreamChartProps {
  data: StreamPoint[];
  peak: number;
  compact?: boolean;
}

export function MonoRoundedStreamChart({ data, peak, compact = false }: MonoRoundedStreamChartProps) {
  const idPrefix = useId().replace(/:/g, "");

  return (
    <div
      className={`relative w-full rounded-2xl border border-line-soft bg-white shadow-[0_1px_2px_rgba(27,27,29,0.04),0_8px_24px_-12px_rgba(27,27,29,0.10)]
        transition-shadow duration-300 flex flex-col justify-between overflow-hidden p-4 sm:p-5 ${
          compact ? "h-[220px] sm:h-[268px]" : "min-h-[290px]"
        }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-wider uppercase text-faint">Actividad por hora</span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-brand-red/10 text-brand-red border border-brand-red/20">
              Flujo
            </span>
          </div>
          <div className="text-xl font-bold tracking-tight tabular-nums mt-0.5 font-sans text-ink">
            {peak} <span className="text-xs font-normal text-muted">pico de tickets</span>
          </div>
        </div>
      </div>

      <div className="relative w-full flex-1 rounded-[14px] overflow-hidden p-2 bg-canvas">
        <svg className="absolute w-0 h-0 pointer-events-none">
          <defs>
            <linearGradient id={`${idPrefix}stream-g1`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-brand-red)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--color-brand-red)" stopOpacity="0.03" />
            </linearGradient>
            <linearGradient id={`${idPrefix}stream-g2`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-brand-green)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--color-brand-green)" stopOpacity="0.0" />
            </linearGradient>
          </defs>
        </svg>
        <ResponsiveContainer width="100%" height={compact ? 130 : 160}>
          <AreaChart data={data} margin={{ top: 12, right: 12, left: -22, bottom: 0 }}>
            <XAxis dataKey="t" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#A1A1AA" }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#A1A1AA" }} />
            <Tooltip content={<MonoChartTooltip indicator="dot" />} />
            <Area type="natural" dataKey="w1" name="Creados" stroke="var(--color-brand-red)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill={`url(#${idPrefix}stream-g1)`} animationDuration={800} />
            <Area type="natural" dataKey="w2" name="Resueltos" stroke="var(--color-brand-green)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill={`url(#${idPrefix}stream-g2)`} animationDuration={900} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
