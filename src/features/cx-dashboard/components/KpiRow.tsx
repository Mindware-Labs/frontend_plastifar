import { COUNTS, QUALITY, RANGES, series } from "../mockData";
import { useApplyFilter, type DashboardFilter } from "../filters";
import { C, CARD_RADIUS, FONT, NUM, S, T, hueFor, n } from "../styles";

/**
 * La fila de cifras.
 *
 * ------------------------------------------------------------------
 * TARJETAS SEPARADAS, CROMO NEUTRO
 * ------------------------------------------------------------------
 * Seis tarjetas con su propio borde. Lo que NO vuelve es el filete de color de
 * 4 px: aquello era decoración disfrazada de dato, porque el tono no codificaba
 * nada. El borde y el fondo se quedan neutros.
 *
 * La única excepción es «Fuera de plazo»: fondo tintado y cifra en rojo, porque
 * ahí el color sí dice algo. Si llega a cero, la tarjeta se vuelve neutra como
 * las demás — un acento de alarma permanente deja de ser una alarma.
 *
 * ------------------------------------------------------------------
 * LA SPARKLINE SANGRA AL BORDE
 * ------------------------------------------------------------------
 * `preserveAspectRatio="none"` y márgenes negativos que cancelan el relleno de
 * la tarjeta. Que toque los tres bordes es lo que la hace ver deliberada;
 * flotando con aire alrededor se lee como un adorno que sobró.
 */

const PAD_X = 14;
const PAD_Y = 12;

/* -------------------------------------------------------------------------- */

/**
 * Sparkline a sangre.
 *
 * `viewBox` de 100×30 con `preserveAspectRatio="none"`: el trazo se estira a lo
 * ancho sin importar cuánto mida la tarjeta. El precio es que la pendiente no es
 * comparable entre tarjetas de distinto ancho — no importa: acá dice «la forma
 * de las últimas diez lecturas», no una tasa. `vectorEffect` mantiene el grosor
 * en 1,5 px aunque el eje X se estire.
 */
function Sparkline({
  data,
  tone,
  opacity = 1,
}: {
  data: number[];
  tone: string;
  opacity?: number;
}) {
  const W = 100;
  const H = 30;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const d = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((v - min) / (max - min || 1)) * (H - 6) - 3;
      return `${i ? "L" : "M"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden
      style={{
        display: "block",
        marginTop: "auto",
        marginLeft: -PAD_X,
        marginBottom: -PAD_Y,
        width: `calc(100% + ${PAD_X * 2}px)`,
        height: 30,
      }}
    >
      <path
        d={d}
        className={opacity === 1 ? "cx-spark" : undefined}
        fill="none"
        stroke={tone}
        strokeOpacity={opacity}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */

interface Kpi {
  label: string;
  value: string;
  /** Variación contra ayer, ya redactada. */
  change: string;
  /** Qué peso tiene sobre el total. */
  weight: string;
  spark: number[];
  filter: DashboardFilter;
}

function KpiCard({ kpi, lead = false }: { kpi: Kpi; lead?: boolean }) {
  const applyFilter = useApplyFilter();
  const bad = hueFor("vencido");
  /* El acento existe sólo mientras haya algo fuera de plazo. */
  const alert = lead && COUNTS.overdue > 0;

  return (
    <div
      className="cx-card cx-hover"
      style={{ background: alert ? bad.tint : C.card, borderRadius: CARD_RADIUS }}
    >
      <button
        type="button"
        className="cx-link"
        onClick={() => applyFilter(kpi.filter)}
        title={`Ver ${kpi.filter.label}`}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          width: "100%",
          height: "100%",
          minWidth: 0,
          padding: `${PAD_Y}px ${PAD_X}px`,
          border: "none",
          background: "transparent",
          textAlign: "left",
          fontFamily: FONT,
          cursor: "pointer",
          overflow: "hidden",
        }}
      >
        <span style={{ display: "flex", justifyContent: "space-between", gap: S.sm }}>
          <span
            style={{
              ...T.label,
              color: alert ? bad.color : C.body,
              fontWeight: alert ? 600 : 500,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {kpi.label}
          </span>
          <span style={{ ...T.caption, ...NUM, color: C.soft, flexShrink: 0 }}>{kpi.change}</span>
        </span>

        <span
          style={{
            ...(lead ? T.figureXl : T.figure),
            ...NUM,
            color: alert ? bad.color : C.ink,
          }}
        >
          {kpi.value}
        </span>

        <span
          style={{
            ...T.caption,
            ...NUM,
            color: C.soft,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {kpi.weight}
        </span>

        <Sparkline
          data={kpi.spark}
          tone={alert ? bad.color : C.faintMark}
          opacity={alert ? 0.55 : 1}
        />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function KpiRow({ range }: { range: string }) {
  const cfg = RANGES[range];
  const mk = (seed: number) => series(cfg.seed + seed, 10, 20, 90);
  const live = COUNTS.open + COUNTS.upcoming + COUNTS.overdue + COUNTS.waitingOnClient;
  const pct = (v: number) => (live === 0 ? "—" : `${Math.round((v / live) * 100)}% de los vivos`);

  const lead: Kpi = {
    label: COUNTS.overdue > 0 ? "Fuera de plazo" : "Todo al día",
    value: n(COUNTS.overdue),
    change: COUNTS.overdue > 0 ? "+4 que ayer" : "sin cambios",
    weight: pct(COUNTS.overdue),
    spark: mk(1),
    filter: { kind: "estado", value: "vencidos", label: "los tickets vencidos" },
  };

  const rest: Kpi[] = [
    {
      label: "Por vencer",
      value: n(COUNTS.upcoming),
      change: "+6 que ayer",
      weight: pct(COUNTS.upcoming),
      spark: mk(2),
      filter: { kind: "estado", value: "por-vencer", label: "los tickets por vencer" },
    },
    {
      label: "Abiertos",
      value: n(COUNTS.open),
      change: "−3 que ayer",
      weight: pct(COUNTS.open),
      spark: mk(3),
      filter: { kind: "estado", value: "abiertos", label: "los tickets abiertos" },
    },
    {
      label: "En espera",
      value: n(COUNTS.waitingOnClient),
      change: "+2 que ayer",
      weight: "del cliente",
      spark: mk(4),
      filter: { kind: "estado", value: "espera", label: "los tickets en espera del cliente" },
    },
    {
      label: "HCA abiertas",
      value: n(QUALITY.openNow),
      change: "−2 que ayer",
      weight: `${n(QUALITY.overdueNow)} vencidas`,
      spark: mk(5),
      filter: { kind: "hca", value: "abiertas", label: "las HCA abiertas" },
    },
    {
      label: "Cierre promedio",
      value: `${n(QUALITY.averageClosureDays, 1)} d`,
      change: "−0,6 d",
      weight: "por HCA",
      spark: mk(6),
      filter: { kind: "hca", value: "cerradas", label: "las HCA cerradas" },
    },
  ];

  return (
    <div
      className="cx-kpis"
      style={{
        display: "grid",
        gridTemplateColumns: "1.35fr repeat(5, minmax(0, 1fr))",
        gap: S.md,
        alignItems: "stretch",
      }}
    >
      <KpiCard kpi={lead} lead />
      {rest.map((kpi) => (
        <KpiCard key={kpi.label} kpi={kpi} />
      ))}
    </div>
  );
}
