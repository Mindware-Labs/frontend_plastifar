import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  Inbox,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "../../api/client";
import { reportsApi, type ClientsReport, type QualityReport } from "../../api/reports";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { formatAmount } from "../../lib/quality";
import { useAuth } from "../../context/useAuth";
import { DistributionDonut, DotLegend, MonthlyBars } from "./charts";
import { ClientsTable } from "./ClientsTable";
import { Panel, QuickOverview, RefreshButton, StatCard } from "./panels";

/**
 * Tablero del panel.
 *
 * ------------------------------------------------------------------
 * DE DONDE SALE LA FORMA
 * ------------------------------------------------------------------
 * La disposicion es la de la referencia aprobada por el cliente: fila de cuatro
 * cifras con chip de icono, debajo un grafico ancho a dos tercios junto a un
 * reparto en dona a un tercio, y al pie una tabla con su propia barra de
 * busqueda y orden.
 *
 * El acento es el 185 C de Plastifar y no el azul del ejemplo: el Brandbook
 * 2026 es vinculante y este seria el unico modulo del panel que no se ve de la
 * empresa. Lo que se copio es la anatomia, que es lo que hace que se lea rapido.
 *
 * ------------------------------------------------------------------
 * TODO SALE DEL SERVIDOR
 * ------------------------------------------------------------------
 * Las cuatro cifras, las barras, la dona y la tabla salen de
 * GET /api/reports/quality y GET /api/reports/clients, que agregan en SQL.
 *
 * Lo que la referencia trae y aqui NO esta, por no tener con que sostenerlo:
 * las pastillas de variacion contra el periodo anterior (ningun endpoint
 * devuelve la comparacion) y las acciones por fila de la tabla (un vendedor no
 * tiene ficha propia). La ranura de la variacion queda cableada en `StatCard` y
 * se enciende sola el dia que el servidor la calcule.
 */

/**
 * Ventanas que el control de periodo ofrece.
 *
 * Son reales: `GET /api/reports/quality` recibe el rango, asi que cambiar el
 * selector cambia lo que el servidor agrega. Doce meses es el tope que admite
 * por consulta y por eso es el ultimo paso.
 */
const PERIODS = [
  { key: "3m", label: "Últimos 3 meses", months: 3 },
  { key: "6m", label: "Últimos 6 meses", months: 6 },
  { key: "12m", label: "Últimos 12 meses", months: 12 },
] as const;

type PeriodKey = (typeof PERIODS)[number]["key"];

function periodRange(months: number) {
  const to = new Date();
  const from = new Date(to);
  from.setMonth(from.getMonth() - (months - 1));
  from.setDate(1);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: iso(from), to: iso(to) };
}

/**
 * Variacion del ultimo mes cerrado contra el anterior, en porcentaje.
 *
 * Se calcula de `byMonth`, que es una serie real: no es una comparacion
 * inventada contra "el periodo anterior" que ningun endpoint devuelve. Da
 * `undefined` cuando no hay dos meses con que comparar o cuando el mes previo
 * fue cero —dividir por cero produce un infinito, no una tendencia.
 */
function monthOverMonth(series: number[]): number | undefined {
  if (series.length < 2) return undefined;
  const previous = series[series.length - 2];
  const last = series[series.length - 1];
  if (previous === 0) return undefined;
  return ((last - previous) / previous) * 100;
}

const monthFormat = new Intl.DateTimeFormat("es-DO", { month: "short" });
const longDateFormat = new Intl.DateTimeFormat("es-DO", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

/**
 * Saludo segun la hora local de quien mira.
 *
 * Las tres franjas son las del habla dominicana, no las de un reloj partido en
 * dos: "buenas tardes" arranca al mediodia y "buenas noches" a las siete.
 */
function greeting(hour: number) {
  if (hour < 12) return "Buenos días";
  return hour < 19 ? "Buenas tardes" : "Buenas noches";
}

export function DashboardPage() {
  const { user } = useAuth();
  const [quality, setQuality] = useState<QualityReport | null>(null);
  const [clients, setClients] = useState<ClientsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [period, setPeriod] = useState<PeriodKey>("12m");

  const periodEntry = PERIODS.find((entry) => entry.key === period) ?? PERIODS[2];
  const range = useMemo(() => periodRange(periodEntry.months), [periodEntry.months]);

  const load = useCallback(() => {
    setError(null);
    setIsLoading(true);
    Promise.all([reportsApi.quality(range.from, range.to), reportsApi.clients()])
      .then(([q, c]) => {
        setQuality(q);
        setClients(c);
      })
      .catch((err) =>
        setError(
          err instanceof ApiError
            ? `${err.message} Vuelve a intentarlo.`
            : "No se pudo cargar el resumen. Vuelve a intentarlo.",
        ),
      )
      .finally(() => setIsLoading(false));
  }, [range.from, range.to]);

  useEffect(load, [load]);

  const months = useMemo(
    () =>
      (quality?.byMonth ?? []).map((entry) => ({
        label: monthFormat.format(new Date(`${entry.month}-01T00:00:00`)).replace(".", ""),
        opened: entry.opened,
        closed: entry.closed,
      })),
    [quality],
  );

  /** Promedio de aperturas del periodo, redondeado: es la linea del grafico. */
  const average = useMemo(() => {
    if (months.length === 0) return 0;
    return Math.round(months.reduce((sum, m) => sum + m.opened, 0) / months.length);
  }, [months]);

  const territories = useMemo(
    () =>
      (clients?.byTerritory ?? [])
        .filter((entry) => entry.total > 0)
        .map((entry) => ({ name: entry.territory, value: entry.total })),
    [clients],
  );

  const ready = quality !== null && clients !== null;

  /** Variacion mes contra mes de las dos series que el servidor sí devuelve. */
  const openedDelta = useMemo(
    () => monthOverMonth((quality?.byMonth ?? []).map((m) => m.opened)),
    [quality],
  );
  const closedDelta = useMemo(
    () => monthOverMonth((quality?.byMonth ?? []).map((m) => m.closed)),
    [quality],
  );

  // El token solo trae el correo: no hay nombre completo que mostrar, asi que
  // se saluda con la parte local capitalizada, igual que hace el Sidebar. Un
  // "Buenos dias, usuario" generico seria peor que no saludar.
  const local = user?.email.split("@")[0] ?? "";
  const name = local.charAt(0).toUpperCase() + local.slice(1);
  const today = new Date();

  /** Concentracion de la cartera: los cuatro primeros y el resto agrupado. */
  const repSlices = useMemo(
    () => (clients?.bySalesRep ?? []).map((row) => ({ name: row.salesRep, value: row.clients })),
    [clients],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-line pb-4">
        <div>
          <h1 className="font-heading text-[20px] font-bold tracking-[-0.02em] text-ink">
            {greeting(today.getHours())}
            {name && `, ${name}`}
          </h1>
          {/* La fecha va aqui y no en un selector: el tablero mira siempre los
              ultimos doce meses, y un control que solo ofrece una opcion es un
              adorno con forma de control. */}
          <p className="mt-1 text-[12.5px] text-subtle">
            <span className="first-letter:uppercase">{longDateFormat.format(today)}</span> · Calidad
            y cartera
          </p>
        </div>
        {/* Fila de controles de la referencia. Los dos son reales: el periodo
            viaja al endpoint y el boton vuelve a pedir los dos reportes. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-faint">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <Select
              size="sm"
              aria-label="Período"
              value={period}
              onChange={(value) => setPeriod(value as PeriodKey)}
              options={PERIODS.map((entry) => ({ value: entry.key, label: entry.label }))}
              className="w-[164px]"
            />
          </span>
          <RefreshButton onClick={load} busy={isLoading} />
          <Button size="sm" onClick={load} isLoading={isLoading}>
            Generar reporte
          </Button>
        </div>
      </div>

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
        error === null && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} aria-hidden className="h-[132px] animate-pulse rounded-card bg-fill" />
            ))}
          </div>
        )
      ) : (
        <div className={`flex flex-col gap-4 ${isLoading ? "opacity-60" : ""}`}>
          {/* 1 — banda de contexto: el tamano de la cartera, en una linea. */}
          <QuickOverview
            title="Resumen rápido"
            stats={[
              { label: "Clientes en cartera", value: clients.total.toLocaleString("es-DO") },
              { label: "Clientes activos", value: clients.active.toLocaleString("es-DO") },
              { label: "Sin vendedor", value: String(clients.withoutSalesRep) },
              { label: "Territorios", value: String(territories.length) },
              { label: "Vendedores", value: String(clients.bySalesRep.length) },
            ]}
          />

          {/* 2 — reparto a la izquierda, cifras de Calidad a la derecha: es la
                 fila de la referencia, y separa "como esta repartido" de "que
                 hay que atender". */}
          {/* Las tarjetas de una fila comparten alto, como en la referencia. El
              sobrante no se amontona al pie de la tarjeta corta: `Panel` centra
              su contenido, asi que el aire queda repartido arriba y abajo del
              grafico en vez de leerse como un panel a medio cargar. */}
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            <Panel
              title="Cartera por territorio"
              actions={<RefreshButton onClick={load} busy={isLoading} />}
            >
              <DistributionDonut data={territories} unit="clientes" />
            </Panel>

            <div className="grid auto-rows-min content-start grid-cols-1 gap-3 sm:grid-cols-2 xl:col-span-2">
              <StatCard
                icon={ClipboardCheck}
                label="HCA abiertas"
                value={String(quality.openNow)}
                help="Hojas de acción correctiva sin cerrar a día de hoy."
              />
              <StatCard
                icon={AlertTriangle}
                label="HCA vencidas"
                value={String(quality.overdueNow)}
                tone={quality.overdueNow > 0 ? "red" : "green"}
                help="Pasaron su fecha comprometida y siguen abiertas."
              />
              <StatCard
                icon={Inbox}
                label="HCA del período"
                value={String(quality.openedInRange)}
                // La pastilla sale de `byMonth`, que es una serie real: compara
                // el ultimo mes cerrado contra el anterior. Donde el servidor no
                // tiene con que comparar, la ranura queda vacia en vez de
                // inventarse un porcentaje.
                delta={openedDelta}
                help={`Abiertas en ${periodEntry.label.toLowerCase()}. La variación compara el último mes con el anterior.`}
              />
              <StatCard
                icon={CheckCircle2}
                label="HCA cerradas"
                value={String(quality.closedInRange)}
                tone="green"
                delta={closedDelta}
                help={`Cerradas en ${periodEntry.label.toLowerCase()}. La variación compara el último mes con el anterior.`}
              />
              <StatCard
                icon={Clock}
                label="Cierre promedio"
                value={
                  quality.averageClosureDays === null
                    ? "Sin datos"
                    : `${quality.averageClosureDays} d`
                }
                tone={quality.averageClosureDays === null ? "warn" : "neutral"}
                help="Días desde la apertura hasta el cierre. Sin datos si no se cerró ninguna."
              />
              <StatCard
                icon={FileText}
                label="Notas de crédito"
                value={String(quality.credits.count)}
                tone={quality.credits.count > 0 ? "warn" : "neutral"}
                help={
                  quality.credits.byCurrency.length === 0
                    ? "Ninguna emitida en el período."
                    : quality.credits.byCurrency
                        .map((entry) => formatAmount(entry.total, entry.currency))
                        .join(" · ")
                }
              />
            </div>
          </div>

          {/* 3 — el grafico ancho y, a su lado, que tan concentrada esta la
                 cartera: la dona responde "¿depende todo de dos personas?",
                 la tabla de abajo da el listado. Son dos preguntas. */}
          {/* Las tarjetas de una fila comparten alto, como en la referencia. El
              sobrante no se amontona al pie de la tarjeta corta: `Panel` centra
              su contenido, asi que el aire queda repartido arriba y abajo del
              grafico en vez de leerse como un panel a medio cargar. */}
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            <Panel
              title="HCA por mes"
              className="xl:col-span-2"
              actions={<RefreshButton onClick={load} busy={isLoading} />}
            >
              <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
                <div>
                  <p className="font-heading text-[28px] font-bold leading-none tabular-nums text-ink">
                    {quality.openedInRange.toLocaleString("es-DO")}
                  </p>
                  <p className="mt-1 text-[11.5px] text-faint">
                    abiertas en el período · {quality.closedInRange} cerradas
                  </p>
                </div>
                <DotLegend
                  items={[
                    { label: "Abiertas", color: "var(--color-line-strong)" },
                    { label: "Cerradas", color: "var(--color-brand-red)" },
                  ]}
                />
              </div>
              <MonthlyBars data={months} average={average} />
            </Panel>

            <Panel
              title="Concentración de la cartera"
              actions={<RefreshButton onClick={load} busy={isLoading} />}
            >
              <DistributionDonut data={repSlices} unit="clientes" />
            </Panel>
          </div>

          {/* 4 — la tabla al pie, con casilla, filtro, estado y acciones. */}
          <ClientsTable />
        </div>
      )}
    </div>
  );
}
