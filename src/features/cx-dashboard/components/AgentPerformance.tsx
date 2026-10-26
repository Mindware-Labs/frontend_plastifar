import { useMemo, useState } from "react";
import { colorIndex, useDashboard } from "../dashboardContext";
import { useApplyFilter } from "../filters";
import { AVATAR, C, FONT, NUM, T, hueFor, n } from "../styles";
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

/** Nombre flexible y tres columnas de cifras de ancho fijo, alineadas entre filas. */
const COLS = "minmax(0, 1fr) 58px 52px 40px";

export function AgentPerformance() {
  const applyFilter = useApplyFilter();
  const { agents: AGENTS } = useDashboard();
  const [sortBy, setSortBy] = useState("Cerrados");
  const sorted = useMemo(() => {
    const list = [...AGENTS];
    if (sortBy === "Vencidos") return list.sort((a, b) => b.overdue - a.overdue);
    if (sortBy === "En cola") return list.sort((a, b) => b.open - a.open);
    return list.sort((a, b) => b.closed - a.closed);
  }, [AGENTS, sortBy]);

  const maxClosed = Math.max(...AGENTS.map((a) => a.closed), 1);

  return (
    <Card className="cx-hover">
      <CardHead
        title="Carga por responsable"
        hint="Por responsable: tickets cerrados en la ventana, su cola de ahora y cuántos de esos están vencidos. Click en una persona para ver sus tickets."
        right={
          <Select
            value={sortBy}
            onChange={setSortBy}
            options={["Cerrados", "En cola", "Vencidos"]}
            label="Ordenar por"
          />
        }
      />
      {/* Todas las filas a la vista, sin scroll dentro de la tarjeta: un riel
          dentro de otro riel se veia como un error, y esconder responsables
          detras de un scroll es esconder carga. */}
      {/* Tres cifras por persona, en columnas con rotulo. Antes viajaban en dos
          renglones —«12» arriba a la derecha, «3 en cola» y «1 venc.» abajo— y
          comparar la cola de dos personas obligaba a leer frases. En columna,
          el ojo baja por una sola fila de numeros alineados. */}
      <div
        aria-hidden
        style={{
          display: "grid",
          gridTemplateColumns: COLS,
          alignItems: "end",
          gap: 8,
          padding: "0 5px 6px",
          ...T.micro,
          color: C.soft,
        }}
      >
        <span>Responsable</span>
        <span style={{ textAlign: "right" }}>Cerrados</span>
        <span style={{ textAlign: "right" }}>En cola</span>
        <span style={{ textAlign: "right" }}>Venc.</span>
      </div>

      <ul>
        {sorted.map((a) => (
          <li key={a.id} style={{ borderTop: `1px solid ${C.hair2}` }}>
            <button
              type="button"
              className="cx-link"
              title={`Ver los tickets de ${a.name}`}
              aria-label={`${a.name}: ${a.closed} cerrados, ${a.open} en cola, ${a.overdue} vencidos`}
              onClick={() =>
                applyFilter({
                  kind: "responsable",
                  value: String(a.id),
                  label: `los tickets de ${a.name}`,
                })
              }
              style={{
                display: "grid",
                gridTemplateColumns: COLS,
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "8px 5px",
                border: "none",
                borderRadius: 6,
                background: "transparent",
                textAlign: "left",
                fontFamily: FONT,
                cursor: "pointer",
                transition: "background .15s",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                <Avatar name={a.name} index={colorIndex(a.id, AVATAR.length)} size={28} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      display: "block",
                      ...T.label,
                      fontWeight: 600,
                      color: C.ink,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {a.name}
                  </span>
                  {/* Cuanto cerro contra quien mas cerro: la barra compara a las
                      personas entre si, la cifra de la columna dice cuanto. */}
                  <span
                    aria-hidden
                    style={{
                      display: "block",
                      height: 3,
                      borderRadius: 99,
                      background: C.rail,
                      margin: "5px 0 4px",
                      overflow: "hidden",
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        height: "100%",
                        width: `${(a.closed / maxClosed) * 100}%`,
                        borderRadius: 99,
                        background: hueFor("cumplido").color,
                      }}
                    />
                  </span>
                  <span
                    style={{
                      display: "block",
                      ...T.caption,
                      color: C.soft,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {a.role}
                  </span>
                </span>
              </span>
              <span style={{ ...T.label, ...NUM, fontWeight: 600, color: C.ink, textAlign: "right" }}>
                {n(a.closed)}
              </span>
              <span style={{ ...T.label, ...NUM, color: C.body, textAlign: "right" }}>{n(a.open)}</span>
              <span
                style={{
                  ...T.label,
                  ...NUM,
                  fontWeight: a.overdue === 0 ? 400 : 700,
                  color: a.overdue === 0 ? C.soft : hueFor("vencido").color,
                  textAlign: "right",
                }}
              >
                {n(a.overdue)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {AGENTS.length === 0 && (
        <p style={{ ...T.caption, color: C.soft, padding: "12px 5px" }}>Nadie tiene tickets en la ventana.</p>
      )}
    </Card>
  );
}
