import { useRef, type CSSProperties } from "react";
import "./dashboard.css";
import { AgentPerformance } from "./components/AgentPerformance";
import { CallDetails } from "./components/CallDetails";
import { KpiRow } from "./components/KpiRow";
import { RecentTickets } from "./components/RecentTickets";
import { ResponseTime } from "./components/ResponseTime";
import { TicketByCategory } from "./components/TicketByCategory";
import { TicketByStage } from "./components/TicketByStage";
import { TicketTrend } from "./components/TicketTrend";
import { COUNTS } from "./mockData";
import { S } from "./styles";
import { usePageChrome } from "../../layouts/usePageChrome";

/**
 * Tablero de operación — dirección «filete de acento».
 *
 * ------------------------------------------------------------------
 * SIN CAPAS, SIN SOMBRAS
 * ------------------------------------------------------------------
 * Fondo blanco. El lienzo gris y todas las sombras se fueron: sobre blanco una
 * sombra no separa nada, sólo ensucia. La separación la hace el borde de la
 * tarjeta, y la identidad la hace el filete de 4 px que cada una lleva arriba
 * en el tono de su rol.
 *
 * ------------------------------------------------------------------
 * LA VENTANA NO SE ELIGE
 * ------------------------------------------------------------------
 * El selector de periodo, el reloj y el distintivo de entorno se quitaron por
 * pedido. La ventana queda fija en 30 dias: es una CONSTANTE y no estado,
 * porque no hay nada que pueda cambiarla. Devolver el control es montar un
 * `Select` sobre `RANGE` y pasarlo a `useState` — las nueve cajas ya leen de
 * ahi, asi que no hay mas cableado que ese.
 *
 * ------------------------------------------------------------------
 * ESPACIADO
 * ------------------------------------------------------------------
 * Todo en múltiplos de 4. Entre bandas va `S.xl` (20) y entre tarjetas de una
 * misma banda `S.md` (12): la diferencia es lo que hace que una banda se lea
 * como un grupo y no como cuatro cajas sueltas.
 */

/** 1.85fr / 1fr en escritorio; `cx-pair` lo colapsa a una columna bajo 1024 px. */
/** La ventana que gobierna las nueve cajas. */
const RANGE = "30 días";

const WIDE: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0,1.85fr) minmax(0,1fr)",
  gap: S.md,
  alignItems: "start",
};

const PAIR: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0,1fr))",
  gap: S.md,
  alignItems: "start",
};

export function CXDashboard({ query }: { query?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const live = COUNTS.open + COUNTS.upcoming + COUNTS.overdue + COUNTS.waitingOnClient;

  /* Lo que la barra de aplicación muestra cuando esta pantalla ya scrolleó. El
     ítem `danger` es el único que sobrevive al condensado, así que lleva lo
     único que exige una acción. */
  usePageChrome({
    title: "Dashboard de operaciones",
    context: [
      { text: `${live} tickets vivos`, strong: true },
      { text: `${COUNTS.overdue} fuera de plazo`, tone: "danger" },
    ],
    scrollRoot: scrollRef,
  });

  return (
    <div className="cxhub" style={{ display: "flex", flexDirection: "column", height: "100%", minWidth: 0 }}>
      {/* `minHeight: 0` es lo que permite que un hijo flex baje de la altura de
          su contenido; sin eso la caja crece y el overflow nunca se activa. El
          relleno lateral de 3 px le da sitio al anillo de foco, que si no queda
          cortado contra el borde del scroll. */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          overflowY: "auto",
          overflowX: "hidden",
          margin: "0 -3px",
          padding: "2px 3px 32px",
          display: "flex",
          flexDirection: "column",
          gap: S.xl,
        }}
      >
        {/* 1 — LO URGENTE, Y EL CONTEXTO. */}
        <KpiRow range={RANGE} />

        {/* 2 — CÓMO VIENE + SI ESTAMOS EN PLAZO. */}
        <div className="cx-pair" style={WIDE}>
          <TicketTrend range={RANGE} />
          <TicketByStage />
        </div>

        {/* 3 — SI CONTESTAMOS A TIEMPO + POR QUÉ ENTRA EL TRABAJO. */}
        <div className="cx-pair" style={WIDE}>
          <ResponseTime />
          <TicketByCategory />
        </div>

        {/* 4 — LA COLA. El único panel desde el que se actúa: ancho completo. */}
        <RecentTickets query={query} />

        {/* 5 — POR DÓNDE ENTRA Y DE QUIÉN ES. */}
        <div className="cx-pair" style={PAIR}>
          <CallDetails />
          <AgentPerformance />
        </div>
      </div>
    </div>
  );
}
