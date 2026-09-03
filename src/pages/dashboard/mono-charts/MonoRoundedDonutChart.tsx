// Adaptado de MonoRoundedDonutChart.tsx —
// https://github.com/Subhan-code/Amicro--Micro-transitions- (MIT). Estructura y
// comportamiento (hover que resalta el segmento, callout central) sin cambios;
// recoloreado a la paleta de marca (antes monocromo negro/blanco).
import { useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { MonoChartTooltip } from "./MonoChartTooltip";
import { useIsMobile } from "./useIsMobile";

interface DonutSegment {
  name: string;
  value: number;
}

interface MonoRoundedDonutChartProps {
  data: DonutSegment[];
  compact?: boolean;
}

// Primer lugar en rojo de marca (llama la atencion sobre la categoria top);
// el resto en gris, de mas a menos oscuro — orden por magnitud, no identidad.
const SEGMENT_COLORS = ["var(--color-brand-red)", "#a1a1aa", "#c7c7ce", "var(--color-line-strong)"];

export function MonoRoundedDonutChart({ data, compact = false }: MonoRoundedDonutChartProps) {
  const isMobile = useIsMobile();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const total = data.reduce((acc, item) => acc + item.value, 0);

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
            <span className="text-xs font-semibold tracking-wider uppercase text-faint">Tickets por categoría</span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-brand-red/10 text-brand-red border border-brand-red/20">
              Distribución
            </span>
          </div>
          <div className="text-xl font-bold tracking-tight tabular-nums mt-0.5 font-sans text-ink">
            {total} <span className="text-xs font-normal text-muted">tickets</span>
          </div>
        </div>
      </div>

      <div className="relative w-full flex-1 rounded-[14px] overflow-hidden p-2 bg-canvas flex items-center justify-center touch-pan-y">
        <ResponsiveContainer width="100%" height={compact ? 130 : 160}>
          <PieChart>
            <Tooltip content={<MonoChartTooltip indicator="dot" />} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={compact ? 38 : 46}
              outerRadius={compact ? 58 : 68}
              paddingAngle={6}
              cornerRadius={8}
              strokeLinecap="round"
              onMouseEnter={(_, idx) => setHoverIndex(idx)}
              onMouseLeave={() => setHoverIndex(null)}
              isAnimationActive={!isMobile}
              animationDuration={isMobile ? 0 : 900}
            >
              {data.map((_entry, index) => {
                const isHovered = hoverIndex === index;
                const fillColor = SEGMENT_COLORS[index % SEGMENT_COLORS.length];

                return (
                  <Cell
                    key={`mono-cell-${index}`}
                    fill={fillColor}
                    stroke="#FFFFFF"
                    strokeWidth={2}
                    style={{
                      transform: isHovered ? "scale(1.05)" : "scale(1)",
                      transformOrigin: "center center",
                      transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                      cursor: "pointer",
                    }}
                  />
                );
              })}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-sm font-bold tabular-nums font-sans text-ink">
            {hoverIndex !== null ? `${data[hoverIndex].value}` : total}
          </span>
          <span className="text-[10px] text-muted">{hoverIndex !== null ? data[hoverIndex].name : "Total"}</span>
        </div>
      </div>

      <div className="flex items-center justify-around mt-3 pt-1 border-t border-line-soft text-[10px]">
        {data.map((seg, idx) => (
          <div key={idx} className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: SEGMENT_COLORS[idx % SEGMENT_COLORS.length] }} />
            <span className="text-muted">{seg.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
