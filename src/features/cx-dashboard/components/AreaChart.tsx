import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { C, CHART_H, FONT, NUM, SVG_TEXT } from "../styles";

export interface AreaSeries {
  /** Nombre de la serie. Va en la leyenda y en el tooltip. */
  label: string;
  values: number[];
  color: string;
}

/**
 * Serie temporal en areas, dibujada a mano.
 *
 * ------------------------------------------------------------------
 * POR QUE AREAS Y NO BARRAS
 * ------------------------------------------------------------------
 * Con barras agrupadas, treinta dias eran sesenta rectangulos de pocos pixeles,
 * y en una ventana tranquila la tarjeta quedaba como una franja vacia con una
 * columna suelta. Lo que se viene a leer es la FORMA de las dos series a lo
 * largo del mes —si entra mas de lo que sale— y eso lo dice una linea continua
 * mejor que sesenta barras. El relleno lavado debajo de cada linea le da peso
 * sin tapar a la otra serie.
 *
 * ------------------------------------------------------------------
 * LA CURVA NO INVENTA DATOS
 * ------------------------------------------------------------------
 * El suavizado es monotono (Fritsch-Carlson): entre dos puntos la curva nunca
 * pasa por encima del mayor ni por debajo del menor. Un spline comun dibuja
 * valles bajo cero y picos que ningun dia tuvo, que es justo lo que la
 * referencia hace y lo que aca no se puede hacer: un tablero de operacion no
 * puede pintar «-2 tickets».
 *
 * ------------------------------------------------------------------
 * UN SOLO EJE, SIEMPRE
 * ------------------------------------------------------------------
 * Las dos series miden lo mismo —tickets por dia— y comparten escala. Dos
 * escalas en un mismo dibujo dejan que cualquiera parezca mayor con solo
 * elegir los topes, y el cruce entre las curvas dejaria de significar algo.
 *
 * ------------------------------------------------------------------
 * EL DETALLE SE PIDE
 * ------------------------------------------------------------------
 * En reposo, la serie limpia. Al pasar el cursor —o con las flechas, una vez
 * enfocada— una guia vertical marca el dia, los puntos se encienden sobre cada
 * linea y el tooltip trae las dos cifras.
 */
export function AreaChart({
  series,
  max,
  ticks,
  tooltipTop,
  tooltipUnit,
  reference,
  height = CHART_H.main,
}: {
  /** Dos series como maximo: con tres, las areas se tapan entre si. */
  series: [AreaSeries, AreaSeries] | [AreaSeries];
  max: number;
  ticks: [number, string][];
  tooltipTop: (index: number) => string;
  tooltipUnit: string;
  /** Linea de referencia horizontal (p. ej. el promedio diario), con su rotulo. */
  reference?: { value: number; label: string };
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  /* El lienzo mide lo que mide la tarjeta. Con un viewBox fijo de 900 la
     grafica se escalaba entera, texto incluido: en un telefono los rotulos del
     eje quedaban en tres pixeles. Midiendo el ancho real, el texto conserva su
     tamaño y lo que se estira es el trazo. */
  const [width, setWidth] = useState(900);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next > 0) setWidth(next);
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  const gradientId = useId();
  const count = series[0].values.length;
  /* Ancla del tooltip mientras esta oculto: su primera aparicion no viene
     volando desde una esquina. */
  const active = hover ?? 0;

  const W = width;
  /* En angosto, menos alto: la proporcion se mantiene legible y la tarjeta no
     se convierte en una columna de grafica. */
  const H = width < 560 ? Math.round(height * 0.72) : height;
  const L = 40;
  const R = 18;
  const T_ = 16;
  const B = 44;
  const plotW = W - L - R;
  const plotH = H - T_ - B;

  const xFor = (i: number) => (count <= 1 ? L + plotW / 2 : L + (i * plotW) / (count - 1));
  const yFor = (v: number) => T_ + plotH - (v / max) * plotH;
  const baseline = T_ + plotH;

  /* De mayor a menor y sin repetidos: con un maximo chico los cuartos
     colapsan al redondear y el eje mostraria el mismo valor dos veces. */
  const yTicks = [...new Set([1, 0.75, 0.5, 0.25, 0].map((f) => Math.round(max * f)))];

  const points = (values: number[]) => values.map((v, i) => [xFor(i), yFor(v)] as const);

  const describe = series
    .map((s) => `${s.label}: ${s.values.reduce((a, b) => a + b, 0)}`)
    .join("; ");

  /* Indice del dia mas cercano al cursor. La guia salta de dia en dia: entre
     dos dias no hay dato, asi que no hay nada que mostrar. */
  function indexAt(event: MouseEvent<SVGRectElement>) {
    const svg = svgRef.current;
    if (!svg || count === 0) return null;
    const box = svg.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * W;
    if (count === 1) return 0;
    const i = Math.round(((x - L) / plotW) * (count - 1));
    return Math.min(Math.max(i, 0), count - 1);
  }

  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (count === 0) return;
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 };
    if (event.key in step) {
      event.preventDefault();
      setHover((current) => Math.min(Math.max((current ?? count - 1) + step[event.key], 0), count - 1));
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setHover(event.key === "Home" ? 0 : count - 1);
    } else if (event.key === "Escape") {
      setHover(null);
    }
  }

  const tipW = series.length > 1 ? 156 : 120;
  const tipH = series.length > 1 ? 60 : 44;
  const tipX = Math.min(Math.max(xFor(active) + 14, L), W - R - tipW);
  /* El tooltip se aparta de la guia hacia el lado donde hay sitio. */
  const tipLeft = xFor(active) + 14 + tipW > W - R ? xFor(active) - 14 - tipW : tipX;
  const tipY = T_ + 6;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      tabIndex={0}
      aria-label={`Serie diaria de ${count} días. Totales — ${describe} ${tooltipUnit}. Usa las flechas para recorrer los días.`}
      style={{ display: "block", outline: "none" }}
      className="cx-chart"
      onKeyDown={onKeyDown}
      onBlur={() => setHover(null)}
    >
      <defs>
        {series.map((s, si) => (
          <linearGradient key={s.label} id={`${gradientId}-${si}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={s.color} stopOpacity={si === 0 ? 0.2 : 0.16} />
            <stop offset="100%" stopColor={s.color} stopOpacity={0} />
          </linearGradient>
        ))}
      </defs>

      {yTicks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={yFor(t)} y2={yFor(t)} stroke={C.hair2} strokeWidth="1" />
          <text
            x={L - 10}
            y={yFor(t) + 3.5}
            textAnchor="end"
            fontSize={SVG_TEXT.axis}
            fill={C.soft}
            fontFamily={FONT}
            style={NUM}
          >
            {t}
          </text>
        </g>
      ))}

      {/* Areas primero, lineas despues: ninguna linea queda bajo el lavado de
          la otra serie. */}
      {series.map((s, si) => (
        <path
          key={`a-${s.label}`}
          d={`${smoothPath(points(s.values))} L ${xFor(count - 1)} ${baseline} L ${xFor(0)} ${baseline} Z`}
          fill={`url(#${gradientId}-${si})`}
          className="cx-area"
        />
      ))}

      {reference && reference.value > 0 && (
        <g aria-hidden>
          <line
            x1={L}
            x2={W - R}
            y1={yFor(reference.value)}
            y2={yFor(reference.value)}
            stroke={C.faintMark}
            strokeWidth="1"
            strokeDasharray="3 4"
          />
          <text
            x={L + 6}
            y={yFor(reference.value) - 6}
            textAnchor="start"
            fontSize={SVG_TEXT.axis}
            fill={C.soft}
            fontFamily={FONT}
            style={NUM}
          >
            {reference.label}
          </text>
        </g>
      )}

      {series.map((s) => (
        <path
          key={`l-${s.label}`}
          d={smoothPath(points(s.values))}
          fill="none"
          stroke={s.color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          className="cx-line"
        />
      ))}

      {/* Un solo dia: sin vecinos no hay linea que trazar, y el dato quedaria
          invisible. El punto lo hace visible. */}
      {count === 1 &&
        series.map((s) => (
          <circle key={`p-${s.label}`} cx={xFor(0)} cy={yFor(s.values[0])} r={4} fill={s.color} />
        ))}

      {/* Guia y puntos del dia enfocado. */}
      <g
        aria-hidden
        style={{
          pointerEvents: "none",
          opacity: hover === null ? 0 : 1,
          transition: "opacity 140ms ease-out",
        }}
      >
        <line
          x1={xFor(active)}
          x2={xFor(active)}
          y1={T_}
          y2={baseline}
          stroke={C.hairHover}
          strokeWidth="1"
        />
        {series.map((s) => (
          <circle
            key={`d-${s.label}`}
            cx={xFor(active)}
            cy={yFor(s.values[active] ?? 0)}
            r={4.5}
            fill={s.color}
            stroke={C.card}
            strokeWidth="2"
          />
        ))}
      </g>

      <g
        aria-hidden
        style={{
          pointerEvents: "none",
          transform: `translate(${tipLeft}px, ${tipY}px)`,
          opacity: hover === null ? 0 : 1,
          transition: "transform 180ms cubic-bezier(0.16, 1, 0.3, 1), opacity 140ms ease-out",
        }}
      >
        <rect
          width={tipW}
          height={tipH}
          rx={10}
          fill={C.card}
          stroke={C.hair}
          style={{ filter: "drop-shadow(0 6px 14px rgba(35,35,43,0.10))" }}
        />
        <text x={12} y={17} fontSize={SVG_TEXT.axis} fill={C.soft} fontFamily={FONT}>
          {tooltipTop(active)}
        </text>
        {series.map((s, si) => (
          <g key={s.label} transform={`translate(12, ${34 + si * 16})`}>
            <rect y={-7} width="8" height="8" rx="2" fill={s.color} />
            <text x="14" y="0" fontSize={SVG_TEXT.legend} fill={C.body} fontFamily={FONT}>
              {s.label}
            </text>
            {/* El valor en tinta: el cuadrito ya dice de quien es. */}
            <text
              x={tipW - 24}
              y="0"
              textAnchor="end"
              fontSize={SVG_TEXT.legend}
              fontWeight="600"
              fill={C.ink}
              fontFamily={FONT}
              style={NUM}
            >
              {s.values[active] ?? 0}
            </text>
          </g>
        ))}
      </g>

      {ticks.map(([i, label]) => (
        <text
          key={`${i}-${label}`}
          x={xFor(i)}
          y={H - 24}
          textAnchor={i === 0 ? "start" : i === count - 1 ? "end" : "middle"}
          fontSize={SVG_TEXT.axis}
          fill={C.soft}
          fontFamily={FONT}
        >
          {label}
        </text>
      ))}

      {/* Leyenda: con dos series la identidad no puede vivir solo en el color. */}
      <g transform={`translate(${W / 2 - (series.length * 96) / 2}, ${H - 4})`}>
        {series.map((s, si) => (
          <g key={s.label} transform={`translate(${si * 96}, 0)`}>
            <rect y="-6" width="14" height="3" rx="1.5" fill={s.color} />
            <text x="20" y="0" fontSize={SVG_TEXT.legend} fill={C.body} fontFamily={FONT}>
              {s.label}
            </text>
          </g>
        ))}
      </g>

      <rect
        x={L}
        y={T_}
        width={plotW}
        height={plotH}
        fill="transparent"
        onMouseMove={(event) => setHover(indexAt(event))}
        onMouseLeave={() => setHover(null)}
        style={{ cursor: "crosshair" }}
      />
    </svg>
  );
}

/**
 * Curva monotona por los puntos (Fritsch-Carlson), como path SVG.
 *
 * Las tangentes se recortan para que la curva no sobrepase a sus vecinos: entre
 * dos dias la linea nunca sube por encima del mayor ni baja del menor.
 */
function smoothPath(pts: readonly (readonly [number, number])[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`;

  const n = pts.length;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0]);
    slope.push((pts[i + 1][1] - pts[i][1]) / dx[i]);
  }

  const tangent: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i++) {
    tangent.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2);
  }
  tangent.push(slope[n - 2]);

  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = tangent[i] / slope[i];
    const b = tangent[i + 1] / slope[i];
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      tangent[i] = t * a * slope[i];
      tangent[i + 1] = t * b * slope[i];
    }
  }

  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const third = dx[i] / 3;
    d += ` C ${pts[i][0] + third} ${pts[i][1] + tangent[i] * third}, ${pts[i + 1][0] - third} ${
      pts[i + 1][1] - tangent[i + 1] * third
    }, ${pts[i + 1][0]} ${pts[i + 1][1]}`;
  }
  return d;
}
