import { ArrowDown, ArrowUp } from "lucide-react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { Delta, WeekdayVolume } from "../../types/dashboard";

const dayLabel: Record<WeekdayVolume["day"], string> = {
  L: "Lun",
  M: "Mar",
  X: "Mié",
  J: "Jue",
  V: "Vie",
  S: "Sáb",
  D: "Dom",
};

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: WeekdayVolume }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-edge border border-line bg-white px-3 py-2 shadow-[0_4px_8px_rgba(27,27,29,0.04),0_24px_48px_-20px_rgba(27,27,29,0.28)]">
      <p className="font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">
        {dayLabel[point.day]}
      </p>
      <p className="mt-0.5 text-[13px] font-semibold text-ink">{point.count} tickets</p>
    </div>
  );
}

interface VolumeTrackerProps {
  data: WeekdayVolume[];
  delta: Delta;
}

/**
 * Un solo magnitud (tickets por dia), no identidad de serie: se queda dentro
 * del semaforo existente en vez de una paleta categorica nueva. El dia con
 * mas volumen se resalta en rojo institucional; el resto en gris de relleno.
 */
export function VolumeTracker({ data, delta }: VolumeTrackerProps) {
  const peakIndex = data.reduce(
    (best, point, index) => (point.count > data[best].count ? index : best),
    0,
  );
  const isGood = delta.percent >= 0 === delta.increaseIsGood;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <span
          className={`inline-flex items-center gap-1 font-heading text-[20px] font-bold leading-none tracking-[-0.02em] ${
            isGood ? "text-brand-green" : "text-brand-red"
          }`}
        >
          {delta.percent >= 0 ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )}
          {Math.abs(delta.percent)}%
        </span>
        <p className="text-[11.5px] leading-tight text-muted">
          esta semana {delta.percent >= 0 ? "por encima" : "por debajo"} de la anterior
        </p>
      </div>

      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
            <XAxis
              dataKey="day"
              tickFormatter={(value: WeekdayVolume["day"]) => value}
              tick={{ fill: "var(--color-faint)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--color-fill)" }} />
            <Bar dataKey="count" radius={[8, 8, 8, 8]} maxBarSize={22}>
              {data.map((point, index) => (
                <Cell
                  key={point.day}
                  fill={
                    index === peakIndex
                      ? "var(--color-brand-red)"
                      : "color-mix(in srgb, var(--color-brand-red) 12%, white)"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
