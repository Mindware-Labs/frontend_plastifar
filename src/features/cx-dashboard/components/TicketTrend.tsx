import { useMemo } from "react";
import { useDashboard } from "../dashboardContext";
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
export function TicketTrend() {
  const { trend, range } = useDashboard();

  const entered = useMemo(() => trend.map((d) => d.opened), [trend]);
  const closed = useMemo(() => trend.map((d) => d.closed), [trend]);

  const totalIn = entered.reduce((a, b) => a + b, 0);
  const totalOut = closed.reduce((a, b) => a + b, 0);

  /* EL TOPE DEL EJE SALE DEL DATO, no de una constante.
     Antes venia fijo en la configuracion del rango porque las series eran
     inventadas y su techo se conocia de antemano. Con dato real un tope fijo
     tiene dos formas de mentir: si se queda corto, las barras se salen; si se
     pasa, la serie entera queda aplastada contra el suelo y no se distingue un
     dia de otro. Se redondea hacia arriba para que la ultima marca del eje sea
     un numero legible y no el maximo exacto. */
  const pico = Math.max(1, ...entered, ...closed);
  const escala = Math.pow(10, Math.floor(Math.log10(pico)));
  const max = Math.ceil(pico / escala) * escala;

  /* Marcas del eje: cuatro a lo largo de la ventana. Con treinta columnas,
     rotular todas es ilegible y rotular dos no ubica nada. */
  const etiquetaDe = (i: number) => {
    const punto = trend[i];
    if (!punto) return "";
    const [, mes, dia] = punto.date.split("-");
    return `${Number(dia)}/${Number(mes)}`;
  };
  const ticks: [number, string][] = trend.length === 0
    ? []
    : [0, 0.33, 0.66, 0.99]
        .map((f) => Math.floor(f * (trend.length - 1)))
        .map((i) => [i, etiquetaDe(i)] as [number, string]);


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
            <span style={{ ...T.caption, color: C.soft }}>{range.days} días</span>
          </span>
        }
      />

      <div style={{ marginTop: 6 }}>
        <BarChart
          series={[
            { label: "Entrados", values: entered, color: SERIES_IN },
            { label: "Cerrados", values: closed, color: SERIES_OUT },
          ]}
          max={max}
          ticks={ticks}
          tooltipTop={etiquetaDe}
          tooltipUnit="tickets"
        />
      </div>
    </Card>
  );
}
