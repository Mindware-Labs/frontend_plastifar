import { useState } from "react";
import { C, CHART_H, FONT, NUM, SVG_TEXT, hueFor } from "../styles";

export interface BarSeries {
  /** Nombre de la serie. Va en la leyenda y en el tooltip. */
  label: string;
  values: number[];
  color: string;
}

/**
 * Gráfica de barras agrupadas, dibujada a mano.
 *
 * Sin librería a propósito: cada coordenada se calcula acá, así que la
 * geometría es la que se quiso — ancho de barra, tooltip que se recorta contra
 * el área de dibujo, y franjas invisibles que hacen enfocable la columna entera
 * y no sólo la barra.
 *
 * ------------------------------------------------------------------
 * UN SOLO EJE, SIEMPRE
 * ------------------------------------------------------------------
 * Las dos series comparten escala porque miden LO MISMO: tickets por día. Ese
 * es el requisito para poder compararlas de un vistazo, y es también la razón
 * por la que acá no hay —ni puede haber— un segundo eje a la derecha. Dos
 * escalas distintas en un mismo dibujo dejan que cualquiera de las dos parezca
 * mayor con sólo elegir los topes, y entonces el cruce entre las curvas no
 * significa nada.
 *
 * ------------------------------------------------------------------
 * NADA SE ATENÚA, Y EL DETALLE SE PIDE
 * ------------------------------------------------------------------
 * Las barras se ven todas al mismo peso, siempre. Atenuar veintisiete columnas
 * para destacar una convierte la gráfica en un solo dato con ruido alrededor,
 * cuando lo que se vino a leer acá es la FORMA de las dos series a lo largo del
 * mes: el ojo compara alturas, y no puede comparar lo que está apagado.
 *
 * El color tampoco cambia al pasar el cursor. Con dos series eso es
 * inadmisible: el color ES la identidad de la serie, y si además marcara el
 * foco, un azul oscuro y un azul claro pasarían a ser dos cosas distintas según
 * dónde esté el mouse.
 *
 * El detalle del día aparece al pasar por encima y se va al salir. En reposo la
 * tarjeta muestra la serie limpia y el total en la cabecera, que es todo lo que
 * hace falta sin preguntar.
 *
 * Rejilla SOLO horizontal: la vertical no ayuda a comparar alturas, que es para
 * lo que existe una barra. Eje de mayor a menor, porque un eje que sube al
 * subir es un eje al revés.
 */
export function BarChart({
  series,
  max,
  ticks,
  tooltipTop,
  tooltipUnit,
  height = CHART_H.main,
}: {
  /** Dos series como máximo: con tres, las barras de cada día dejan de medirse. */
  series: [BarSeries, BarSeries] | [BarSeries];
  max: number;
  ticks: [number, string][];
  tooltipTop: (index: number) => string;
  tooltipUnit: string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  /* En reposo no hay columna activa: la serie se ve entera y el detalle aparece
     sólo cuando alguien lo pide. `0` es el ancla de posición del tooltip
     mientras está oculto, para que su primera aparición no venga volando desde
     una esquina. */
  const active = hover ?? 0;

  const count = series[0].values.length;

  const W = 900;
  const H = height;
  const L = 46;
  const R = 16;
  /* El tooltip vive en esta franja. */
  const T_ = 34;
  const B = 42;

  const plotW = W - L - R;
  const plotH = H - T_ - B;
  const slot = plotW / count;

  /* El grupo ocupa el 82 % del hueco y adentro las barras se separan 2 px: sin
     ese aire, dos barras contiguas del mismo alto se leen como una sola ancha. */
  const GAP = 2;
  const groupW = Math.min(26, slot * 0.82);
  const barW = (groupW - GAP * (series.length - 1)) / series.length;

  const yFor = (v: number) => T_ + plotH - (v / max) * plotH;
  const cx = (i: number) => L + slot * i + slot / 2;
  /** Borde izquierdo de la barra `s` dentro del grupo `i`. */
  const barX = (i: number, s: number) => cx(i) - groupW / 2 + s * (barW + GAP);

  /* De mayor a menor. */
  const yTicks = [1, 0.75, 0.5, 0.25, 0].map((f) => Math.round(max * f));

  const tipW = series.length > 1 ? 146 : 110;
  const tipH = series.length > 1 ? 58 : 42;
  const tipX = Math.min(Math.max(cx(active) - tipW / 2, L), W - R - tipW);
  const topOfGroup = Math.min(...series.map((s) => yFor(s.values[active])));
  const tipY = Math.max(topOfGroup - tipH - 8, 2);

  const describe = series
    .map((s) => `${s.label}: ${s.values.reduce((a, b) => a + b, 0)}`)
    .join("; ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={`Comparación diaria de ${count} días. Totales — ${describe} ${tooltipUnit}.`}
      style={{ display: "block" }}
      onMouseLeave={() => setHover(null)}
    >
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

      {series.map((s, si) =>
        s.values.map((v, i) => (
          <rect
            key={`b${si}-${i}`}
            x={barX(i, si)}
            y={yFor(v)}
            width={barW}
            height={T_ + plotH - yFor(v)}
            rx={3}
            fill={s.color}
          />
        )),
      )}

      {/* El tooltip VIAJA entre columnas en vez de parpadear en el sitio nuevo.
          Con un salto seco se lee como veintiocho globos distintos; deslizándose
          se lee como una sonda única recorriendo la serie, que es lo que es. */}
      <g
        style={{
          pointerEvents: "none",
          transform: `translate(${tipX}px, ${tipY}px)`,
          opacity: hover === null ? 0 : 1,
          transition:
            "transform 180ms cubic-bezier(0.16, 1, 0.3, 1), opacity 140ms ease-out",
        }}
      >
        <rect width={tipW} height={tipH} rx={8} fill={C.card} stroke={C.hair} />
        <text
          x={tipW / 2}
          y={15}
          textAnchor="middle"
          fontSize={SVG_TEXT.axis}
          fill={C.soft}
          fontFamily={FONT}
        >
          {tooltipTop(active)}
        </text>

        {series.map((s, si) => (
          <g key={s.label} transform={`translate(12, ${30 + si * 15})`}>
            <rect y={-7} width="8" height="8" rx="2" fill={s.color} />
            <text x="14" y="0" fontSize={SVG_TEXT.legend} fill={C.body} fontFamily={FONT}>
              {s.label}
            </text>
            {/* El valor en tinta, nunca en el color de su serie: el cuadrito de
                al lado ya dice de quién es, y un número coloreado compite con
                las barras por el mismo significado. */}
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
              {s.values[active]}
            </text>
          </g>
        ))}
      </g>

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

      {/* Leyenda centrada debajo. Con dos series deja de ser opcional: sin ella
          la identidad viviría sólo en el color. */}
      <g transform={`translate(${W / 2 - (series.length * 92) / 2}, ${H - 4})`}>
        {series.map((s, si) => (
          <g key={s.label} transform={`translate(${si * 92}, 0)`}>
            <rect y="-8" width="12" height="8" rx="2.5" fill={s.color} />
            <text x="18" y="0" fontSize={SVG_TEXT.legend} fill={C.body} fontFamily={FONT}>
              {s.label}
            </text>
          </g>
        ))}
      </g>

      {series[0].values.map((_, i) => (
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

/** El azul y el verde de serie, ya validados como par: ΔE 21 en deuteranopía. */
export const SERIES_IN = hueFor("abierto").color;
export const SERIES_OUT = hueFor("cumplido").color;
