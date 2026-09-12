import {
  Activity,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock,
  MapPin,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../../api/client";
import { reportsApi, type ClientsReport, type QualityReport } from "../../api/reports";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Board, KpiRow, PeriodTabs, RefreshButton, type KpiItem } from "./board";
import { CategoryBars, HealthGauge, SeriesLegend, TrendArea } from "./boardCharts";
import { TerritoriesTable } from "./TerritoriesTable";
import { formatDecimal, formatInteger, formatPercent } from "./format";

/**
 * Tablero del panel.
 *
 * ------------------------------------------------------------------
 * DE DONDE SALE LA FORMA
 * ------------------------------------------------------------------
 * La anatomia sale de la referencia (image.png) y va en cuatro bandas, de
 * arriba hacia abajo:
 *
 *   1. Fila de cuatro cifras, cada una con su variacion y su direccion.
 *   2. Curva de tendencia ancha + indicador radial de salud.
 *   3. Comparacion por categoria + tabla de cierre.
 *
 * Lo que NO se copia es el estilo. La referencia es azul, de tarjetas blandas
 * con sombra y esquinas redondas; esta pantalla vuelve al sistema del panel:
 * filete de 1 px, canto de 2 px, cero sombra en lo que hace scroll y un solo
 * acento, el 185 C del Brandbook. Antes de esta version el Dashboard era la
 * unica superficie de tarjetas del panel — una excepcion declarada que se
 * revierte aqui por pedido explicito.
 *
 * ------------------------------------------------------------------
 * DE DONDE SALEN LOS DATOS
 * ------------------------------------------------------------------
 * Las cifras, la curva, las barras, el indicador y la tabla salen de
 * GET /api/reports/quality y GET /api/reports/clients.
 *
 * Las tres pastillas de variacion comparan la ventana elegida contra la
 * inmediata anterior, que es una segunda consulta real al mismo endpoint.
 *
 * La cuarta ficha —clientes activos— NO lleva pastilla: el reporte de clientes
 * es una foto sin rango y el servidor no guarda la anterior. La ranura queda
 * vacia antes que con un porcentaje inventado.
 */

const PERIODS = [
  { key: "3m", label: "3 m", months: 3 },
  { key: "6m", label: "6 m", months: 6 },
  { key: "12m", label: "12 m", months: 12 },
] as const;

type PeriodKey = (typeof PERIODS)[number]["key"];

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function periodRange(months: number) {
  const to = new Date();
  const from = new Date(to);
  from.setMonth(from.getMonth() - (months - 1));
  from.setDate(1);
  return { from: iso(from), to: iso(to) };
}

/**
 * La MISMA ventana, corrida un periodo hacia atras.
 *
 * Es lo que hace que la pastilla de variacion compare lo que dice comparar. La
 * primera version enfrentaba el ultimo mes contra el anterior mientras la cifra
 * de arriba era el total de doce: dos hechos distintos a dos centimetros, uno
 * presentado como la variacion del otro.
 */
function previousRange(months: number) {
  const to = new Date();
  to.setDate(1);
  to.setMonth(to.getMonth() - (months - 1));
  // Un dia antes del arranque de la ventana actual: las dos no se solapan.
  to.setDate(0);
  const from = new Date(to);
  from.setMonth(from.getMonth() - (months - 1));
  from.setDate(1);
  return { from: iso(from), to: iso(to) };
}

/**
 * Variacion entre dos periodos, en porcentaje.
 *
 * Da `undefined` cuando falta una de las dos cifras o cuando la anterior fue
 * cero: dividir por cero produce un infinito, no una tendencia.
 */
function variation(current: number | null, previous: number | null): number | undefined {
  if (current === null || previous === null || previous === 0) return undefined;
  return ((current - previous) / previous) * 100;
}

const monthFormat = new Intl.DateTimeFormat("es-DO", { month: "short" });

/**
 * Meta de cierre del panel. Es el mismo umbral del que cuelga el veredicto
 * verde del indicador, y por eso vive en una constante: enunciarlo en una frase
 * y dibujarlo en otro archivo con otro numero es como se desincronizan.
 */
const CLOSURE_GOAL = 0.85;

/** Esqueleto con la MISMA reparticion que el tablero cargado: al llegar los
 *  datos lo unico que cambia es que las cajas se llenan, no que saltan. */
function DashboardSkeleton() {
  const box = "animate-pulse rounded-edge border border-line bg-canvas";
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <div className={`h-[112px] shrink-0 ${box}`} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className={`h-[320px] xl:col-span-8 ${box}`} />
        <div className={`h-[320px] xl:col-span-4 ${box}`} />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className={`h-[340px] xl:col-span-5 ${box}`} />
        <div className={`h-[340px] xl:col-span-7 ${box}`} />
      </div>
      <span className="sr-only">Cargando el tablero…</span>
    </div>
  );
}

export function DashboardPage() {
  const [quality, setQuality] = useState<QualityReport | null>(null);
  /** El mismo reporte, un periodo atras. Es contra esto que comparan las fichas. */
  const [previous, setPrevious] = useState<QualityReport | null>(null);
  const [clients, setClients] = useState<ClientsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodKey>("12m");

  const periodEntry = PERIODS.find((entry) => entry.key === period) ?? PERIODS[2];
  const range = useMemo(() => periodRange(periodEntry.months), [periodEntry.months]);
  const before = useMemo(() => previousRange(periodEntry.months), [periodEntry.months]);

  const load = useCallback(() => {
    setError(null);
    setIsLoading(true);
    Promise.all([
      reportsApi.quality(range.from, range.to),
      reportsApi.quality(before.from, before.to),
      reportsApi.clients(),
    ])
      .then(([q, p, c]) => {
        setQuality(q);
        setPrevious(p);
        setClients(c);
      })
      .catch((err) =>
        setError(
          err instanceof ApiError
            ? `${err.message} Vuelve a intentarlo.`
            : "No se pudo cargar el tablero. Vuelve a intentarlo.",
        ),
      )
      .finally(() => setIsLoading(false));
  }, [range.from, range.to, before.from, before.to]);

  useEffect(load, [load]);

  /**
   * El periodo por defecto se ajusta UNA vez a la data que existe. Doce meses
   * fijos en una operacion que arranco hace dos dejaban diez columnas en cero y
   * el tablero se leia como si el reporte estuviera roto.
   */
  const autoRanged = useRef(false);
  useEffect(() => {
    if (autoRanged.current || !quality) return;
    autoRanged.current = true;

    const withActivity = quality.byMonth.filter((m) => m.opened > 0 || m.closed > 0).length;
    if (withActivity === 0) return;

    const fits = PERIODS.find((entry) => entry.months >= withActivity);
    if (fits && fits.key !== period) setPeriod(fits.key);
  }, [quality, period]);

  const months = useMemo(
    () =>
      (quality?.byMonth ?? []).map((entry) => ({
        label: monthFormat.format(new Date(`${entry.month}-01T00:00:00`)).replace(".", ""),
        opened: entry.opened,
        closed: entry.closed,
      })),
    [quality],
  );

  const openedDelta = variation(quality?.openedInRange ?? null, previous?.openedInRange ?? null);
  const closedDelta = variation(quality?.closedInRange ?? null, previous?.closedInRange ?? null);
  const closureDelta = variation(
    quality?.averageClosureDays ?? null,
    previous?.averageClosureDays ?? null,
  );

  const territories = useMemo(
    () =>
      (clients?.byTerritory ?? [])
        .filter((entry) => entry.total > 0)
        .map((entry) => ({ name: entry.territory, value: entry.total })),
    [clients],
  );

  const ready = quality !== null && clients !== null;

  /**
   * Las cuatro cifras de la fila superior. El orden ES la jerarquia: primero lo
   * que entro, despues lo que se cerro, despues el tamano de la cartera y al
   * final el tiempo que cuesta cerrar.
   */
  const kpis: KpiItem[] = useMemo(() => {
    if (!quality || !clients) return [];
    const activeShare = clients.total === 0 ? 0 : clients.active / clients.total;

    return [
      {
        icon: ClipboardList,
        label: "HCA abiertas",
        to: "/calidad/hca",
        value: formatInteger(quality.openedInRange),
        hint: "Contra el período anterior",
        delta: openedDelta,
        // Abrir mas HCA que el mes pasado no es una mejora: la pastilla dice el
        // veredicto, no la direccion aritmetica.
        invert: true,
        tone: "neutral",
      },
      {
        icon: CheckCircle2,
        label: "HCA cerradas",
        to: "/calidad/hca?estado=cerradas",
        value: formatInteger(quality.closedInRange),
        hint: "Contra el período anterior",
        delta: closedDelta,
        tone: "green",
      },
      {
        icon: UserCheck,
        label: "Clientes activos",
        to: "/clientes",
        value: formatInteger(clients.active),
        // SIN pastilla de variacion, a proposito. El reporte de clientes es una
        // foto sin rango: el servidor no guarda la anterior, asi que no hay
        // contra que comparar. La version previa de esta pantalla llevaba un
        // "+2,4 %" escrito a mano que no se movia al cambiar el periodo — un
        // numero inventado con forma de dato, que es justo lo que PRODUCT.md
        // prohibe. La ranura queda vacia y el tercer renglon dice por que.
        hint: `${formatPercent(activeShare)} de la cartera · sin período previo`,
        tone: "neutral",
      },
      {
        icon: Clock,
        label: "Cierre promedio",
        to: "/calidad/hca?estado=cerradas",
        value:
          quality.averageClosureDays === null
            ? "Sin datos"
            : `${formatDecimal(quality.averageClosureDays)} d`,
        hint:
          quality.averageClosureDays === null
            ? "No se cerró ninguna en el período"
            : "Contra el período anterior",
        delta: closureDelta,
        invert: true,
        tone: quality.averageClosureDays === null ? "warn" : "neutral",
      },
    ];
  }, [quality, clients, openedDelta, closedDelta, closureDelta]);

  /**
   * Salud del periodo: cuanto de lo que se abrio quedo cerrado.
   *
   * Es la unica metrica de salud que estos dos endpoints permiten calcular sin
   * estimar nada. Se recorta en 1 para el anillo —un periodo puede cerrar HCA
   * abiertas antes de la ventana y pasar del 100 %—, y el pie dice las dos
   * cifras crudas para que ese recorte no esconda el hecho.
   */
  const closureRate = useMemo(() => {
    if (!quality || quality.openedInRange === 0) return null;
    return quality.closedInRange / quality.openedInRange;
  }, [quality]);

  return (
    <div className="flex h-full flex-col">
      {/* Cabecera de modulo: filete y controles a la derecha, nada mas. El
          nombre de la pantalla lo dice la miga de la TopBar — repetirlo aqui
          seria el mismo hecho dos veces, que es la regla del panel. */}
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-b border-line pb-3">
        <PeriodTabs options={PERIODS} value={period} onChange={setPeriod} />
        <RefreshButton onClick={load} busy={isLoading} />
      </div>

      {/* EL SCROLL DE LA PAGINA VIVE ACA. `AppLayout` pone `overflow-hidden` en
          `main` a proposito: cada pantalla declara su propia zona de scroll. Sin
          esta linea, cuatro bandas mas altas que el viewport no se recortaban a
          medias — se recortaban del todo, sin forma de llegar a la tabla.
          `-mx-1 px-1`: al fijar el scroll vertical el eje horizontal deja de ser
          `visible` y el anillo de foco de una ficha quedaba cortado contra el
          borde; el relleno le da sitio y el margen negativo lo devuelve. */}
      <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 pt-4 pb-8">
        {error && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[240px] flex-1">
              <Alert variant="error">{error}</Alert>
            </div>
            <Button size="sm" variant="secondary" onClick={load} disabled={isLoading}>
              Reintentar
            </Button>
          </div>
        )}

        {!ready ? (
          error === null && <DashboardSkeleton />
        ) : (
          <div className={`plf-stagger flex flex-col gap-4 ${isLoading ? "opacity-60" : ""}`}>
            {/* 1 — LAS CUATRO CIFRAS. */}
            <KpiRow items={kpis} />

            {/* 2 — TENDENCIA + SALUD. */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
              <Board
                title="Tendencia del período"
                hint="HCA abiertas y cerradas, mes a mes."
                className="min-h-[320px] xl:col-span-8"
                actions={
                  <SeriesLegend
                    items={[
                      { label: "Abiertas", color: "var(--color-subtle)" },
                      { label: "Cerradas", color: "var(--color-brand-red)" },
                    ]}
                  />
                }
              >
                {months.length === 0 ? (
                  <p className="py-10 text-center text-[13.5px] text-faint">
                    Todavía no hay meses con actividad en esta ventana.
                  </p>
                ) : (
                  <TrendArea data={months} />
                )}
              </Board>

              <Board
                title="Tasa de cierre"
                hint="Salud del período"
                className="min-h-[320px] xl:col-span-4"
                actions={
                  <span
                    aria-hidden
                    className="flex h-[22px] w-[22px] items-center justify-center rounded-edge bg-fill text-subtle"
                  >
                    <Activity className="h-[13px] w-[13px]" />
                  </span>
                }
              >
                {closureRate === null ? (
                  <p className="py-10 text-center text-[13.5px] text-faint">
                    No se abrió ninguna HCA en el período.
                  </p>
                ) : (
                  <HealthGauge
                    fraction={closureRate}
                    goal={CLOSURE_GOAL}
                    caption={`${formatInteger(quality.closedInRange)} cerradas de ${formatInteger(quality.openedInRange)} abiertas en la ventana.`}
                    footnote={`La marca del arco es la meta: cerrar al menos ${formatPercent(CLOSURE_GOAL)} de lo que se abre.`}
                  />
                )}
              </Board>
            </div>

            {/* 3 — COMPARACION POR CATEGORIA + TABLA DE CIERRE. */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
              <Board
                title="Cartera por territorio"
                hint="Los siete territorios con más clientes."
                // Sin piso propio: la fila la mide la tabla, que es la que tiene
                // largo real. Con 340 px de minimo este panel estiraba siete
                // barras de 18 px sobre medio metro de aire, en un tablero
                // pedido a densidad de mesa de trabajo.
                className="xl:col-span-5"
                actions={
                  <span
                    aria-hidden
                    className="flex h-[22px] w-[22px] items-center justify-center rounded-edge bg-fill text-subtle"
                  >
                    <BarChart3 className="h-[13px] w-[13px]" />
                  </span>
                }
              >
                <CategoryBars data={territories} unit="clientes" />
              </Board>

              <Board
                title="Detalle por territorio"
                hint="Participación y actividad de cada zona."
                className="min-h-[340px] xl:col-span-7"
                bodyClassName="overflow-y-auto"
                actions={
                  <span className="flex items-center gap-1.5 text-[11.5px] text-faint">
                    <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {formatInteger(territories.length)} con cartera
                  </span>
                }
              >
                <TerritoriesTable report={clients} />
              </Board>
            </div>

            {/* Nota de procedencia. Va al pie y una sola vez. */}
            <p className="flex items-center gap-1.5 text-[11px] leading-tight text-faint">
              <TrendingUp className="h-3 w-3 shrink-0" aria-hidden />
              Todo sale de los reportes de Calidad y Clientes. Las variaciones comparan el
              período elegido contra el inmediato anterior; la cartera no la lleva porque es
              una foto y el servidor no guarda la del período pasado.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
