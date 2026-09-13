import { useMemo } from "react";
import { RANGES, derivedSeries, series } from "../mockData";
import { C, NUM, T, n } from "../styles";
import { BarChart, SERIES_IN, SERIES_OUT } from "./BarChart";
import { Card, CardHead } from "./primitives";

/**
 * Entrado contra cerrado, día a día.
 *
 * ------------------------------------------------------------------
 * LA PREGUNTA QUE EL TABLERO NO CONTESTABA
 * ------------------------------------------------------------------
 * Antes era una sola serie —cuántos tickets entraron— con su promedio dibujado
 * al lado. Eso dice cuánto trabajo llega, que es la mitad de lo que hace falta
 * saber: un pico de entradas no es un problema si ese día también se cerró
 * mucho, y una entrada tranquila SÍ lo es si no se cerró nada.
 *
 * La pregunta que decide si la operación se está ahogando es otra: **¿entra más
 * de lo que sale?** Con las dos series juntas se responde de un vistazo, y el
 * saldo de la cabecera la responde con un número.
 *
 * Las seis cifras de arriba son todas medidas de atraso. Ésta es la gráfica que
 * explica POR QUÉ ese atraso sube o baja.
 *
 * ------------------------------------------------------------------
 * UN SOLO EJE
 * ------------------------------------------------------------------
 * Las dos series miden lo mismo —tickets por día— así que comparten escala. Un
 * segundo eje a la derecha dejaría que cualquiera de las dos pareciera mayor
 * con sólo elegir los topes, y el cruce entre ellas dejaría de significar algo.
 */
export function TicketTrend({ range }: { range: string }) {
  const cfg = RANGES[range];
  const entered = useMemo(() => series(cfg.seed, cfg.count, cfg.band[0], cfg.band[1]), [cfg]);
  /* Cerrados deriva de entrados: en una operación real las dos están
     correlacionadas, y dos series aleatorias sueltas se cruzarían de un modo
     que ningún equipo reconocería. */
  const closed = useMemo(() => derivedSeries(entered, cfg.seed + 91, 17, 150), [entered, cfg.seed]);

  const totalIn = entered.reduce((a, b) => a + b, 0);
  const totalOut = closed.reduce((a, b) => a + b, 0);


  return (
    <Card className="cx-hover">
      <CardHead
        title="Entrados y cerrados"
        hint="Entrados contra cerrados, día a día, en los últimos 30 días. Pasa el cursor por una columna para ver el detalle del día. Cuando la barra azul supera a la verde, ese día la cola creció."
        /* El total y el promedio viajan en la cabecera, no en una banda propia.
           Sueltos ocupaban cuarenta pixeles de alto para decir dos numeros, y
           ese alto se lo estaban comiendo a las barras: la serie quedaba en una
           franja donde no se distinguia un dia de otro. Lo que hay que poder
           comparar es la forma, no leer el total dos veces. */
        right={
          <span style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <span style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
              <span style={{ ...T.label, ...NUM, fontWeight: 600, color: C.ink }}>{n(totalIn)}</span>
              <span style={{ ...T.caption, color: C.soft }}>entrados</span>
            </span>
            <span style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
              <span style={{ ...T.label, ...NUM, fontWeight: 600, color: C.body }}>{n(totalOut)}</span>
              <span style={{ ...T.caption, color: C.soft }}>cerrados</span>
            </span>
            <span style={{ ...T.caption, color: C.soft }}>{range}</span>
          </span>
        }
      />

      <div style={{ marginTop: 6 }}>
        <BarChart
          series={[
            { label: "Entrados", values: entered, color: SERIES_IN },
            { label: "Cerrados", values: closed, color: SERIES_OUT },
          ]}
          max={cfg.max}
          ticks={cfg.ticks}
          tooltipTop={(i) => cfg.labelFor(i)}
          tooltipUnit="tickets"
        />
      </div>
    </Card>
  );
}
