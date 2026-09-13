import { useState } from "react";
import { TOPICS } from "../mockData";
import { SERIES, C, FONT, NUM, S, T, n } from "../styles";
import { Card, CardHead } from "./primitives";

/**
 * Por qué se abre un ticket, como anillo.
 *
 * Anillo y no torta: el agujero del centro es donde vive el total, que es la
 * cifra que se mira primero. Una torta llena obliga a repetir ese total afuera.
 *
 * Dinámico en las dos direcciones. Al pasar por un tema, el resto se atenúa y
 * el centro muestra ese tema con su participación. Al hacer click, se filtra la
 * bandeja por él — y el renglón ofrece las dos cosas: el botón navega, y el
 * ojal de «excluir» a la derecha lo saca del cálculo sin salir de la pantalla.
 * Los porcentajes se recalculan sobre lo que queda visible, no sobre el total
 * original: un anillo que muestra participaciones de un total que ya no está
 * dibujado está mintiendo.
 */
export function TicketByCategory() {
  const [off, setOff] = useState<string[]>([]);
  const [hover, setHover] = useState<string | null>(null);

  const toggle = (label: string) =>
    setOff((current) =>
      current.includes(label) ? current.filter((x) => x !== label) : [...current, label],
    );

  const visible = TOPICS.filter((t) => !off.includes(t.label));
  const total = visible.reduce((sum, t) => sum + t.value, 0);

  /* El anillo necesita aire para leerse como una figura y no como un adorno
     apretado contra la lista. Lo paga la TIPOGRAFIA de la lista, no el anillo:
     bajando el texto un paso se libera el ancho que antes truncaba «Reclamo de
     calidad», y con eso el anillo puede volver a 124 y ademas llevarse un
     margen propio. */
  const SIZE = 124;
  const R = 46;
  const STROKE = 16;
  const CIRC = 2 * Math.PI * R;
  const GAP = visible.length > 1 ? 3 : 0;

  const segments = visible.reduce<{ offset: number; list: { label: string; length: number; offset: number }[] }>(
    (acc, topic) => {
      const length = total === 0 ? 0 : (topic.value / total) * CIRC;
      return {
        offset: acc.offset + length,
        list: [...acc.list, { label: topic.label, length, offset: acc.offset }],
      };
    },
    { offset: 0, list: [] },
  ).list;

  const colorOf = (label: string) => SERIES[TOPICS.findIndex((t) => t.label === label) % SERIES.length];

  const shown = hover ? TOPICS.find((t) => t.label === hover) : null;
  const shownShare = shown && total > 0 ? Math.round((shown.value / total) * 100) : 0;

  return (
    <Card className="cx-hover">
      <CardHead
        title="Tickets por tema"
        hint="Los cinco temas con más tickets en la ventana. Click en un tema para incluirlo o excluirlo del total."
        right={
          off.length > 0 ? (
            <button
              type="button"
              onClick={() => setOff([])}
              style={{
                border: "none",
                background: "transparent",
                padding: 0,
                ...T.caption,
                fontFamily: FONT,
                color: C.body,
                cursor: "pointer",
                textDecoration: "underline",
                textUnderlineOffset: 2,
              }}
            >
              Mostrar {off.length} oculto{off.length > 1 ? "s" : ""}
            </button>
          ) : undefined
        }
      />

      {/* Anillo a la izquierda, temas a la derecha.
          Apilados, el anillo se comia ciento cincuenta pixeles de alto para
          decir una cifra que la lista repite renglon por renglon, y la tarjeta
          quedaba mas alta que su vecina sin ganar densidad. Lado a lado, la
          altura la fija la lista —que es el contenido real— y el anillo ocupa
          un hueco que de todos modos estaba vacio.

          `flex-wrap` es la salida cuando la columna se angosta: bajo cierto
          ancho la lista se queda sin sitio para el nombre del tema, y ahi es
          mejor volver a apilar que truncarlo todo. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: S.lg,
          flexWrap: "wrap",
          marginTop: 2,
        }}
      >
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
        height={SIZE}
        role="img"
        aria-label={`${n(total)} tickets repartidos entre ${visible.length} temas`}
        style={{ display: "block", flexShrink: 0, margin: "4px 10px 4px 2px" }}
      >
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke={C.rail} strokeWidth={STROKE} />

        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          {segments.map((seg) => {
            const length = Math.max(seg.length - GAP, 0);
            return (
              <circle
                key={seg.label}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                stroke={colorOf(seg.label)}
                strokeWidth={STROKE}
                strokeDasharray={`${length} ${CIRC - length}`}
                strokeDashoffset={-seg.offset}
                opacity={hover !== null && hover !== seg.label ? 0.3 : 1}
                onMouseEnter={() => setHover(seg.label)}
                onMouseLeave={() => setHover(null)}
                style={{
                  cursor: "pointer",
                  transition: "opacity .15s, stroke-dasharray .3s, stroke-dashoffset .3s",
                }}
              />
            );
          })}
          {segments.map((seg) => {
            const length = Math.max(seg.length - GAP, 0);
            return (
              <circle
                key={`on-${seg.label}`}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                stroke={colorOf(seg.label)}
                strokeWidth={STROKE + 4}
                strokeDasharray={`${length} ${CIRC - length}`}
                strokeDashoffset={-seg.offset}
                opacity={hover === seg.label ? 1 : 0}
                style={{
                  pointerEvents: "none",
                  transition: "opacity .15s, stroke-dasharray .3s, stroke-dashoffset .3s",
                }}
              />
            );
          })}
        </g>

        <text
          x={SIZE / 2}
          y={SIZE / 2 - 4}
          textAnchor="middle"
          fontSize={17}
          fontWeight="600"
          fill={C.ink}
          fontFamily={FONT}
          letterSpacing="-0.5"
          style={NUM}
        >
          {shown ? shown.value : total}
        </text>
        <text x={SIZE / 2} y={SIZE / 2 + 13} textAnchor="middle" fontSize={10} fill={C.soft} fontFamily={FONT}>
          {shown ? `${shownShare}% del total` : "tickets"}
        </text>
      </svg>

      <ul style={{ flex: 1, minWidth: 168 }}>
        {TOPICS.map((topic) => {
          const hidden = off.includes(topic.label);
          return (
            <li
              key={topic.label}
              style={{ display: "flex", alignItems: "center", gap: 4, opacity: hidden ? 0.45 : 1 }}
            >
              <button
                type="button"
                className="cx-link"
                title={`Ver los tickets de ${topic.label}`}
                onClick={() => toggle(topic.label)}
                onMouseEnter={() => !hidden && setHover(topic.label)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => !hidden && setHover(topic.label)}
                onBlur={() => setHover(null)}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 8,
                  flex: 1,
                  minWidth: 0,
                  padding: "5px 5px",
                  border: "none",
                  borderRadius: 6,
                  background: "transparent",
                  textAlign: "left",
                  fontFamily: FONT,
                  cursor: "pointer",
                  transition: "background .15s",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "baseline", gap: 7, minWidth: 0, ...T.label, fontSize: 11.5, color: C.body }}>
                  <span
                    aria-hidden
                    style={{
                      width: 7,
                      height: 7,
                      flexShrink: 0,
                      borderRadius: 2,
                      background: colorOf(topic.label),
                      transform: "translateY(-1px)",
                    }}
                  />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {topic.label}
                  </span>
                </span>
                {/* El porcentaje se fue de la fila.
                    Era exactamente lo que el anillo de al lado ya dibuja, y en
                    una columna angosta se estaba pagando con el nombre del tema:
                    medido, «Reclamo de calidad» pedía 105 px y tenía 95. Cuando
                    falta espacio, lo primero que se saca es el número que el
                    gráfico ya dice — no el rótulo que sólo dice el texto.

                    Sigue disponible donde hace falta: al pasar por un tema, el
                    centro del anillo muestra su participación. */}
                <span
                  style={{
                    ...T.label,
                    ...NUM,
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: C.ink,
                    flexShrink: 0,
                    width: 28,
                    textAlign: "right",
                  }}
                >
                  {topic.value}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      </div>
    </Card>
  );
}
