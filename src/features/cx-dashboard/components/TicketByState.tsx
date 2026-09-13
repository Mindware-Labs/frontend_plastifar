import { STATE_AGING } from "../mockData";
import { useApplyFilter } from "../filters";
import { C, FONT, NUM, S, T, n } from "../styles";
import { Card, CardHead } from "./primitives";

/**
 * Estados de tickets, repartidos por antigüedad.
 *
 * ==================================================================
 * POR QUÉ LLEVA LA EDAD Y NO SÓLO EL CONTEO
 * ==================================================================
 * El reparto por estado a secas ya vive en «Cumplimiento de plazo». Repetirlo
 * acá sería gastar una tarjeta del tablero en un dato que la persona ya tiene
 * dos columnas más allá.
 *
 * Lo que ninguna otra caja contesta es DÓNDE SE ATASCAN. Un estado con pocos
 * tickets pero todos viejos es un cuello de botella; uno con muchos pero
 * frescos es un día ocupado. Sin la edad, los dos se ven idénticos, y son
 * problemas opuestos: al primero le falta gente, al segundo no le falta nada.
 *
 * ==================================================================
 * ES UNA ESCALA, NO CATEGORÍAS
 * ==================================================================
 * Los tres tramos están ordenados: menos de un día, uno a tres, más de tres.
 * Eso obliga a un solo tono en tres claridades, y prohíbe tres colores
 * distintos — con hues sueltos, «más de 3 días» no se leería como el extremo de
 * nada, sólo como una tercera categoría cualquiera.
 *
 * Más oscuro es más viejo, que es lo que hace que el atasco salte a la vista:
 * la fila con más tinta es la fila con el problema.
 */

/**
 * Un solo tono, tres claridades. Ordenadas y monótonas, como manda una escala.
 *
 * ------------------------------------------------------------------
 * POR QUÉ EL LÍMITE LO PONE UN FILETE Y NO EL RELLENO
 * ------------------------------------------------------------------
 * El primer escalón era #C3D2F0 y daba 1.27:1 contra la pista de la barra:
 * medido, no estimado. El tramo «menos de 1 día» era prácticamente invisible,
 * que es el peor sitio para perder un dato porque es el tramo SANO —el que dice
 * que ahí no hay problema—.
 *
 * Oscurecerlo hasta 3:1 no es posible manteniendo la escala: tres pasos
 * secuenciales, cada uno a 3:1 del fondo Y separado de su vecino, no caben en un
 * solo tono. Es física del color, no un descuido; forzarlo rompería la
 * monotonía, que es lo único que hace que esto se LEA como una escala.
 *
 * Así que el contraste contra el fondo lo aporta la FORMA: la pista lleva un
 * filete que delimita dónde empieza y acaba el dato. El relleno queda libre para
 * decir solo una cosa —cuán viejo— y la escala se desplaza un paso hacia el
 * oscuro para ganar lo que se pueda sin colisionar entre tramos.
 */
const AGE_STEPS = [
  { key: "fresh" as const, label: "Menos de 1 día", color: "#9CB8E8" },
  { key: "aging" as const, label: "1 a 3 días", color: "#4F7AD0" },
  { key: "stale" as const, label: "Más de 3 días", color: "#1B3F9E" },
];

/** Ancho fijo del nombre: sin él, las barras arrancan a distinta altura. */
const NAME_W = 158;

export function TicketByState() {
  const applyFilter = useApplyFilter();

  const rows = STATE_AGING.map((r) => ({ ...r, total: r.fresh + r.aging + r.stale }));
  const max = Math.max(...rows.map((r) => r.total), 1);
  const stale = rows.reduce((sum, r) => sum + r.stale, 0);
  const total = rows.reduce((sum, r) => sum + r.total, 0);
  /* El estado con más tickets estancados: es la lectura de la tarjeta en una línea. */
  const worst = [...rows].sort((a, b) => b.stale - a.stale)[0];

  return (
    <Card className="cx-hover">
      <CardHead
        title="Estados de tickets"
        hint="Cuántos tickets hay en cada estado y cuánto llevan ahí. Cuanto más oscura la barra, más viejo el ticket. Click en un estado para filtrar la bandeja."
        right={
          <span style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
            <span style={{ ...T.label, ...NUM, fontWeight: 600, color: C.ink }}>{n(total)}</span>
            <span style={{ ...T.caption, color: C.soft }}>vivos</span>
          </span>
        }
      />

      <ul style={{ marginTop: 2 }}>
        {rows.map((row) => (
          <li key={row.state}>
            <button
              type="button"
              className="cx-link"
              title={`Ver los tickets en ${row.state}`}
              onClick={() =>
                applyFilter({
                  kind: "estado",
                  value: row.state,
                  label: `los tickets en ${row.state.toLowerCase()}`,
                })
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: S.md,
                width: "100%",
                padding: "8px 6px",
                border: "none",
                borderRadius: 8,
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
                {row.state}
              </span>

              {/* La barra se mide contra el estado más grande, no contra su
                  propio total: así las filas se comparan entre sí, que es para
                  lo que están una debajo de la otra. */}
              <span
                aria-hidden
                className="plf-bar-fill"
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  height: 10,
                  gap: 2,
                  borderRadius: 99,
                  overflow: "hidden",
                  background: C.hair2,
                  /* El filete que delimita el dato, ver AGE_STEPS. */
                  boxShadow: `inset 0 0 0 1px ${C.hair}`,
                }}
              >
                {/* Sólo los EXTREMOS de la barra se redondean. Con radio en
                    cada tramo, los segmentos dejan de leerse como partes de una
                    misma barra y pasan a parecer tres barras sueltas — que es
                    lo contrario de lo que una barra apilada quiere decir. */}
                {(() => {
                  const visible = AGE_STEPS.filter((step) => row[step.key] > 0);
                  return visible.map((step, i) => (
                    <span
                      key={step.key}
                      style={{
                        width: `${(row[step.key] / max) * 100}%`,
                        background: step.color,
                        borderTopLeftRadius: i === 0 ? 99 : 0,
                        borderBottomLeftRadius: i === 0 ? 99 : 0,
                        borderTopRightRadius: i === visible.length - 1 ? 99 : 0,
                        borderBottomRightRadius: i === visible.length - 1 ? 99 : 0,
                      }}
                    />
                  ));
                })()}
              </span>

              <span
                style={{
                  width: 34,
                  flexShrink: 0,
                  textAlign: "right",
                  ...T.label,
                  ...NUM,
                  fontWeight: 600,
                  color: C.ink,
                }}
              >
                {n(row.total)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* Leyenda: con tres tramos, la identidad no puede vivir sólo en la
          claridad de un mismo tono. */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: S.md,
          marginTop: S.md,
          paddingTop: S.md,
          borderTop: `1px solid ${C.hair2}`,
        }}
      >
        {AGE_STEPS.map((step) => (
          <span key={step.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              aria-hidden
              style={{ width: 10, height: 10, borderRadius: 3, background: step.color }}
            />
            <span style={{ ...T.caption, color: C.soft }}>{step.label}</span>
          </span>
        ))}

        <span style={{ ...T.caption, color: C.soft, marginLeft: "auto" }}>
          {n(stale)} llevan más de 3 días · el atasco está en{" "}
          <strong style={{ fontWeight: 600, color: C.body }}>{worst.state.toLowerCase()}</strong>
        </span>
      </div>
    </Card>
  );
}
