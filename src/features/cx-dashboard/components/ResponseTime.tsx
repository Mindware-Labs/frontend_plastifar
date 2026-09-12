import { useMemo } from "react";
import { series } from "../mockData";
import { C, CHART_H, FONT, NUM, S, SVG_TEXT, T, hueFor } from "../styles";
import { Card, CardHead } from "./primitives";
import { smoothPath } from "./curve";

const LIMIT = 240;

/**
 * Tiempo de primera respuesta contra su acuerdo.
 *
 * Las tres cifras dejaron de ser números sueltos y pasaron a sub-tarjetas con
 * su propio borde. Eso crea un nivel de jerarquía que antes no existía: sin él
 * todo dentro de la tarjeta pesaba igual y el ojo no sabía dónde entrar.
 *
 * El rojo acá SÍ trabaja —el incumplimiento del acuerdo es uno de sus tres usos
 * reservados— pero se gasta con criterio: la línea del límite y los puntos que
 * la cruzan son rojos, la serie es tinta. Con la curva entera roja, los tres
 * incumplimientos no se verían.
 */
export function ResponseTime() {
  const data = useMemo(() => series(77, 14, 90, 250), []);

  const W = 620;
  const H = CHART_H.side;
  const L = 40;
  const R = 16;
  const TOP = 16;
  const B = 36;
  const max = 280;
  const plotW = W - L - R;
  const plotH = H - TOP - B;
  const x = (i: number) => L + (i / (data.length - 1)) * plotW;
  const y = (v: number) => TOP + plotH - (v / max) * plotH;

  const points = data.map((v, i) => [x(i), y(v)] as const);
  const line = smoothPath(points);
  const area = `${line} L ${x(data.length - 1)} ${TOP + plotH} L ${L} ${TOP + plotH} Z`;
  const avg = Math.round(data.reduce((a, b) => a + b, 0) / data.length);
  const breaches = data.filter((v) => v > LIMIT).length;

  const bad = hueFor("vencido");
  const serie = hueFor("abierto");
  const good = hueFor("cumplido");

  /* De mayor a menor: un eje que sube es un eje al revés. */
  const ticks = [280, 210, 140, 70, 0];

  return (
    <Card className="cx-hover">
      <CardHead
        title="Primera respuesta"
        hint="Tiempo hasta el primer contacto con el cliente, contra el límite acordado de 4 minutos."
      />

      {/* Tres sub-tarjetas, no tres cifras sueltas: el borde propio las agrupa
          y las separa del resto del contenido. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: S.md,
          marginBottom: S.lg,
        }}
      >
        <SubCard label="Promedio" value={`${Math.floor(avg / 60)}m ${avg % 60}s`} note="por ticket" />
        <SubCard label="Límite" value="4m 00s" note="acordado" />
        <SubCard
          label="Incumplen"
          value={breaches > 0 ? String(breaches) : "Ninguno"}
          note={breaches > 0 ? "sobre el límite" : "dentro del acuerdo"}
          background={breaches > 0 ? bad.tint : good.tint}
          tone={breaches > 0 ? bad.color : good.color}
        />
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`Primera respuesta: promedio ${avg} segundos, ${breaches} sobre el límite de ${LIMIT}`}
        style={{ display: "block" }}
      >
        <defs>
          <linearGradient id="cx-rt-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={serie.color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={serie.color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Sólo rejilla horizontal. La vertical no ayuda a comparar alturas. */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={C.hair2} />
            <text
              x={L - 8}
              y={y(t) + 3.5}
              textAnchor="end"
              fontSize={SVG_TEXT.axis}
              fill={C.soft}
              fontFamily={FONT}
              style={NUM}
            >
              {t}s
            </text>
          </g>
        ))}

        <line
          x1={L}
          x2={W - R}
          y1={y(LIMIT)}
          y2={y(LIMIT)}
          stroke={bad.color}
          strokeWidth="1.2"
          strokeDasharray="4 4"
        />

        <path d={area} fill="url(#cx-rt-fill)" />
        <path d={line} fill="none" stroke={serie.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {data.map((v, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(v)}
            r="2.6"
            fill={C.card}
            stroke={v > LIMIT ? bad.color : serie.color}
            strokeWidth="1.8"
          />
        ))}

        {/* Leyenda centrada debajo: marcador de línea corta más punto. */}
        <g transform={`translate(${W / 2 - 82}, ${H - 10})`}>
          <line x1="0" x2="14" y1="-4" y2="-4" stroke={serie.color} strokeWidth="2" />
          <circle cx="7" cy="-4" r="2.6" fill={C.card} stroke={serie.color} strokeWidth="1.8" />
          <text x="20" y="0" fontSize={SVG_TEXT.legend} fill={C.body} fontFamily={FONT}>
            Respuesta
          </text>
          <line x1="94" x2="108" y1="-4" y2="-4" stroke={bad.color} strokeWidth="1.6" strokeDasharray="4 3" />
          <text x="114" y="0" fontSize={SVG_TEXT.legend} fill={C.body} fontFamily={FONT}>
            Límite
          </text>
        </g>
      </svg>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

function SubCard({
  label,
  value,
  note,
  background,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  background?: string;
  tone?: string;
}) {
  return (
    <div
      style={{
        border: `1px solid ${background ? "transparent" : C.hair2}`,
        borderRadius: 10,
        padding: "10px 12px",
        background: background ?? "transparent",
      }}
    >
      <div style={{ ...T.label, color: tone ?? C.body }}>{label}</div>
      <div style={{ ...T.figure, ...NUM, color: tone ?? C.ink, margin: "6px 0 4px" }}>{value}</div>
      <div style={{ ...T.caption, color: tone ?? C.soft }}>{note}</div>
    </div>
  );
}
