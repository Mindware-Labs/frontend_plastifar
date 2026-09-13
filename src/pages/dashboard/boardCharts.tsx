import { useId } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useIsMobile } from "../../hooks/useIsMobile";
import { formatInteger, formatPercent } from "./format";

/* ========================================================================== *
 *  Los graficos del tablero.
 *
 *  La referencia pinta un color por serie —azul, verde, naranja— y eso aqui no
 *  se copia: DESIGN.md no tiene paleta categorica y el panel no la va a estrenar
 *  en su pantalla de apertura. Las series se distinguen por VALOR: 185 C para la
 *  principal, gris de filete para la de contexto. El verde queda para salud y el
 *  ambar para el estado intermedio, que es lo que ya significan en el sistema.
 * ========================================================================== */

/** Ticks de eje: `faint` es el piso de contraste del sistema. */
const AXIS_TICK = { fontSize: 10.5, fill: "var(--color-faint)" } as const;
/** Rejilla: el mismo filete estructural que el resto del panel. */
const GRID_STROKE = "var(--color-line)";

/* -------------------------------------------------------------------------- */

interface TooltipEntry {
  color?: string;
  fill?: string;
  value?: number;
  name?: string;
  dataKey?: string | number;
}

/**
 * Tooltip propio, en el vocabulario del panel.
 *
 * El de recharts trae su propia caja, su propia tipografia y su propio borde:
 * seria el unico elemento flotante de la aplicacion que no se parece al resto.
 * Esta es la misma receta que `Select` y el menu de cuenta — blanco, filete,
 * canto de 2 px y la sombra de panel flotante.
 */
function BoardTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  unit?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-edge border border-line bg-white px-3 py-2 shadow-panel">
      {label && (
        <p className="mb-1.5 border-b border-line-soft pb-1 font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">
          {label}
        </p>
      )}
      <ul className="flex flex-col gap-1">
        {payload.map((entry) => (
          <li
            key={String(entry.dataKey ?? entry.name)}
            className="flex items-center justify-between gap-4 text-[11.5px]"
          >
            <span className="flex items-center gap-1.5 text-brand-gray">
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-pill"
                style={{ backgroundColor: entry.color ?? entry.fill ?? "var(--color-brand-red)" }}
              />
              {entry.name}
            </span>
            <span className="font-heading text-[12px] font-bold tabular-nums text-ink">
              {formatInteger(entry.value ?? 0)}
              {unit ? ` ${unit}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Leyenda propia, en la misma linea de la cabecera del grafico.
 *
 * La de recharts se dibuja dentro del area del grafico y le roba alto a las
 * curvas, que es lo que hay que poder comparar.
 */
export function SeriesLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-[11.5px] text-subtle">
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-pill"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */

export interface TrendPoint {
  label: string;
  opened: number;
  closed: number;
}

/** Un mes de cada dos, contados desde el ultimo hacia atras. */
function narrowTicks(data: TrendPoint[]) {
  return data.filter((_, index) => (data.length - 1 - index) % 2 === 0).map((point) => point.label);
}

/**
 * La curva ancha del tablero: dos series en el tiempo, una encima de la otra.
 *
 * Area y no barras porque la pregunta es la FORMA —viene subiendo o bajando— y
 * doce barras dobles obligan a comparar alturas de a pares. El relleno es un
 * degradado que muere en transparente: el area llena y opaca tapa la serie de
 * atras, y aqui las dos tienen que poder leerse juntas.
 */
export function TrendArea({ data }: { data: TrendPoint[] }) {
  const isMobile = useIsMobile();
  const id = useId().replace(/:/g, "");

  return (
    // `relative` + `absolute inset-0`: `ResponsiveContainer` mide a su padre y le
    // fija un alto; dentro de una columna flexible eso se realimenta y el grafico
    // empuja a la leyenda fuera de la caja. Sacado del flujo, mide y no agranda.
    <div className="relative min-h-[180px] w-full flex-1">
      <div className="absolute inset-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id={`closed${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-brand-red)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--color-brand-red)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id={`opened${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-subtle)" stopOpacity={0.16} />
                <stop offset="100%" stopColor="var(--color-subtle)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 3" vertical={false} stroke={GRID_STROKE} />
            {/* Rotulos explicitos en angosto. El automatico de recharts los
                soltaba de forma despareja —"jun jul" pegados y el resto
                salteado—; un `interval` de 1 arreglaba el paso pero contaba
                desde el principio y dejaba el ULTIMO mes sin nombre, que en una
                serie temporal es el que mas se mira. `narrowTicks` cuenta desde
                el final: paso constante y el mes en curso siempre rotulado. */}
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK}
              dy={4}
              interval={0}
              ticks={isMobile ? narrowTicks(data) : undefined}
            />
            <YAxis tickLine={false} axisLine={false} tick={AXIS_TICK} width={44} tickCount={5} />
            <Tooltip
              content={<BoardTooltip />}
              cursor={{ stroke: "var(--color-line-strong)", strokeWidth: 1 }}
            />
            {/* La de contexto va PRIMERO para quedar detras: la serie principal
                es la roja y no puede quedar tapada por el gris. */}
            <Area
              type="monotone"
              dataKey="opened"
              name="Abiertas"
              // `subtle` y no `line-strong`: a 1,5 px de trazo el filete
              // estructural se perdia contra la rejilla y la serie de contexto
              // dejaba de ser comparable con la principal.
              stroke="var(--color-subtle)"
              strokeWidth={1.5}
              fill={`url(#opened${id})`}
              dot={false}
              activeDot={{ r: 3, fill: "var(--color-subtle)", stroke: "#ffffff", strokeWidth: 2 }}
              isAnimationActive={!isMobile}
              animationDuration={isMobile ? 0 : 700}
            />
            <Area
              type="monotone"
              dataKey="closed"
              name="Cerradas"
              stroke="var(--color-brand-red)"
              strokeWidth={2}
              fill={`url(#closed${id})`}
              dot={false}
              activeDot={{
                r: 4,
                fill: "var(--color-brand-red)",
                stroke: "#ffffff",
                strokeWidth: 2,
              }}
              isAnimationActive={!isMobile}
              animationDuration={isMobile ? 0 : 850}
            />
            <Legend content={() => null} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export interface CategoryPoint {
  name: string;
  value: number;
}

/**
 * Comparacion por categoria.
 *
 * Horizontal y no vertical: los nombres de territorio son palabras, y en
 * vertical se giran 45 grados o se recortan.
 *
 * TODAS las barras del mismo valor. La primera version pintaba la mayor de rojo
 * para "marcar el primer lugar", y eso era un quinto significado del 185 C en
 * una pantalla donde ya quiere decir periodo activo, serie principal, variacion
 * mala y alerta. El orden lo dice el largo de la barra, que es para lo que la
 * barra existe; el rojo se queda para lo que pide una accion.
 */
export function CategoryBars({ data, unit }: { data: CategoryPoint[]; unit: string }) {
  const isMobile = useIsMobile();
  const sorted = [...data].sort((a, b) => b.value - a.value).slice(0, 7);

  if (sorted.length === 0) {
    return <p className="py-10 text-center text-[13.5px] text-faint">Todavía no hay datos.</p>;
  }

  return (
    <div className="relative min-h-[190px] w-full flex-1">
      <div className="absolute inset-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={sorted}
            layout="vertical"
            margin={{ top: 2, right: 16, left: 0, bottom: 2 }}
            barCategoryGap="14%"
          >
            <CartesianGrid strokeDasharray="2 3" horizontal={false} stroke={GRID_STROKE} />
            <XAxis type="number" tickLine={false} axisLine={false} tick={AXIS_TICK} />
            <YAxis
              type="category"
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK}
              width={108}
            />
            <Tooltip
              content={<BoardTooltip unit={unit} />}
              cursor={{ fill: "var(--color-line-soft)" }}
            />
            {/* `subtle` y no `line-strong`: el filete estructural sobre blanco
                da 1,2:1 y una barra de datos que no se ve contra su fondo no
                permite la comparacion para la que se dibujo. Los tokens de
                filete rodean controles; la tinta de datos es un gris de texto. */}
            <Bar
              dataKey="value"
              name={unit}
              fill="var(--color-subtle)"
              radius={[2, 2, 2, 2]}
              maxBarSize={20}
              isAnimationActive={!isMobile}
              animationDuration={isMobile ? 0 : 700}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/** Los tres tramos del indicador de salud, con su color y su veredicto. */
const HEALTH_BANDS = [
  { floor: 0.85, color: "var(--color-brand-green)", verdict: "Saludable" },
  { floor: 0.6, color: "var(--color-warn)", verdict: "En observación" },
  { floor: 0, color: "var(--color-brand-red)", verdict: "Fuera de meta" },
] as const;

function healthBand(fraction: number) {
  return HEALTH_BANDS.find((band) => fraction >= band.floor) ?? HEALTH_BANDS[2];
}

/**
 * Indicador radial de salud: medio anillo con la fraccion cumplida.
 *
 * Medio y no entero porque la escala tiene un piso y un techo que el ojo tiene
 * que poder ubicar; en un anillo completo el 0 % y el 100 % caen en el mismo
 * punto. El color sale del semaforo que el panel ya usa —verde sano, ambar
 * intermedio, rojo fuera de meta— y nunca es lo unico que lo dice: debajo va el
 * veredicto escrito.
 */
export function HealthGauge({
  fraction,
  goal,
  caption,
  footnote,
}: {
  fraction: number;
  /** La meta, DIBUJADA sobre el arco y no solo enunciada al pie. */
  goal?: number;
  caption: string;
  footnote?: string;
}) {
  const isMobile = useIsMobile();
  const safe = Math.max(0, Math.min(1, fraction));
  const band = healthBand(safe);
  const slices = [
    { name: "Cumplido", value: safe },
    { name: "Pendiente", value: 1 - safe },
  ];

  // La marca de meta es un anillo propio con una sola rebanada visible: el resto
  // va transparente. Un instrumento que dice "la meta es 85 %" en una frase y no
  // la marca en la escala obliga a estimar donde cae ese 85 % sobre el arco.
  const MARK = 0.008;
  const marker =
    goal === undefined
      ? null
      : [
          { value: Math.max(0, goal - MARK / 2) },
          { value: MARK },
          { value: Math.max(0, 1 - goal - MARK / 2) },
        ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-[140px] w-full flex-1">
        <div className="absolute inset-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                startAngle={200}
                endAngle={-20}
                // Radios en porcentaje: la caja reparte el alto de la pantalla y
                // un radio en pixeles se recorta en cuanto mide menos que su
                // diametro.
                // Anillo fino, no un bloque: a 66/94 el arco verde era la mayor
                // masa de color de la pantalla y le disputaba la lectura al
                // unico rojo. Un instrumento se lee por donde termina el arco,
                // no por cuanta tinta gasta.
                innerRadius="78%"
                outerRadius="95%"
                cy="64%"
                cornerRadius={2}
                stroke="none"
                isAnimationActive={!isMobile}
                animationDuration={isMobile ? 0 : 800}
              >
                <Cell fill={band.color} />
                {/* `line-strong` y no `line-soft`: el arco que falta es un dato
                    —cuanto queda para la meta— y a #f0f0f2 sobre blanco no se
                    distinguia de la tarjeta. */}
                <Cell fill="var(--color-line-strong)" />
                <Label
                  position="center"
                  content={() => (
                    <>
                      <text
                        x="50%"
                        y="64%"
                        dy={-4}
                        textAnchor="middle"
                        className="font-heading fill-ink text-[30px] font-bold"
                        style={{ letterSpacing: "-0.03em" }}
                      >
                        {formatPercent(safe)}
                      </text>
                      <text
                        x="50%"
                        y="64%"
                        dy={16}
                        textAnchor="middle"
                        className="font-heading fill-faint text-[10px] font-semibold"
                        style={{ letterSpacing: "0.08em" }}
                      >
                        {band.verdict.toUpperCase()}
                      </text>
                    </>
                  )}
                />
              </Pie>

              {marker && (
                <Pie
                  data={marker}
                  dataKey="value"
                  startAngle={200}
                  endAngle={-20}
                  // FUERA del arco, no cruzandolo. Cruzandolo, la marca era un
                  // corte en el anillo a pocos grados de donde el arco termina y
                  // se leia como el final del arco, que es justo el dato que no
                  // es. Por fuera es lo que tiene que ser: una referencia.
                  innerRadius="100%"
                  outerRadius="112%"
                  cy="64%"
                  stroke="none"
                  isAnimationActive={false}
                >
                  <Cell fill="transparent" />
                  <Cell fill="var(--color-ink)" />
                  <Cell fill="transparent" />
                </Pie>
              )}
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="shrink-0 border-t border-line-soft pt-2.5 text-[11.5px] leading-tight text-subtle">
        {caption}
      </p>
      {footnote && <p className="shrink-0 pt-1 text-[11px] leading-tight text-faint">{footnote}</p>}
    </div>
  );
}
