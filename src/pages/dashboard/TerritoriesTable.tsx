import { useMemo, useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { DataTable, HeadRow, Row, Td, Th, type SortDir } from "../../components/ui/DataTable";
import type { ClientsReport } from "../../api/reports";
import { formatInteger, formatPercent } from "./format";

/* ========================================================================== *
 *  La tabla de cierre del tablero.
 *
 *  En la referencia es "Best Selling Products": el ranking que explica las
 *  cifras de arriba. Aqui esa pregunta la responde el territorio — cuanta
 *  cartera sostiene cada uno y en que estado esta.
 *
 *  Sale entera de GET /api/reports/clients. Ninguna columna es inventada.
 * ========================================================================== */

type Column = "territory" | "total" | "active" | "share";

/**
 * `hide` marca las tres columnas que se van por debajo de `sm`.
 *
 * A ancho de telefono esta tabla dispone de 256 px reales —el riel del menu, el
 * relleno de pagina y el de la caja se llevan el resto—, y las cinco columnas
 * piden 351. Medido, no estimado. Con cinco, `Estado` quedaba detras del scroll
 * horizontal, que para el que mira es lo mismo que no estar.
 *
 * Quedan las dos que no se pueden deducir: el nombre y el veredicto. La
 * participacion no se pierde, baja al segundo renglon de la primera celda —su
 * encabezado solo medía 139 px, mas que el dato que rotula—. Los conteos crudos
 * si se caen: viven en la ficha del territorio, a un click.
 */
const HEADS: { key: Column; label: string; numeric: boolean; hide?: boolean }[] = [
  { key: "territory", label: "Territorio", numeric: false },
  { key: "total", label: "Clientes", numeric: true, hide: true },
  { key: "active", label: "Activos", numeric: true, hide: true },
  { key: "share", label: "Participación", numeric: true, hide: true },
];

/** Se aplica a la celda y a su cabecera: si divergen, la tabla se desalinea. */
const HIDDEN_ON_NARROW = "hidden sm:table-cell";

/**
 * Tramos del veredicto de actividad. El mismo semaforo del resto del panel.
 *
 * Etiquetas cortas: "En observación · 83 %" no entraba en la ultima columna a
 * 1366 px y la insignia se cortaba contra el borde. El porcentaje vive en el
 * `title`, y las dos columnas de al lado ya traen las cifras crudas.
 */
function activityTone(fraction: number) {
  if (fraction >= 0.85) return { tone: "green" as const, label: "Saludable" };
  if (fraction >= 0.6) return { tone: "warn" as const, label: "Observación" };
  return { tone: "red" as const, label: "Baja" };
}

export function TerritoriesTable({ report }: { report: ClientsReport }) {
  const [column, setColumn] = useState<Column>("total");
  const [dir, setDir] = useState<SortDir>("desc");

  const total = report.byTerritory.reduce((sum, entry) => sum + entry.total, 0);

  const rows = useMemo(() => {
    const list = report.byTerritory.filter((entry) => entry.total > 0);
    const sign = dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (column === "territory") return sign * a.territory.localeCompare(b.territory, "es");
      if (column === "active") return sign * (a.active - b.active);
      // `share` ordena por el mismo numero que `total`: la participacion es el
      // total dividido por una constante, asi que ordenar por una u otra da la
      // misma fila arriba. Se mantienen como cabeceras distintas porque son dos
      // lecturas distintas de la columna.
      return sign * (a.total - b.total);
    });
  }, [report.byTerritory, column, dir]);

  function toggle(key: Column) {
    if (key === column) {
      setDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setColumn(key);
    setDir(key === "territory" ? "asc" : "desc");
  }

  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-[13.5px] text-faint">
        Todavía no hay territorios con clientes asignados.
      </p>
    );
  }

  return (
    <DataTable>
      <thead>
        <HeadRow>
          {HEADS.map((head) => (
            <Th
              key={head.key}
              className={`${head.numeric ? "text-right" : ""} ${head.hide ? HIDDEN_ON_NARROW : ""}`}
              sort={{ dir: column === head.key ? dir : null, onToggle: () => toggle(head.key) }}
            >
              {head.label}
            </Th>
          ))}
          <Th>Estado</Th>
        </HeadRow>
      </thead>
      <tbody>
        {rows.map((entry) => {
          const share = total === 0 ? 0 : entry.total / total;
          const activity = entry.total === 0 ? 0 : entry.active / entry.total;
          const verdict = activityTone(activity);

          return (
            <Row key={entry.territory}>
              <Td className="pr-2 text-[12.5px] font-medium text-ink sm:pr-3.5">
                {entry.territory}
                {/* Segundo renglon SOLO en angosto: es la columna Participación
                    plegada, no un dato de mas. Desde `sm` vuelve a su columna y
                    esta linea desaparece, sin repetirse nunca. */}
                <span className="block text-[11px] font-normal leading-tight text-faint sm:hidden">
                  {formatPercent(share)} de la cartera
                </span>
              </Td>
              <Td
                className={`text-right text-[12.5px] tabular-nums text-brand-gray ${HIDDEN_ON_NARROW}`}
              >
                {formatInteger(entry.total)}
              </Td>
              <Td
                className={`text-right text-[12.5px] tabular-nums text-brand-gray ${HIDDEN_ON_NARROW}`}
              >
                {formatInteger(entry.active)}
              </Td>
              {/* Barra y cifra en UNA linea, no apiladas: apiladas la fila medía
                  74 px y esta tabla corre a la densidad del panel, 32–40 px. La
                  barra va antes porque se compara de un vistazo entre filas; la
                  cifra cierra a la derecha, alineada con las demas columnas. */}
              <Td className={`text-right ${HIDDEN_ON_NARROW}`}>
                <span className="inline-flex w-[104px] items-center gap-2.5">
                  {/* Relleno en `subtle` sobre pista `line-soft`. Estaba en
                      `line-strong` sobre `line-soft`: dos filetes, 1,1:1 entre
                      si, y la barra no se distinguia de su propia pista. */}
                  <span
                    aria-hidden
                    className="block h-1 flex-1 overflow-hidden rounded-pill bg-line-soft"
                  >
                    <span
                      className="block h-full rounded-pill bg-subtle"
                      style={{ width: `${Math.max(2, share * 100)}%` }}
                    />
                  </span>
                  <span className="w-9 shrink-0 text-right font-heading text-[12.5px] font-bold tabular-nums text-ink">
                    {formatPercent(share)}
                  </span>
                </span>
              </Td>
              {/* El porcentaje va en el nombre accesible, no en un `title`: un
                  `title` no lo alcanza ni el teclado ni el dedo, y en angosto
                  esta insignia es lo unico que queda del veredicto. */}
              <Td>
                <Badge tone={verdict.tone}>
                  {verdict.label}
                  <span className="sr-only">
                    {` — ${formatPercent(activity)} de los clientes de la zona están activos`}
                  </span>
                </Badge>
              </Td>
            </Row>
          );
        })}
      </tbody>
    </DataTable>
  );
}
