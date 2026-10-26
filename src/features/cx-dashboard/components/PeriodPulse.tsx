import { useDashboard } from "../dashboardContext";
import { C, NUM, R, S, T, hueFor, n, type Role } from "../styles";
import { Card, CardHead } from "./primitives";

/**
 * El pulso de la ventana, en cuatro paneles.
 *
 * ------------------------------------------------------------------
 * LO QUE LA GRAFICA DE AL LADO DICE CON FORMA, ACA SE DICE CON CIFRAS
 * ------------------------------------------------------------------
 * «Entrados y cerrados» muestra si la cola crece; estos cuatro paneles lo
 * cuantifican. Los cuatro salen de la misma serie diaria que esa grafica —no
 * hay una segunda lectura— asi que no pueden contradecirla.
 *
 * Es la anatomia de la referencia (Center Quest, «Contact & missed-call
 * insights»): panel hundido, rotulo en versalita, una linea de contexto y la
 * cifra abajo con su punto de color. El punto lleva el veredicto y la frase lo
 * nombra: el color nunca va solo.
 *
 * ------------------------------------------------------------------
 * NO HAY METAS INVENTADAS
 * ------------------------------------------------------------------
 * Ningun endpoint define un objetivo de cierre, asi que ningun panel dice
 * «dentro de la meta». El unico umbral es el que no necesita acuerdo: cerrar
 * al menos lo que entra. Por debajo de eso la cola crece, y eso es un hecho,
 * no una opinion.
 */

interface Tile {
  label: string;
  context: string;
  figure: string;
  /** Rol del punto. `null` cuando la cifra no lleva veredicto. */
  tone: Role | null;
}

export function PeriodPulse() {
  const { trend, range } = useDashboard();

  const entered = trend.reduce((sum, d) => sum + d.opened, 0);
  const closed = trend.reduce((sum, d) => sum + d.closed, 0);
  const balance = entered - closed;
  const days = trend.length || range.days;
  const average = days === 0 ? 0 : entered / days;
  const growthDays = trend.filter((d) => d.opened > d.closed).length;
  const peak = trend.reduce<{ date: string; opened: number } | null>(
    (best, d) => (d.opened > 0 && (best === null || d.opened > best.opened) ? d : best),
    null,
  );

  const peakLabel = peak
    ? (() => {
        const [, mes, dia] = peak.date.split("-");
        return `${Number(dia)}/${Number(mes)}`;
      })()
    : null;

  /* Sin entradas no hay tasa: dividir por cero daria «infinito», y un cero
     afirmaria que no se cerro nada de lo que entro. */
  const closeRate = entered === 0 ? null : closed / entered;

  const tiles: Tile[] = [
    {
      label: "Tasa de cierre",
      context: `${n(closed)} cerrados de ${n(entered)} entrados`,
      figure: closeRate === null ? "—" : `${n(Math.round(closeRate * 100))}%`,
      tone: closeRate === null ? null : closeRate >= 1 ? "cumplido" : "porVencer",
    },
    {
      label: "Saldo de la cola",
      context:
        balance > 0
          ? `la cola creció en ${range.days} días`
          : balance < 0
            ? `la cola bajó en ${range.days} días`
            : "entró lo mismo que salió",
      figure: balance > 0 ? `+${n(balance)}` : balance < 0 ? `−${n(-balance)}` : "0",
      tone: balance > 0 ? "vencido" : balance < 0 ? "cumplido" : null,
    },
    {
      label: "Entrada diaria",
      context: peak ? `pico de ${n(peak.opened)} el ${peakLabel}` : "sin entradas en la ventana",
      figure: n(average, 1),
      tone: null,
    },
    {
      label: "Días que creció",
      context: `entró más de lo que se cerró, de ${n(days)}`,
      figure: n(growthDays),
      tone: growthDays === 0 ? "cumplido" : null,
    },
  ];

  return (
    <Card className="cx-hover" bodyStyle={{ display: "flex", flexDirection: "column" }}>
      <CardHead
        title="Pulso del periodo"
        hint="Cuatro cifras sobre la misma serie diaria: cuánto se cierra de lo que entra, cuánto creció o bajó la cola, la entrada promedio por día y cuántos días entró más de lo que se cerró."
        right={<span style={{ ...T.caption, color: C.soft }}>{range.days} días</span>}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: S.sm + 2,
          flex: 1,
        }}
      >
        {tiles.map((tile) => (
          <PulseTile key={tile.label} tile={tile} />
        ))}
      </div>
    </Card>
  );
}

function PulseTile({ tile }: { tile: Tile }) {
  const dot = tile.tone ? hueFor(tile.tone).color : null;

  return (
    <div
      className="cx-inset"
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: S.md,
        minHeight: 112,
        padding: "12px 14px 14px",
        borderRadius: R.inset,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <p style={{ ...T.micro, color: C.body }}>{tile.label}</p>
        <p style={{ ...T.caption, ...NUM, color: C.soft, marginTop: 4 }}>{tile.context}</p>
      </div>

      <p style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {dot && (
          <span
            aria-hidden
            style={{ width: 8, height: 8, borderRadius: 99, background: dot, flexShrink: 0 }}
          />
        )}
        <span style={{ ...T.figureXl, ...NUM, fontSize: 26, color: C.ink }}>{tile.figure}</span>
      </p>
    </div>
  );
}
