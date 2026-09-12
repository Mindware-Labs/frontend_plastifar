import { useState } from "react";
import { TOPICS } from "../mockData";
import { SERIES, C, FONT, NUM, T , SVG_TEXT, n } from "../styles";
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

  const SIZE = 150;
  const R = 56;
  const STROKE = 20;
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

      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
        height={SIZE}
        role="img"
        aria-label={`${n(total)} tickets repartidos entre ${visible.length} temas`}
        style={{ display: "block", margin: "10px auto 4px" }}
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
          fontSize={SVG_TEXT.figure}
          fontWeight="700"
          fill={C.ink}
          fontFamily={FONT}
          letterSpacing="-0.5"
          style={NUM}
        >
          {shown ? shown.value : total}
        </text>
        <text x={SIZE / 2} y={SIZE / 2 + 11} textAnchor="middle" fontSize={SVG_TEXT.axis} fill={C.body} fontFamily={FONT}>
          {shown ? `${shownShare}% del total` : "tickets"}
        </text>
      </svg>

      <ul>
        {TOPICS.map((topic) => {
          const hidden = off.includes(topic.label);
          const share = hidden || total === 0 ? null : Math.round((topic.value / total) * 100);
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
                <span style={{ display: "inline-flex", alignItems: "baseline", gap: 7, minWidth: 0, ...T.label, color: C.body }}>
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
                <span style={{ display: "inline-flex", alignItems: "baseline", gap: 7, flexShrink: 0, ...NUM }}>
                  <span style={{ ...T.caption, color: C.soft, width: 26, textAlign: "right" }}>
                    {share === null ? "—" : `${share}%`}
                  </span>
                  <span style={{ ...T.label, fontWeight: 700, color: C.ink, width: 28, textAlign: "right" }}>
                    {topic.value}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
