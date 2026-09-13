import { useEffect, useRef, useState, type CSSProperties } from "react";
import "./dashboard.css";
import { AgentPerformance } from "./components/AgentPerformance";
import { CallDetails } from "./components/CallDetails";
import { KpiRow } from "./components/KpiRow";
import { RecentTickets } from "./components/RecentTickets";
import { TicketByState } from "./components/TicketByState";
import { TicketByCategory } from "./components/TicketByCategory";
import { TicketByStage } from "./components/TicketByStage";
import { TicketTrend } from "./components/TicketTrend";
import { dashboardApi, type DashboardResponse } from "../../api/dashboard";
import { DashboardContext } from "./dashboardContext";
import { LoadErrorAlert } from "../../pages/settings/catalogSection";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { S } from "./styles";
import { usePageChrome } from "../../layouts/usePageChrome";

/**
 * Tablero de operación.
 *
 * ------------------------------------------------------------------
 * LIENZO TINTADO, SUPERFICIE BLANCA
 * ------------------------------------------------------------------
 * Referencia: Center Quest (`public/image.png`). El fondo de página es un gris
 * muy claro y las tarjetas son blanco puro; esa diferencia mínima es lo que las
 * hace flotar sin necesitar una sombra pesada. Sobre blanco no había nada que
 * separar y por eso la versión anterior no llevaba sombra — sobre este lienzo
 * sí la hay, y trabaja.
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
const WIDE: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0,1.85fr) minmax(0,1fr)",
  gap: S.md,
  alignItems: "start",
};

/*
 * UNA sola costura vertical en toda la pagina.
 *
 * Las bandas 2 y 3 partian en 1,85/1 y la banda 5 en 1/1, asi que el corte
 * entre columna izquierda y derecha se movia casi doscientos pixeles al llegar
 * abajo. Tres franjas alineadas y una cuarta corrida se lee como un error de
 * maquetacion, no como una decision.
 */

/** La ventana, en días. Ver «LA VENTANA NO SE ELIGE» arriba. */
const DIAS = 30;

export function CXDashboard({ query }: { query?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelado = false;

    dashboardApi
      .get(DIAS)
      .then((respuesta) => {
        if (cancelado) return;
        setData(respuesta);
        setError(null);
      })
      .catch(() => {
        if (!cancelado) setError("No se pudo cargar el tablero");
      });

    return () => {
      cancelado = true;
    };
  }, [reloadKey]);

  /* Lo que la barra de aplicación muestra cuando esta pantalla ya scrolleó. El
     ítem `danger` es el único que sobrevive al condensado, así que lleva lo
     único que exige una acción.

     `live` lo manda el servidor y NO se recompone sumando tramos: «abierto» y
     «vencido» se solapan, así que la suma contaba dos veces el mismo ticket. */
  usePageChrome({
    title: "Dashboard de operaciones",
    context: data
      ? [
          { text: `${data.counts.live} tickets vivos`, strong: true },
          { text: `${data.counts.overdue} fuera de plazo`, tone: "danger" as const },
        ]
      : [],
    scrollRoot: scrollRef,
  });

  if (error !== null) {
    return (
      <div className="cxhub" style={{ padding: "2px 3px" }}>
        <LoadErrorAlert message={error} onRetry={() => setReloadKey((k) => k + 1)} />
      </div>
    );
  }

  /* Mientras carga NO se pintan ceros. Un cero en un tablero de operación es la
     afirmación «no hay ninguno vencido», no un «todavía no se sabe», y durante
     ese medio segundo la pantalla estaría mintiendo sobre lo único que la
     persona vino a mirar. */
  if (data === null) {
    return (
      <div className="cxhub" style={{ padding: "2px 3px" }}>
        <TableSkeleton rows={10} columns={4} />
      </div>
    );
  }

  return (
    <DashboardContext.Provider value={data}>
    <div className="cxhub" style={{ display: "flex", flexDirection: "column", height: "100%", minWidth: 0 }}>
      {/* `minHeight: 0` es lo que permite que un hijo flex baje de la altura de
          su contenido; sin eso la caja crece y el overflow nunca se activa. El
          relleno lateral de 3 px le da sitio al anillo de foco, que si no queda
          cortado contra el borde del scroll. */}
      <div
        ref={scrollRef}
        className="cx-scroll"
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
        {/* 1 — LO URGENTE, Y EL CONTEXTO.
            `plf-band` escalona la entrada de las cinco bandas. Arranca desde
            un estado ya visible y se corta a los 180 ms: en una superficie de
            operacion el movimiento acompania la carga, nunca la hace esperar. */}
        <div className="plf-band">
          <KpiRow />
        </div>

        {/* 2 — CÓMO VIENE + SI ESTAMOS EN PLAZO. */}
        <div className="cx-pair plf-band" style={WIDE}>
          <TicketTrend />
          <TicketByStage />
        </div>

        {/* 3 — DÓNDE ESTÁ PARADO EL TRABAJO + POR QUÉ ENTRA. */}
        <div className="cx-pair plf-band" style={WIDE}>
          <TicketByState />
          <TicketByCategory />
        </div>

        {/* 4 — LA COLA. El único panel desde el que se actúa: ancho completo. */}
        <div className="plf-band">
          <RecentTickets query={query} />
        </div>

        {/* 5 — POR DÓNDE ENTRA Y DE QUIÉN ES. */}
        <div className="cx-pair plf-band" style={WIDE}>
          <CallDetails />
          <AgentPerformance />
        </div>
      </div>
      </div>
    </DashboardContext.Provider>
  );
}
