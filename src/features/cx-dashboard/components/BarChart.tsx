import { useState } from "react";
import { C, CHART_H, FONT, NUM, SVG_TEXT, hueFor } from "../styles";

/**
 * Gráfica de barras dibujada a mano.
 *
 * Sin librería a propósito: cada coordenada se calcula acá, así que la
 * geometría es la que se quiso — ancho de barra, tooltip que se recorta contra
 * el área de dibujo, y franjas invisibles que hacen enfocable la columna entera
 * y no sólo la barra.
 *
 * Rejilla SOLO horizontal: la vertical no ayuda a comparar alturas, que es para
 * lo que existe una barra. Eje de mayor a menor, porque un eje que sube al
 * subir es un eje al revés.
 *
 * Ninguna barra es roja. Una serie temporal no es una alarma: el reposo es el
 * tinte del azul y la activa lleva el degradado del mismo tono.
 */
export function BarChart({
  data,
  max,
  ticks,
  defaultIndex,
  tooltipTop,
  tooltipUnit,
  height = CHART_H.main,
}: {
  data: number[];
  max: number;
  ticks: [number, string][];
  defaultIndex: number;
  tooltipTop: (index: number) => string;
  tooltipUnit: string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const active = hover ?? defaultIndex;

  const W = 900;
  const H = height;
  const L = 46;
  const R = 16;
  const T_ = 44;
  const B = 46;

  const plotW = W - L - R;
  const plotH = H - T_ - B;
  const slot = plotW / data.length;
  const barW = Math.min(16, slot * 0.55);
  const yFor = (v: number) => T_ + plotH - (v / max) * plotH;
  const cx = (i: number) => L + slot * i + slot / 2;

  const avg = data.reduce((a, b) => a + b, 0) / data.length;
  const avgY = yFor(avg);
  /* De mayor a menor. */
  const yTicks = [1, 0.75, 0.5, 0.25, 0].map((f) => Math.round(max * f));

  const tipW = 104;
  const tipX = Math.min(Math.max(cx(active) - tipW / 2, L), W - R - tipW);
  const tipY = Math.max(yFor(data[active]) - 50, 2);

  const hue = hueFor("abierto");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={`Serie de ${data.length} puntos, promedio ${Math.round(avg)} ${tooltipUnit}`}
      style={{ display: "block" }}
      onMouseLeave={() => setHover(null)}
    >
      <defs>
        <linearGradient id="cx-bar-active" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={hue.color} />
          <stop offset="100%" stopColor={C.ink} />
        </linearGradient>
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

      {data.map((v, i) => (
        <rect
          key={`b${i}`}
          x={cx(i) - barW / 2}
          y={yFor(v)}
          width={barW}
          height={T_ + plotH - yFor(v)}
          rx={3}
          fill={i === active ? "url(#cx-bar-active)" : C.barRest}
          style={{ transition: "fill 180ms ease-out" }}
        />
      ))}

      <line x1={L} x2={W - R} y1={avgY} y2={avgY} stroke={C.ink} strokeOpacity="0.2" strokeWidth="1" strokeDasharray="4 4" />

      {/* El tooltip VIAJA entre columnas en vez de parpadear en el sitio nuevo.
          Con un salto seco se lee como veintiocho globos distintos; deslizándose
          se lee como una sonda única recorriendo la serie, que es lo que es.
          Va en un `<g>` con `transform`: el contenido se dibuja en el origen y
          sólo se anima la traslación, sin recalcular geometría por cuadro. */}
      <g
        style={{
          pointerEvents: "none",
          transform: `translate(${tipX}px, ${tipY}px)`,
          transition: "transform 180ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <rect width={tipW} height={42} rx={8} fill={C.card} stroke={C.hair} />
        <text x={tipW / 2} y={16} textAnchor="middle" fontSize={SVG_TEXT.axis} fill={C.soft} fontFamily={FONT}>
          {tooltipTop(active)}
        </text>
        <text
          x={tipW / 2}
          y={32}
          textAnchor="middle"
          fontSize={SVG_TEXT.legend}
          fontWeight="700"
          fill={C.ink}
          fontFamily={FONT}
          style={NUM}
        >
          {data[active]} {tooltipUnit}
        </text>
      </g>

      {/* La barra activa acompaña: el relleno cruza de reposo a tinta en el
          mismo tiempo que tarda el tooltip en llegar. */}
      {ticks.map(([i, label]) => (
        <text
          key={label}
          x={cx(i)}
          y={H - 22}
          textAnchor="middle"
          fontSize={SVG_TEXT.axis}
          fill={C.soft}
          fontFamily={FONT}
        >
          {label}
        </text>
      ))}

      {/* Leyenda centrada debajo. */}
      <g transform={`translate(${W / 2 - 96}, ${H - 4})`}>
        <rect x="0" y="-8" width="12" height="8" rx="2" fill={C.barRest} />
        <text x="18" y="0" fontSize={SVG_TEXT.legend} fill={C.body} fontFamily={FONT}>
          Entrados
        </text>
        <line x1="92" x2="108" y1="-4" y2="-4" stroke={C.ink} strokeOpacity="0.2" strokeWidth="1.6" strokeDasharray="4 3" />
        <text x="114" y="0" fontSize={SVG_TEXT.legend} fill={C.body} fontFamily={FONT}>
          Promedio
        </text>
      </g>

      {data.map((_, i) => (
        <rect
          key={`h${i}`}
          x={L + slot * i}
          y={T_ - 10}
          width={slot}
          height={plotH + 10}
          fill="transparent"
          onMouseEnter={() => setHover(i)}
          style={{ cursor: "pointer" }}
        />
      ))}
    </svg>
  );
}
