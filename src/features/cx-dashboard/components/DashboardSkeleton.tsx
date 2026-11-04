import type { CSSProperties, ReactNode } from "react";
import { Skeleton } from "../../../components/ui/Skeleton";
import { CARD_PAD, CHART_H, S } from "../styles";

/**
 * El tablero mientras llega su unica lectura.
 *
 * Calca las cinco bandas del tablero cargado con sus mismas tarjetas (`cx-card`,
 * radio 16, sombra de elevacion), la misma cabecera de tarjeta con su filete y
 * la silueta de lo que va dentro: la curva de 304 px, el semicirculo del plazo,
 * las barras de estados, la dona de temas, la tabla de cinco filas, los
 * canales y la lista de responsables. Al llegar los datos cada pieza se llena
 * en su sitio; la pantalla no cambia de forma.
 *
 * Ninguna cifra: un cero en un tablero es una afirmacion («no hay vencidos»),
 * no un «todavia no se».
 *
 * Las medidas salen de `KpiRow`, `primitives.tsx` (`Card`, `CardHead`) y de
 * cada panel. Si una de esas cambia, cambia aqui tambien.
 */

/** Riel de las graficas: el mismo `rail` que pintan los anillos y medidores. */
const RAIL = "#E7EAF0";
/** Filete interno de tarjeta (`hair2`). */
const HAIR2 = "1px solid #F1F4F8";

const WIDE: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0,1.85fr) minmax(0,1fr)",
  gap: S.md,
  alignItems: "start",
};

const ROW: CSSProperties = { display: "flex", alignItems: "center" };

/* -------------------------------------------------------------------------- */
/*  Marco                                                                      */
/* -------------------------------------------------------------------------- */

/** `Card` de `primitives.tsx`: misma clase, mismo relleno. */
function SkCard({ children, bodyStyle }: { children: ReactNode; bodyStyle?: CSSProperties }) {
  return (
    <div className="cx-card" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ padding: CARD_PAD, flex: 1, minHeight: 0, ...bodyStyle }}>{children}</div>
    </div>
  );
}

/** `CardHead`: titulo de 20 px de linea, filete inferior y lado derecho opcional. */
function SkHead({ title, right, delay = 0 }: { title: string; right?: ReactNode; delay?: number }) {
  return (
    <div
      style={{
        ...ROW,
        flexWrap: "wrap",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "4px 12px",
        paddingBottom: 8,
        marginBottom: 12,
        borderBottom: HAIR2,
      }}
    >
      <span style={{ ...ROW, height: 20 }}>
        <Skeleton className={`h-3.5 ${title}`} delay={delay} />
      </span>
      {right && <span style={{ ...ROW, gap: 8, flexShrink: 0 }}>{right}</span>}
    </div>
  );
}

/** Pastilla de 32 px: buscador o selector de la cabecera. */
function ControlPill({ width, delay = 0 }: { width: number; delay?: number }) {
  return (
    <span
      style={{
        ...ROW,
        width,
        maxWidth: "100%",
        height: 32,
        gap: 8,
        padding: "0 12px",
        border: "1px solid #E9ECF1",
        borderRadius: 999,
      }}
    >
      <Skeleton className="h-2.5 w-2/3 !rounded-full" delay={delay} />
    </span>
  );
}

/** Punto o muestra de leyenda (7–8 px). */
function Dot({ size = 7, round = true }: { size?: number; round?: boolean }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, flexShrink: 0, borderRadius: round ? 99 : 2, background: RAIL }}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  1 — Cifras                                                                 */
/* -------------------------------------------------------------------------- */

function KpiTiles() {
  const labels = ["w-24", "w-20", "w-16", "w-20", "w-24"];
  return (
    <div
      className="cx-kpis"
      style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: S.md }}
    >
      {labels.map((label, i) => {
        const d = i * 60;
        return (
          <div key={i} className="cx-card" style={{ display: "flex" }}>
            {/* El filete de rol, en neutro: el color lo trae el dato. */}
            <span aria-hidden style={{ width: 3, flexShrink: 0, background: RAIL }} />
            <span
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 7,
                padding: "11px 13px",
                flex: 1,
                minWidth: 0,
              }}
            >
              <span style={{ ...ROW, gap: 8 }}>
                <Skeleton className="h-6 w-6 shrink-0 !rounded-[10px]" delay={d} />
                <Skeleton className={`h-2.5 ${label}`} delay={d + 20} />
              </span>
              <span style={{ ...ROW, height: 28 }}>
                <Skeleton className="h-6 w-10" delay={d + 40} />
              </span>
              <Skeleton className="h-1 w-full !rounded-full" delay={d + 60} />
              <span style={{ ...ROW, height: 15 }}>
                <Skeleton className="h-2.5 w-28 max-w-full" delay={d + 80} />
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  2 — Tendencia + plazo                                                      */
/* -------------------------------------------------------------------------- */

function TrendCard() {
  // Area de trazado del `AreaChart`: insets L 40, R 18, T 16, B 44 sobre 304.
  return (
    <SkCard>
      <SkHead
        title="w-40"
        right={
          <>
            <Skeleton className="h-3 w-20" delay={30} />
            <Skeleton className="h-3 w-20" delay={60} />
            <Skeleton className="h-3 w-12" delay={90} />
          </>
        }
      />
      <div style={{ marginTop: 6, height: CHART_H.main, position: "relative" }}>
        {/* Cuadricula: cinco lineas, con su marca de eje a la izquierda. */}
        {[0, 1, 2, 3, 4].map((line) => {
          const top = 16 + (244 * line) / 4;
          return (
            <span key={line} aria-hidden>
              <span
                style={{ position: "absolute", left: 40, right: 18, top, borderTop: HAIR2 }}
              />
              <span style={{ position: "absolute", left: 8, top: top - 4, width: 20 }}>
                <Skeleton className="h-2 w-full" delay={line * 30} />
              </span>
            </span>
          );
        })}
        {/* Silueta de las dos areas. */}
        <span
          className="plf-skeleton"
          style={{
            position: "absolute",
            left: 40,
            right: 18,
            top: 60,
            bottom: 44,
            background: "var(--color-fill)",
            clipPath:
              "polygon(0% 92%, 6% 70%, 11% 88%, 16% 40%, 21% 86%, 28% 66%, 34% 90%, 41% 60%, 47% 84%, 53% 70%, 60% 92%, 66% 74%, 72% 30%, 77% 90%, 84% 78%, 90% 92%, 95% 84%, 100% 94%, 100% 100%, 0% 100%)",
          }}
        />
        {/* Eje X: cuatro marcas. */}
        <span
          style={{
            position: "absolute",
            left: 40,
            right: 18,
            bottom: 20,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          {[0, 1, 2, 3].map((tick) => (
            <Skeleton key={tick} className="h-2 w-8" delay={tick * 40} />
          ))}
        </span>
        {/* Leyenda centrada: dos series. */}
        <span
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            justifyContent: "center",
            gap: 40,
          }}
        >
          {[0, 1].map((item) => (
            <span key={item} style={{ ...ROW, gap: 6 }}>
              <span aria-hidden style={{ width: 14, height: 3, background: RAIL, borderRadius: 2 }} />
              <Skeleton className="h-2 w-12" delay={item * 40} />
            </span>
          ))}
        </span>
      </div>
    </SkCard>
  );
}

function StageCard() {
  return (
    <SkCard>
      <SkHead title="w-44" right={<Skeleton className="h-2.5 w-12" delay={30} />} delay={60} />
      {/* Semicirculo de `StageGauge`: viewBox 240×132, radio 96, trazo 16. */}
      <div style={{ position: "relative", width: "100%", maxWidth: 260, margin: "4px auto 0" }}>
        <svg
          aria-hidden
          viewBox="0 0 240 132"
          style={{ display: "block", width: "100%" }}
          className="motion-safe:animate-pulse"
        >
          <path
            d="M 24 118 A 96 96 0 0 1 216 118"
            fill="none"
            stroke={RAIL}
            strokeWidth={16}
            strokeLinecap="round"
          />
        </svg>
        <span
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "48%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Skeleton className="h-7 w-20" delay={90} />
          <Skeleton className="h-2.5 w-28" delay={120} />
        </span>
      </div>
      <ul style={{ listStyle: "none", margin: "4px 0 0", padding: 0 }}>
        {["w-16", "w-20", "w-16", "w-20"].map((width, i) => (
          <li key={i} style={{ borderTop: i === 0 ? undefined : HAIR2 }}>
            <span style={{ ...ROW, justifyContent: "space-between", height: 27.6, padding: "0 5px" }}>
              <span style={{ ...ROW, gap: 7 }}>
                <Dot />
                <Skeleton className={`h-2.5 ${width}`} delay={i * 50} />
              </span>
              <span style={{ ...ROW, gap: 7 }}>
                <Skeleton className="h-2 w-[26px]" delay={i * 50 + 25} />
                <Skeleton className="h-2.5 w-6" delay={i * 50 + 50} />
              </span>
            </span>
          </li>
        ))}
      </ul>
      <span style={{ ...ROW, marginTop: 8, height: 15 }}>
        <Skeleton className="h-2.5 w-36" delay={220} />
      </span>
    </SkCard>
  );
}

/* -------------------------------------------------------------------------- */
/*  3 — Estados + temas                                                        */
/* -------------------------------------------------------------------------- */

function StatesCard() {
  const lengths = [88, 34, 20];
  return (
    <SkCard bodyStyle={{ display: "flex", flexDirection: "column" }}>
      <SkHead title="w-36" right={<Skeleton className="h-3 w-14" delay={30} />} />
      <ul style={{ listStyle: "none", margin: "2px 0 0", padding: 0 }}>
        {lengths.map((length, i) => (
          <li key={i} style={{ ...ROW, gap: 12, height: 31.6, padding: "0 6px" }}>
            <span style={{ width: "min(158px, 36%)", flexShrink: 0 }}>
              <Skeleton className="h-2.5 w-3/4" delay={i * 50} />
            </span>
            <span
              aria-hidden
              style={{ flex: 1, height: 10, borderRadius: 99, background: "#F1F4F8", overflow: "hidden" }}
            >
              <span
                className="plf-skeleton"
                style={{ display: "block", height: "100%", width: `${length}%`, borderRadius: 99, background: RAIL }}
              />
            </span>
            <span style={{ width: 34, display: "flex", justifyContent: "flex-end" }}>
              <Skeleton className="h-2.5 w-5" delay={i * 50 + 50} />
            </span>
          </li>
        ))}
      </ul>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))",
          gap: 8,
          marginTop: "auto",
          paddingTop: 12,
        }}
      >
        {[0, 1, 2].map((panel) => (
          <div
            key={panel}
            className="cx-inset"
            style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px" }}
          >
            <span style={{ ...ROW, gap: 6, height: 15.4 }}>
              <Dot size={8} round={false} />
              <Skeleton className="h-2.5 w-20" delay={panel * 60} />
            </span>
            <span style={{ ...ROW, gap: 6, height: 20 }}>
              <Skeleton className="h-5 w-8" delay={panel * 60 + 30} />
              <Skeleton className="h-2 w-6" delay={panel * 60 + 60} />
            </span>
          </div>
        ))}
      </div>
      <span style={{ ...ROW, marginTop: 8, height: 15.4 }}>
        <Skeleton className="h-2.5 w-56 max-w-full" delay={240} />
      </span>
    </SkCard>
  );
}

function TopicsCard() {
  return (
    <SkCard>
      <SkHead title="w-32" delay={60} />
      <div style={{ ...ROW, gap: 16, flexWrap: "wrap", marginTop: 2 }}>
        {/* Dona de `TicketByCategory`: 124 px, radio 46, trazo 16. */}
        <span style={{ position: "relative", width: 124, height: 124, margin: "4px 10px 4px 2px" }}>
          <svg aria-hidden viewBox="0 0 124 124" width={124} height={124} className="motion-safe:animate-pulse">
            <circle cx={62} cy={62} r={46} fill="none" stroke={RAIL} strokeWidth={16} />
          </svg>
          <span
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <Skeleton className="h-4 w-7" delay={60} />
            <Skeleton className="h-2 w-10" delay={90} />
          </span>
        </span>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, flex: 1, minWidth: 168 }}>
          {["w-32", "w-28", "w-24", "w-24", "w-28"].map((width, i) => (
            <li
              key={i}
              style={{ ...ROW, justifyContent: "space-between", height: 25, padding: "0 5px" }}
            >
              <span style={{ ...ROW, gap: 7 }}>
                <Dot round={false} />
                <Skeleton className={`h-2.5 ${width}`} delay={i * 50} />
              </span>
              <Skeleton className="h-2.5 w-4" delay={i * 50 + 25} />
            </li>
          ))}
        </ul>
      </div>
    </SkCard>
  );
}

/* -------------------------------------------------------------------------- */
/*  4 — Bandeja reciente                                                       */
/* -------------------------------------------------------------------------- */

/** Anchos relativos de las siete columnas, tomados del tablero cargado. */
const TABLE_COLS = "minmax(0,2.4fr) minmax(0,1.8fr) minmax(0,0.65fr) minmax(0,0.75fr) minmax(0,1.05fr) minmax(0,1.3fr) minmax(0,0.85fr)";

function RecentCard() {
  const tabs = [40, 54, 44, 112, 110, 70];
  return (
    <SkCard>
      <SkHead title="w-36" right={<ControlPill width={230} delay={40} />} />
      {/* Riel de pestañas: seis, en una pastilla `chip`. */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 3,
          margin: "12px 0",
          background: "#F0F2F5",
          borderRadius: 999,
          padding: 3,
          width: "fit-content",
          maxWidth: "100%",
        }}
      >
        {tabs.map((width, i) => (
          <span
            key={i}
            style={{
              ...ROW,
              justifyContent: "center",
              width: width + 24,
              height: 25,
              borderRadius: 999,
              background: i === 0 ? "#fff" : undefined,
            }}
          >
            {/* Sobre el gris del riel el brillo del esqueleto no se distingue:
                las inactivas van en `rail`, un paso mas oscuro, y quietas. */}
            {i === 0 ? (
              <Skeleton className="h-2 w-2/3 !rounded-full" />
            ) : (
              <span aria-hidden style={{ width: "66%", height: 8, borderRadius: 99, background: RAIL }} />
            )}
          </span>
        ))}
      </div>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 640 }}>
          <div style={{ display: "grid", gridTemplateColumns: TABLE_COLS, height: 23, alignItems: "start" }}>
            {[12, 12, 10, 14, 10, 18, 14].map((width, col) => (
              <span
                key={col}
                style={{ padding: "0 10px", display: "flex", justifyContent: col === 6 ? "flex-end" : "flex-start" }}
              >
                <span style={{ width: width * 4 }}>
                  <Skeleton className="h-2" delay={col * 25} />
                </span>
              </span>
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, row) => {
            const d = Math.min(row * 60, 300);
            return (
              <div
                key={row}
                style={{
                  display: "grid",
                  gridTemplateColumns: TABLE_COLS,
                  alignItems: "center",
                  height: 50,
                  borderTop: HAIR2,
                }}
              >
                <span style={{ padding: "0 10px", display: "flex", flexDirection: "column", gap: 6 }}>
                  <Skeleton className="h-3 w-20" delay={d} />
                  <Skeleton className="h-2.5 w-44 max-w-full" delay={d + 20} />
                </span>
                <span style={{ padding: "0 10px" }}>
                  <Skeleton className="h-3 w-4/5" delay={d + 40} />
                </span>
                <span style={{ padding: "0 10px" }}>
                  <Skeleton className="h-3 w-12" delay={d + 60} />
                </span>
                <span style={{ padding: "0 10px" }}>
                  <Skeleton className="h-3 w-12" delay={d + 80} />
                </span>
                <span style={{ padding: "0 10px" }}>
                  <Skeleton className="h-[21px] w-20 !rounded-full" delay={d + 100} />
                </span>
                <span style={{ ...ROW, gap: 7, padding: "0 10px" }}>
                  <Skeleton className="h-[22px] w-[22px] shrink-0 !rounded-full" delay={d + 120} />
                  <Skeleton className="h-3 w-12" delay={d + 120} />
                </span>
                <span style={{ padding: "0 10px", display: "flex", justifyContent: "flex-end" }}>
                  <Skeleton className="h-2.5 w-20" delay={d + 140} />
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div
        style={{
          ...ROW,
          justifyContent: "space-between",
          marginTop: 10,
          paddingTop: 9,
          borderTop: "1px solid #E9ECF1",
          height: 15.4 + 9,
        }}
      >
        <Skeleton className="h-2.5 w-12" delay={300} />
        <Skeleton className="h-2.5 w-32" delay={330} />
      </div>
    </SkCard>
  );
}

/* -------------------------------------------------------------------------- */
/*  5 — Canales + responsables                                                 */
/* -------------------------------------------------------------------------- */

function ChannelsCard() {
  const lengths = [100, 58, 46];
  return (
    <SkCard bodyStyle={{ display: "flex", flexDirection: "column" }}>
      <SkHead title="w-36" />
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {lengths.map((length, i) => (
          <li key={i} style={{ ...ROW, gap: 12, height: 29.6 + 5, padding: "0 6px" }}>
            <span style={{ width: 96, flexShrink: 0 }}>
              <Skeleton className="h-2.5 w-3/4" delay={i * 50} />
            </span>
            <span
              aria-hidden
              style={{ flex: 1, height: 10, borderRadius: 99, background: "#F1F4F8", overflow: "hidden" }}
            >
              <span
                className="plf-skeleton"
                style={{ display: "block", height: "100%", width: `${length}%`, borderRadius: 99, background: RAIL }}
              />
            </span>
            <span style={{ width: 52, display: "flex", justifyContent: "flex-end" }}>
              <Skeleton className="h-2.5 w-10" delay={i * 50 + 25} />
            </span>
            <span style={{ width: 38, display: "flex", justifyContent: "flex-end" }}>
              <Skeleton className="h-2 w-6" delay={i * 50 + 50} />
            </span>
            <span style={{ width: 40, display: "flex", justifyContent: "flex-end" }}>
              <Skeleton className="h-2.5 w-5" delay={i * 50 + 75} />
            </span>
          </li>
        ))}
      </ul>
      <span style={{ ...ROW, marginTop: "auto", paddingTop: 12, height: 15.4 + 12 }}>
        <Skeleton className="h-2.5 w-52 max-w-full" delay={200} />
      </span>
    </SkCard>
  );
}

const AGENT_COLS = "minmax(0,1fr) 58px 52px 40px";

function AgentsCard({ rows = 6 }: { rows?: number }) {
  return (
    <SkCard>
      <SkHead title="w-44" right={<ControlPill width={172} delay={40} />} delay={60} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: AGENT_COLS,
          gap: 8,
          padding: "0 5px 6px",
          height: 18,
          alignItems: "center",
        }}
      >
        <Skeleton className="h-2 w-20" />
        {[0, 1, 2].map((col) => (
          <span key={col} style={{ display: "flex", justifyContent: "flex-end" }}>
            <Skeleton className="h-2 w-9" delay={(col + 1) * 25} />
          </span>
        ))}
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {Array.from({ length: rows }).map((_, row) => {
          const d = Math.min(row * 60, 300);
          return (
            <li
              key={row}
              style={{
                display: "grid",
                gridTemplateColumns: AGENT_COLS,
                gap: 8,
                alignItems: "center",
                height: 60,
                padding: "0 5px",
                borderTop: HAIR2,
              }}
            >
              <span style={{ ...ROW, gap: 9, minWidth: 0 }}>
                <Skeleton className="h-7 w-7 shrink-0 !rounded-full" delay={d} />
                <span style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                  <Skeleton className="h-3 w-28 max-w-full" delay={d + 20} />
                  <span
                    aria-hidden
                    style={{ height: 3, margin: "6px 0 5px", borderRadius: 99, background: RAIL }}
                  />
                  <Skeleton className="h-2.5 w-20" delay={d + 40} />
                </span>
              </span>
              {[0, 1, 2].map((col) => (
                <span key={col} style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Skeleton className="h-3 w-4" delay={d + 60 + col * 20} />
                </span>
              ))}
            </li>
          );
        })}
      </ul>
    </SkCard>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Solo el contenido de la zona de scroll: `CXDashboard` pone la cabecera y el
 * contenedor con el mismo relleno y la misma separacion entre bandas que usa
 * con datos.
 */
export function DashboardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Cargando el tablero de operaciones"
      style={{ display: "flex", flexDirection: "column", gap: S.xl }}
    >
      <KpiTiles />

      <div className="cx-pair" style={WIDE}>
        <TrendCard />
        <StageCard />
      </div>

      <div className="cx-pair" style={WIDE}>
        <StatesCard />
        <TopicsCard />
      </div>

      <RecentCard />

      <div className="cx-pair" style={WIDE}>
        <ChannelsCard />
        <AgentsCard />
      </div>
    </div>
  );
}
