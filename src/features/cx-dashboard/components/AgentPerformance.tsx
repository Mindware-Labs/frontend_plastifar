import { useMemo, useState } from "react";
import { AGENTS } from "../mockData";
import { useApplyFilter } from "../filters";
import { AVATAR, C, FONT, NUM, T, hueFor } from "../styles";
import { Avatar, Card, CardHead, Select } from "./primitives";

/**
 * Carga por responsable.
 *
 * Mide lo que el sistema sabe: cuántos cerró cada quien en la ventana, cuántos
 * tiene en cola ahora y cuántos de esos están vencidos. No hay «meta», porque
 * ningún endpoint define una.
 *
 * Los vencidos son el dato que hace accionable el panel — cerrar mucho con ocho
 * vencidos encima no es buen desempeño, es una cola mal repartida — y son lo
 * único rojo de la caja. Cero vencidos NO se pinta de verde: la ausencia de un
 * problema no es un logro que merezca color.
 */
export function AgentPerformance() {
  const applyFilter = useApplyFilter();
  const [sortBy, setSortBy] = useState("Cerrados");
  const sorted = useMemo(() => {
    const list = [...AGENTS];
    if (sortBy === "Vencidos") return list.sort((a, b) => b.overdue - a.overdue);
    if (sortBy === "En cola") return list.sort((a, b) => b.open - a.open);
    return list.sort((a, b) => b.closed - a.closed);
  }, [sortBy]);

  const maxClosed = Math.max(...AGENTS.map((a) => a.closed), 1);

  return (
    <Card className="cx-hover">
      <CardHead
        title="Carga por responsable"
        hint="Tickets resueltos contra meta, con los vencidos de cada quien."
        right={
          <Select
            value={sortBy}
            onChange={setSortBy}
            options={["Cerrados", "En cola", "Vencidos"]}
            label="Ordenar por"
          />
        }
      />
      <ul style={{ marginTop: 8 }}>
        {sorted.map((a, i) => (
          <li key={a.id} style={{ borderTop: i === 0 ? "none" : `1px solid ${C.hair2}` }}>
            <button
              type="button"
              className="cx-link"
              title={`Ver los tickets de ${a.name}`}
              onClick={() =>
                applyFilter({
                  kind: "responsable",
                  value: String(a.id),
                  label: `los tickets de ${a.name}`,
                })
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                width: "100%",
                padding: "7px 5px",
                border: "none",
                borderRadius: 6,
                background: "transparent",
                textAlign: "left",
                fontFamily: FONT,
                cursor: "pointer",
                transition: "background .15s",
              }}
            >
              <Avatar name={a.name} index={a.id - 1} size={26} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      ...T.label,
                      fontWeight: 700,
                      color: C.ink,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {a.name}
                  </span>
                  <span style={{ flexShrink: 0, ...T.label, ...NUM, fontWeight: 600, color: C.ink }}>
                    {a.closed}
                  </span>
                </span>

                <span
                  aria-hidden
                  style={{
                    display: "block",
                    height: 3,
                    borderRadius: 99,
                    background: C.rail,
                    margin: "4px 0",
                    overflow: "hidden",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      height: "100%",
                      width: `${(a.closed / maxClosed) * 100}%`,
                      borderRadius: 99,
                      background: AVATAR[(a.id - 1) % AVATAR.length],
                    }}
                  />
                </span>

                <span
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 8,
                    ...T.caption,
                    ...NUM,
                  }}
                >
                  <span
                    style={{
                      color: C.soft,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {a.role} · {a.open} en cola
                  </span>
                  <span
                    style={{
                      flexShrink: 0,
                      fontWeight: 700,
                      color: a.overdue === 0 ? C.soft : hueFor("vencido").color,
                    }}
                  >
                    {a.overdue} venc.
                  </span>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
