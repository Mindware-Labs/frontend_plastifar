import { CHANNELS } from "../mockData";
import { useApplyFilter } from "../filters";
import { C, FONT, NUM, S, SERIES, T, n } from "../styles";
import { Card, CardHead, Delta } from "./primitives";

/**
 * Por dónde entra el trabajo.
 *
 * ------------------------------------------------------------------
 * POR QUÉ SE FUE EL MEDIDOR
 * ------------------------------------------------------------------
 * Había un semicírculo con «2.000 en la ventana» en el centro. No significaba
 * nada: no tenía máximo, ni escala, ni referencia contra la cual leer el arco.
 * Un velocímetro sin techo es adorno con forma de instrumento.
 *
 * Lo reemplaza una lista a ancho completo, una fila por canal, con la barra
 * ocupando el espacio que antes gastaba el arco. La comparación que importa
 * —cuál pesa más— la hace el largo, que es para lo que existe una barra.
 */

/** Ancho fijo del nombre: sin él, las barras arrancan a distinta altura. */
const NAME_W = 96;

export function CallDetails() {
  const applyFilter = useApplyFilter();

  const total = CHANNELS.reduce((sum, c) => sum + c.value, 0);
  const max = Math.max(...CHANNELS.map((c) => c.value), 1);
  const top = [...CHANNELS].sort((a, b) => b.value - a.value)[0];
  const topShare = total === 0 ? 0 : Math.round((top.value / total) * 100);

  return (
    <Card className="cx-hover">
      <CardHead
        title="Tickets por canal"
        hint="Por dónde entran los tickets y cómo cambió respecto al periodo anterior."
      />

      <ul>
        {CHANNELS.map((channel, i) => (
          <li key={channel.label}>
            <button
              type="button"
              className="cx-link"
              title={`Ver los tickets de ${channel.label}`}
              onClick={() =>
                applyFilter({
                  kind: "canal",
                  value: channel.label,
                  label: `los tickets de ${channel.label}`,
                })
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: S.md,
                width: "100%",
                padding: "7px 6px",
                border: "none",
                borderRadius: 6,
                background: "transparent",
                textAlign: "left",
                fontFamily: FONT,
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  width: NAME_W,
                  flexShrink: 0,
                  ...T.label,
                  color: C.body,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {channel.label}
              </span>

              <span
                aria-hidden
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: 8,
                  borderRadius: 99,
                  background: C.hair2,
                  overflow: "hidden",
                }}
              >
                <span
                  style={{
                    display: "block",
                    height: "100%",
                    width: `${(channel.value / max) * 100}%`,
                    borderRadius: 99,
                    background: SERIES[i % SERIES.length],
                  }}
                />
              </span>

              {/* Anchos mínimos para que las dos columnas de la derecha cuadren
                  entre filas: sin ellos, «+12,4%» y «−3,1%» desalinean el valor. */}
              <span style={{ width: 52, flexShrink: 0, textAlign: "right" }}>
                <Delta value={channel.delta} />
              </span>
              <span
                style={{
                  width: 40,
                  flexShrink: 0,
                  textAlign: "right",
                  ...T.label,
                  ...NUM,
                  fontWeight: 600,
                  color: C.ink,
                }}
              >
                {n(channel.value)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p style={{ ...T.caption, color: C.soft, marginTop: S.md }}>
        {n(total)} en la ventana · {top.label} concentra el {topShare}%
      </p>
    </Card>
  );
}
