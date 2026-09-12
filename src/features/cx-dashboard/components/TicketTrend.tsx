import { useMemo } from "react";
import { RANGES, series } from "../mockData";
import { C, NUM, T, n } from "../styles";
import { BarChart } from "./BarChart";
import { Card, CardHead } from "./primitives";

/**
 * Entradas a la bandeja a lo largo de la ventana.
 *
 * La pregunta es si la carga viene subiendo, y la respuesta la da la forma de
 * la serie contra su promedio — por eso el promedio va dibujado y no enunciado
 * al pie. Sin librería de gráficas: la SVG está calculada a mano en `BarChart`.
 */
export function TicketTrend({ range }: { range: string }) {
  const cfg = RANGES[range];
  const data = useMemo(() => series(cfg.seed, cfg.count, cfg.band[0], cfg.band[1]), [cfg]);
  const total = data.reduce((a, b) => a + b, 0);
  const average = Math.round(total / data.length);

  return (
    <Card className="cx-hover">
      <CardHead
        title="Tickets entrados"
        hint="Volumen diario de los últimos 30 días. Pasa el cursor por una barra para ver el detalle del día."
        right={<span style={{ ...T.caption, color: C.body }}>{range}</span>}
      />

      <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginTop: 10 }}>
        <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ ...T.figure, ...NUM, color: C.ink }}>
            {n(total)}
          </span>
          <span style={{ ...T.caption, color: C.soft }}>en la ventana</span>
        </span>
        <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ ...T.figure, ...NUM, fontWeight: 700, color: C.body }}>
            {n(average)}
          </span>
          <span style={{ ...T.caption, color: C.soft }}>promedio</span>
        </span>
      </div>

      <div style={{ marginTop: 4 }}>
        <BarChart
          data={data}
          max={cfg.max}
          ticks={cfg.ticks}
          defaultIndex={Math.min(13, cfg.count - 1)}
          tooltipTop={(i) => cfg.labelFor(i)}
          tooltipUnit="tickets"
        />
      </div>
    </Card>
  );
}
