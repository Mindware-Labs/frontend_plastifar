import { useState } from "react";
import { useDashboard } from "../dashboardContext";
import { useApplyFilter, type DashboardFilter } from "../filters";
import { C, FONT, NUM, T, hueFor, n } from "../styles";
import { Card, CardHead } from "./primitives";

/**
 * Cumplimiento de plazo.
 *
 * Los cuatro tramos SON la partición: `open`, `upcoming`, `overdue` y
 * `waitingOnClient` son excluyentes y suman exactamente los vivos. La barra
 * dice el peso, la lista dice la cifra, y los dos cierran contra el mismo
 * total. (La versión anterior listaba «En plazo» calculado como
 * `vivos − vencidos`, que ya contenía a los otros dos: los cuatro números
 * sumaban 296 contra un total de 226.)
 *
 * El único rojo de la caja es el tramo vencido. Los otros tres no son alarmas.
 */

interface Band {
  key: string;
  label: string;
  value: number;
  color: string;
  hint: string;
  filter: DashboardFilter;
}

export function TicketByStage() {
  const applyFilter = useApplyFilter();
  const [hover, setHover] = useState<string | null>(null);

  const { counts: COUNTS, stage } = useDashboard();

  /* `live` LO MANDA EL SERVIDOR y ya no se recompone sumando los cuatro tramos.
     Esa suma era falsa: «abierto» y «vencido» se solapan —un ticket abierto y
     fuera de plazo esta en los dos— asi que el mismo ticket se contaba dos
     veces y el total de vivos salia inflado. Por eso esta tarjeta y la de
     estados mostraban dos totales distintos de lo mismo. Los vivos son,
     exactamente, los que no estan cerrados. */
  const live = COUNTS.live;
  const onTime = live - COUNTS.overdue;
  const share = live === 0 ? 0 : onTime / live;

  const bands: Band[] = [
    {
      key: "open",
      label: "En curso",
      value: stage.onTrack,
      color: hueFor("cumplido").color,
      hint: "con plazo holgado",
      filter: { kind: "estado", value: "abiertos", label: "los tickets en curso" },
    },
    {
      key: "upcoming",
      label: "Por vencer",
      value: stage.upcoming,
      color: hueFor("porVencer").color,
      hint: "vencen hoy",
      filter: { kind: "estado", value: "por-vencer", label: "los tickets por vencer" },
    },
    {
      key: "overdue",
      label: "Vencidos",
      value: stage.overdue,
      color: hueFor("vencido").color,
      hint: "fuera de plazo",
      filter: { kind: "estado", value: "vencidos", label: "los tickets vencidos" },
    },
    {
      key: "waiting",
      label: "En espera",
      value: stage.waiting,
      color: C.faintMark,
      hint: "del cliente",
      filter: { kind: "estado", value: "espera", label: "los tickets en espera" },
    },
  ];

  const active = bands.find((b) => b.key === hover) ?? null;

  return (
    <Card className="cx-hover">
      <CardHead
        title="Cumplimiento de plazo"
        hint="Reparto de los tickets vivos según su estado de plazo. Click en un estado para filtrar la bandeja."
        right={<span style={{ ...T.caption, ...NUM, color: C.body }}>{live} vivos</span>}
      />

      {/* Medio anillo: la particion entera de los vivos, con el porcentaje en
          plazo en el centro. Tiene techo —el 100 % de los vivos— y por eso es un
          instrumento y no un adorno: el arco se lee contra el arco completo.
          Los tramos van en el mismo orden que la lista de abajo, y el vencido
          cierra el arco a la derecha, donde termina la lectura. */}
      <StageGauge
        bands={gaugeOrder(bands)}
        hover={hover}
        onHover={setHover}
        share={share}
        onTime={onTime}
        live={live}
      />

      <ul style={{ marginTop: 4 }}>
        {bands.map((b, i) => (
          <li key={b.key} style={{ borderTop: i === 0 ? "none" : `1px solid ${C.hair2}` }}>
            <button
              type="button"
              className="cx-link"
              title={`Ver ${b.filter.label}`}
              onClick={() => applyFilter(b.filter)}
              onMouseEnter={() => setHover(b.key)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(b.key)}
              onBlur={() => setHover(null)}
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 10,
                width: "100%",
                padding: "6px 5px",
                border: "none",
                borderRadius: 6,
                background: "transparent",
                textAlign: "left",
                fontFamily: FONT,
                cursor: "pointer",
                opacity: hover !== null && hover !== b.key ? 0.5 : 1,
                transition: "opacity .15s, background .15s",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "baseline", gap: 7, minWidth: 0, ...T.label, color: C.body }}>
                <span
                  aria-hidden
                  style={{
                    width: 7,
                    height: 7,
                    flexShrink: 0,
                    borderRadius: 99,
                    background: b.color,
                    transform: "translateY(-1px)",
                  }}
                />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {b.label}
                </span>
              </span>
              <span style={{ display: "inline-flex", alignItems: "baseline", gap: 7, flexShrink: 0, ...NUM }}>
                <span style={{ ...T.caption, color: C.soft, width: 26, textAlign: "right" }}>
                  {live === 0 ? "—" : `${Math.round((b.value / live) * 100)}%`}
                </span>
                <span style={{ ...T.label, fontWeight: 700, color: C.ink, width: 30, textAlign: "right" }}>
                  {b.value}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* En reposo dice lo único accionable; al enfocar un tramo, lo explica. */}
      <p
        style={{
          marginTop: 8,
          minHeight: 15,
          ...T.caption,
          fontWeight: 500,
          lineHeight: 1.4,
          color: active ? C.body : COUNTS.overdue > 0 ? hueFor("vencido").color : C.soft,
        }}
      >
        {active
          ? `${active.label}: ${active.hint}.`
          : COUNTS.overdue > 0
            ? `${COUNTS.overdue} fuera de plazo — atender primero.`
            : "Nada fuera de plazo."}
      </p>
    </Card>
  );
}

/** En plazo primero; vencido al final, cerrando el arco. */
function gaugeOrder(bands: Band[]): Band[] {
  const order = ["open", "waiting", "upcoming", "overdue"];
  return [...bands].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}

const GW = 240;
const GH = 132;
const GR = 96;
const GSTROKE = 16;
const GCX = GW / 2;
const GCY = GH - 14;

function polar(angle: number): [number, number] {
  return [GCX + GR * Math.cos(angle), GCY - GR * Math.sin(angle)];
}

function arc(from: number, to: number): string {
  const [x0, y0] = polar(from);
  const [x1, y1] = polar(to);
  return `M ${x0} ${y0} A ${GR} ${GR} 0 0 1 ${x1} ${y1}`;
}

function StageGauge({
  bands,
  hover,
  onHover,
  share,
  onTime,
  live,
}: {
  bands: Band[];
  hover: string | null;
  onHover: (key: string | null) => void;
  share: number;
  onTime: number;
  live: number;
}) {
  const visible = bands.filter((b) => b.value > 0);
  /* 2 px de lienzo entre tramos, medidos sobre el arco y pasados a angulo. */
  const gap = visible.length > 1 ? 2.5 / GR : 0;
  const span = Math.PI - gap * (visible.length - 1);

  const segments = visible.reduce<{ band: Band; from: number; to: number }[]>((acc, b) => {
    const from = acc.length === 0 ? Math.PI : acc[acc.length - 1].to - gap;
    const length = live === 0 ? 0 : (b.value / live) * span;
    return [...acc, { band: b, from, to: from - length }];
  }, []);

  const active = bands.find((b) => b.key === hover) ?? null;

  return (
    <svg
      viewBox={`0 0 ${GW} ${GH}`}
      width="100%"
      role="img"
      aria-label={`${Math.round(share * 100)}% de los tickets vivos en plazo: ${onTime} de ${live}.`}
      style={{ display: "block", maxWidth: 260, margin: "4px auto 0" }}
    >
      <path d={arc(Math.PI, 0)} fill="none" stroke={C.rail} strokeWidth={GSTROKE} strokeLinecap="round" />

      {segments.map(({ band, from, to }, i) => (
        <path
          key={band.key}
          d={arc(from, to)}
          fill="none"
          stroke={band.color}
          strokeWidth={GSTROKE}
          /* Solo los extremos del arco completo llevan punta redonda: con punta
             en cada tramo dejarian de leerse como partes de un mismo arco. */
          strokeLinecap={segments.length === 1 || i === 0 || i === segments.length - 1 ? "round" : "butt"}
          opacity={hover === null || hover === band.key ? 1 : 0.3}
          onMouseEnter={() => onHover(band.key)}
          onMouseLeave={() => onHover(null)}
          style={{ cursor: "pointer", transition: "opacity .15s" }}
        />
      ))}

      <text
        x={GCX}
        y={GCY - 22}
        textAnchor="middle"
        fontSize={30}
        fontWeight={600}
        letterSpacing="-0.8"
        fill={C.ink}
        fontFamily={FONT}
        style={NUM}
      >
        {active
          ? n(active.value)
          : live === 0
            ? "—"
            : `${Math.round(share * 100)}%`}
      </text>
      <text x={GCX} y={GCY - 4} textAnchor="middle" fontSize={11} fill={C.soft} fontFamily={FONT} style={NUM}>
        {active ? active.label.toLowerCase() : `en plazo · ${n(onTime)} de ${n(live)}`}
      </text>
    </svg>
  );
}
