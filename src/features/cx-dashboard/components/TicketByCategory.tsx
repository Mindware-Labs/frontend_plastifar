import { useState } from "react";
import { useDashboard } from "../dashboardContext";
import { C, FONT, NUM, S, SERIES, T, n } from "../styles";
import { Card, CardHead } from "./primitives";

/**
 * Por qué se abre un ticket, como barras horizontales ordenadas.
 *
 * Antes era un anillo de cinco segmentos identificados solo por color, y el
 * color salía de la POSICIÓN del tema en la lista: si el orden cambiaba, un
 * tema cambiaba de color. Cinco tonos parecidos en un anillo no se comparan
 * (el ojo no mide ángulos), y quien no distingue esos tonos no podía leerlo.
 *
 * Ahora cada fila lleva su nombre, su cifra y su participación escritos al
 * lado de la barra, así que el color ya no identifica nada: va un solo tono
 * para todas. El largo compara contra el tema mayor; el porcentaje, contra el
 * total visible.
 *
 * Cada fila es un interruptor (aria-pressed): pulsarla saca el tema del total
 * sin salir de la pantalla, y volver a pulsarla lo devuelve. Los porcentajes
 * se recalculan sobre lo que queda incluido.
 */

/** Un solo tono: la identidad la dan los rótulos directos, no el color. */
const BAR = SERIES[0];

export function TicketByCategory() {
  const [off, setOff] = useState<string[]>([]);
  const { topics: TOPICS } = useDashboard();

  const toggle = (label: string) =>
    setOff((current) =>
      current.includes(label) ? current.filter((x) => x !== label) : [...current, label],
    );

  // Orden por cifra, desempate por nombre: el orden no depende de cómo llegue el arreglo.
  const sorted = [...TOPICS].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "es"));
  const included = sorted.filter((t) => !off.includes(t.label));
  const total = included.reduce((sum, t) => sum + t.value, 0);
  const max = Math.max(...included.map((t) => t.value), 1);

  return (
    <Card className="cx-hover" bodyStyle={{ display: "flex", flexDirection: "column" }}>
      <CardHead
        title="Tickets por tema"
        hint="Los cinco temas con más tickets en la ventana. Pulsa un tema para excluirlo del total o volver a incluirlo."
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
              Incluir {off.length === 1 ? "el excluido" : `los ${off.length} excluidos`}
            </button>
          ) : (
            <span style={{ ...T.caption, ...NUM, color: C.body }}>{n(total)} tickets</span>
          )
        }
      />

      <ul aria-label="Temas" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {sorted.map((topic) => {
          const isIncluded = !off.includes(topic.label);
          const share = isIncluded && total > 0 ? Math.round((topic.value / total) * 100) : null;
          return (
            <li key={topic.label}>
              <button
                type="button"
                className="cx-link"
                aria-pressed={isIncluded}
                title={isIncluded ? `Excluir ${topic.label} del total` : `Incluir ${topic.label} en el total`}
                onClick={() => toggle(topic.label)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                  width: "100%",
                  padding: "6px 6px 7px",
                  border: "none",
                  borderRadius: 6,
                  background: "transparent",
                  textAlign: "left",
                  fontFamily: FONT,
                  cursor: "pointer",
                  transition: "background .15s",
                }}
              >
                <span style={{ display: "flex", alignItems: "baseline", gap: S.sm, width: "100%" }}>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      ...T.label,
                      color: isIncluded ? C.body : C.soft,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      textDecoration: isIncluded ? "none" : "line-through",
                    }}
                  >
                    {topic.label}
                  </span>
                  <span style={{ flexShrink: 0, ...T.caption, ...NUM, color: C.soft }}>
                    {share === null ? "excluido" : `${share}%`}
                  </span>
                  <span
                    style={{
                      width: 36,
                      flexShrink: 0,
                      textAlign: "right",
                      ...T.label,
                      ...NUM,
                      fontWeight: 600,
                      color: isIncluded ? C.ink : C.soft,
                    }}
                  >
                    {n(topic.value)}
                  </span>
                </span>
                <span
                  aria-hidden
                  style={{
                    display: "block",
                    width: "100%",
                    height: 8,
                    borderRadius: 99,
                    background: C.hair2,
                    boxShadow: `inset 0 0 0 1px ${C.hair}`,
                    overflow: "hidden",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      height: "100%",
                      width: isIncluded ? `${(topic.value / max) * 100}%` : 0,
                      borderRadius: 99,
                      background: BAR,
                    }}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
