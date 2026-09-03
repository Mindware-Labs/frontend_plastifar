import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

interface SlaDonutProps {
  compliance: number;
  label: string;
}

function toneColor(value: number): string {
  if (value >= 90) return "var(--color-brand-green)";
  if (value >= 75) return "var(--color-warn)";
  return "var(--color-brand-red)";
}

/**
 * Gauge de una sola magnitud: cumplimiento contra un umbral, no identidad de
 * serie — usa el mismo semaforo rojo/ambar/verde del resto del panel.
 */
export function SlaDonut({ compliance, label }: SlaDonutProps) {
  const color = toneColor(compliance);
  const data = [
    { value: compliance },
    { value: Math.max(0, 100 - compliance) },
  ];

  return (
    <div className="relative h-[110px] w-[110px] shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius={38}
            outerRadius={52}
            startAngle={90}
            endAngle={-270}
            stroke="none"
            isAnimationActive={false}
          >
            <Cell fill={color} />
            <Cell fill="var(--color-fill)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-[17px] font-bold leading-none tracking-[-0.02em] text-ink">
          {compliance}%
        </span>
        <span className="mt-0.5 max-w-[70px] text-center text-[9.5px] leading-tight text-faint">
          {label}
        </span>
      </div>
    </div>
  );
}
