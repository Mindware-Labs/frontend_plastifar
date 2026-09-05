// Adaptado de MonoRoundedDonutChart.tsx —
// https://github.com/Subhan-code/Amicro--Micro-transitions- (MIT). Estructura y
// comportamiento (hover que resalta el segmento, callout central) sin cambios;
// recoloreado a la paleta de marca (antes monocromo negro/blanco).
import { useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { DashboardCard } from "../DashboardCard";
import { MonoChartTable } from "./MonoChartA11y";
import { MonoChartTooltip } from "./MonoChartTooltip";
import { INSET_RADIUS } from "../radii";
import { CARD_WHITE } from "./chartTheme";
import { useIsMobile } from "./useIsMobile";

interface DonutSegment {
  name: string;
  value: number;
}

interface MonoRoundedDonutChartProps {
  data: DonutSegment[];
  compact?: boolean;
}

// Primer lugar en rojo de marca (llama la atencion sobre la categoria top); el
// resto en grises que YA existen en la rampa, de mas a menos oscuro. No se
// inventa un gris intermedio: la Regla del Piso de Contraste prohibe un cuarto
// gris entre `faint` y `line-strong`.
const SEGMENT_COLORS = [
  "var(--color-brand-red)",
  "var(--color-brand-gray)",
  "var(--color-muted)",
  "var(--color-faint)",
];

export function MonoRoundedDonutChart({ data, compact = false }: MonoRoundedDonutChartProps) {
  const isMobile = useIsMobile();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const total = data.reduce((acc, item) => acc + item.value, 0);

  return (
    <DashboardCard
      padding="chart"
      className={`relative w-full transition-shadow duration-300 flex flex-col justify-between overflow-hidden ${
        compact ? "h-[220px] sm:h-[268px]" : "min-h-[290px]"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold tracking-wider uppercase text-faint">Tickets por categoría</h2>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] bg-brand-red/8 text-brand-red border border-brand-red/20">
              Distribución
            </span>
          </div>
          <p className="text-xl font-bold tracking-tight tabular-nums mt-0.5 font-heading text-ink">
            {total} <span className="text-xs font-normal text-muted">tickets</span>
          </p>
        </div>
      </div>

      <div
        role="img"
        aria-label={`Distribución de ${total} tickets entre ${data.length} categorías.`}
        className={`relative w-full flex-1 ${INSET_RADIUS} overflow-hidden p-2 bg-canvas flex items-center justify-center touch-pan-y`}
      >
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
              {data.map((entry, index) => {
                const isHovered = hoverIndex === index;
                const fillColor = SEGMENT_COLORS[index % SEGMENT_COLORS.length];

                return (
                  <Cell
                    // La clave va por categoria y no por indice: el orden se
                    // recalcula por magnitud en cada refresco y un indice
                    // reasignaria el color de un segmento al vecino.
                    key={entry.name}
                    fill={fillColor}
                    stroke={CARD_WHITE}
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
          <span className="text-sm font-bold tabular-nums font-heading text-ink">
            {hoverIndex !== null ? `${data[hoverIndex].value}` : total}
          </span>
          <span className="text-[10px] text-muted">{hoverIndex !== null ? data[hoverIndex].name : "Total"}</span>
        </div>
      </div>

      {/* Leyenda propia: cada entrada nombra su categoria y lleva su cifra, asi
          que el color nunca es lo unico que asocia muestra y etiqueta. */}
      <ul className="flex items-center justify-around mt-3 pt-1 border-t border-line-soft text-[10px]">
        {data.map((seg, idx) => (
          <li key={seg.name} className="flex items-center gap-1">
            <span
              aria-hidden
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: SEGMENT_COLORS[idx % SEGMENT_COLORS.length] }}
            />
            <span className="text-muted">{seg.name}</span>
            <span className="tabular-nums text-faint">{seg.value}</span>
          </li>
        ))}
      </ul>

      <MonoChartTable
        caption="Tickets por categoría"
        columns={["Categoría", "Tickets"]}
        rows={data.map((seg) => [seg.name, seg.value])}
      />
    </DashboardCard>
  );
}
