import { useId } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS_TICK, CARD_WHITE, GRID_STROKE } from "./mono-charts/chartTheme";
import { MonoChartTooltip } from "./mono-charts/MonoChartTooltip";
import { useIsMobile } from "../../hooks/useIsMobile";
import { INSET_RADIUS } from "./radii";

/* ========================================================================== *
 *  Los dos graficos del tablero, en la anatomia de la referencia.
 * ========================================================================== */

export interface MonthPoint {
  label: string;
  opened: number;
  closed: number;
}

/**
 * Barras agrupadas por mes con la linea de promedio.
 *
 * La referencia pinta dos barras por punto —una gris de contexto y una de
 * acento— y cruza el area con una discontinua rotulada "Prom.". Esa linea es lo
 * que convierte doce barras en una lectura: sin ella hay que comparar alturas
 * de memoria para saber si un mes fue alto o bajo.
 *
 * La serie de contexto es gris y la que importa lleva el 185 C. No son dos
 * identidades del mismo rango: una es "lo que entro" y la otra "lo que se
 * cerro", y el ojo tiene que ir primero a la primera.
 */
export function MonthlyBars({ data, average }: { data: MonthPoint[]; average: number }) {
  const isMobile = useIsMobile();

  return (
    <div className={`w-full ${INSET_RADIUS} bg-canvas p-2`}>
      <ResponsiveContainer width="100%" height={244}>
        <BarChart data={data} margin={{ top: 16, right: 10, left: -14, bottom: 0 }} barGap={4}>
          <CartesianGrid strokeDasharray="2 2" vertical={false} stroke={GRID_STROKE} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} />
          <YAxis tickLine={false} axisLine={false} tick={AXIS_TICK} width={38} tickCount={5} />
          <Tooltip
            content={<MonoChartTooltip indicator="dot" />}
            cursor={{ fill: "var(--color-line-soft)" }}
          />

          {/* La etiqueta va anclada al eje, como en la referencia: el numero se
              lee sin cruzar toda la caja hasta la linea. */}
          <ReferenceLine
            y={average}
            stroke="var(--color-ink)"
            strokeDasharray="4 4"
            strokeWidth={1}
            ifOverflow="extendDomain"
          >
            {/* La pastilla se dibuja: un `stroke` grueso bajo el texto para
                simular el fondo deja un contorno dentado en cada letra. Aqui
                son un rect y un text, que es lo que la referencia muestra. */}
            <Label
              content={({ viewBox }) => {
                const box = viewBox as { x?: number; y?: number } | undefined;
                if (box?.x === undefined || box.y === undefined) return null;
                const width = 54;
                const height = 18;
                return (
                  <g transform={`translate(${box.x + 2}, ${box.y - height / 2})`}>
                    <rect width={width} height={height} rx={3} fill="var(--color-ink)" />
                    <text
                      x={width / 2}
                      y={height / 2 + 1}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={CARD_WHITE}
                      className="font-heading text-[10.5px] font-semibold"
                    >
                      {`Prom. ${average}`}
                    </text>
                  </g>
                );
              }}
            />
          </ReferenceLine>

          <Bar
            dataKey="opened"
            name="Abiertas"
            fill="var(--color-line-strong)"
            radius={[4, 4, 0, 0]}
            maxBarSize={18}
            isAnimationActive={!isMobile}
            animationDuration={isMobile ? 0 : 700}
          />
          <Bar
            dataKey="closed"
            name="Cerradas"
            fill="var(--color-brand-red)"
            radius={[4, 4, 0, 0]}
            maxBarSize={18}
            isAnimationActive={!isMobile}
            animationDuration={isMobile ? 0 : 850}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Leyenda de puntos en linea, como la de la cabecera de la referencia. */
export function DotLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-[11.5px] text-subtle">
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */

export interface Slice {
  name: string;
  value: number;
}

/**
 * Reparto en dona con el total al centro y la leyenda como lista.
 *
 * La rampa es un solo tono que se aclara por rango, no cinco colores sueltos:
 * un reparto es una MAGNITUD ordenada, y asi el segmento mas grande se
 * reconoce sin ir a la leyenda. La leyenda igual va, con el nombre, la cifra y
 * el porcentaje —el color nunca es la unica pista.
 */
const SLICE_RAMP = ["#e4002b", "#f0234a", "#f4849c", "#fbc9d3", "#dcdce0"] as const;

export function DistributionDonut({ data, unit }: { data: Slice[]; unit: string }) {
  const isMobile = useIsMobile();
  const idPrefix = useId().replace(/:/g, "");
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, slice) => sum + slice.value, 0);

  // Mas de cinco segmentos dejan de distinguirse: la cola se agrupa en "Otros",
  // que ademas es mas honesto que pintar seis rebanadas de dos grados.
  const shown = sorted.slice(0, 4);
  const rest = sorted.slice(4);
  const slices =
    rest.length > 0
      ? [...shown, { name: "Otros", value: rest.reduce((sum, s) => sum + s.value, 0) }]
      : shown;

  if (total === 0) {
    return <p className="py-10 text-center text-[13.5px] text-faint">Todavía no hay datos.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className={`${INSET_RADIUS} bg-canvas p-2`}>
        <ResponsiveContainer width="100%" height={188}>
          <PieChart>
            <Tooltip content={<MonoChartTooltip indicator="dot" />} />
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius={54}
              outerRadius={78}
              paddingAngle={2}
              stroke={CARD_WHITE}
              strokeWidth={2}
              isAnimationActive={!isMobile}
              animationDuration={isMobile ? 0 : 800}
            >
              {slices.map((slice, index) => (
                <Cell key={`${idPrefix}${slice.name}`} fill={SLICE_RAMP[index] ?? SLICE_RAMP[4]} />
              ))}
              <Label
                position="center"
                content={() => (
                  <>
                    <text
                      x="50%"
                      y="47%"
                      textAnchor="middle"
                      className="font-heading fill-ink text-[20px] font-bold"
                    >
                      {total.toLocaleString("es-DO")}
                    </text>
                    <text
                      x="50%"
                      y="62%"
                      textAnchor="middle"
                      className="fill-faint text-[11px]"
                    >
                      {unit}
                    </text>
                  </>
                )}
              />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="flex flex-col gap-2">
        {slices.map((slice, index) => (
          <li key={slice.name} className="flex items-center gap-2 text-[12.5px]">
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: SLICE_RAMP[index] ?? SLICE_RAMP[4] }}
            />
            <span className="min-w-0 flex-1 truncate text-brand-gray">{slice.name}</span>
            <span className="shrink-0 tabular-nums text-faint">{slice.value}</span>
            <span className="w-10 shrink-0 text-right font-semibold tabular-nums text-ink">
              {Math.round((slice.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
