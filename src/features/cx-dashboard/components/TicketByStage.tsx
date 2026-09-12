import { useState } from "react";
import { COUNTS } from "../mockData";
import { useApplyFilter, type DashboardFilter } from "../filters";
import { C, FONT, NUM, T, hueFor } from "../styles";
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

  const live = COUNTS.open + COUNTS.upcoming + COUNTS.overdue + COUNTS.waitingOnClient;
  const onTime = live - COUNTS.overdue;
  const share = live === 0 ? 0 : onTime / live;

  const bands: Band[] = [
    {
      key: "open",
      label: "En curso",
      value: COUNTS.open,
      color: hueFor("cumplido").color,
      hint: "con plazo holgado",
      filter: { kind: "estado", value: "abiertos", label: "los tickets en curso" },
    },
    {
      key: "upcoming",
      label: "Por vencer",
      value: COUNTS.upcoming,
      color: hueFor("porVencer").color,
      hint: "vencen hoy",
      filter: { kind: "estado", value: "por-vencer", label: "los tickets por vencer" },
    },
    {
      key: "overdue",
      label: "Vencidos",
      value: COUNTS.overdue,
      color: hueFor("vencido").color,
      hint: "fuera de plazo",
      filter: { kind: "estado", value: "vencidos", label: "los tickets vencidos" },
    },
    {
      key: "waiting",
      label: "En espera",
      value: COUNTS.waitingOnClient,
      color: C.faintMark,
      hint: "del cliente",
      filter: { kind: "estado", value: "espera", label: "los tickets en espera" },
    },
  ];

  const active = bands.find((b) => b.key === hover) ?? null;
  const shownBands = bands.filter((b) => b.value > 0);

  return (
    <Card className="cx-hover">
      <CardHead
        title="Cumplimiento de plazo"
        hint="Reparto de los tickets vivos según su estado de plazo. Click en un estado para filtrar la bandeja."
        right={<span style={{ ...T.caption, ...NUM, color: C.body }}>{live} vivos</span>}
      />

      {/* La cifra con su denominador: un porcentaje solo no dice sobre qué está
          calculado, y 92 % de 226 no es lo mismo que 92 % de 12. */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 12 }}>
        <span style={{ ...T.figure, ...NUM, color: C.ink }}>{Math.round(share * 100)}%</span>
        <span style={{ ...T.label, ...NUM, color: C.body }}>
          {onTime} de {live}
        </span>
      </div>

      <div
        aria-hidden
        style={{ display: "flex", gap: 2, height: 8, marginTop: 12 }}
      >
        {shownBands.map((b, i) => (
          <div
            key={b.key}
            onMouseEnter={() => setHover(b.key)}
            onMouseLeave={() => setHover(null)}
            style={{
              flex: b.value,
              background: b.color,
              opacity: hover === null || hover === b.key ? 1 : 0.3,
              borderTopLeftRadius: i === 0 ? 4 : 1,
              borderBottomLeftRadius: i === 0 ? 4 : 1,
              borderTopRightRadius: i === shownBands.length - 1 ? 4 : 1,
              borderBottomRightRadius: i === shownBands.length - 1 ? 4 : 1,
              cursor: "pointer",
              transition: "opacity .15s",
            }}
          />
        ))}
      </div>

      <ul style={{ marginTop: 10 }}>
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
