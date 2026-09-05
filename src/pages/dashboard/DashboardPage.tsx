import { AlertTriangle, CheckCircle2, Inbox, RefreshCcw, UserX } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "../../components/ui/Alert";
import { Spinner } from "../../components/ui/Spinner";
import { dashboardMock } from "../../mocks/dashboard";
import type { DashboardData, KpiKey } from "../../types/dashboard";
import { DashboardCard } from "./DashboardCard";
import { KpiTile } from "./KpiTile";
import { MonoRoundedBarChart } from "./mono-charts/MonoRoundedBarChart";
import { MonoRoundedDonutChart } from "./mono-charts/MonoRoundedDonutChart";
import { MonoRoundedStreamChart } from "./mono-charts/MonoRoundedStreamChart";
import { PriorityBars } from "./PriorityBars";
import { SlaDonut } from "./SlaDonut";
import { SystemStatusCard } from "./SystemStatusCard";
import { TicketsTable } from "./TicketsTable";

const kpiIcon: Record<KpiKey, typeof Inbox> = {
  open: Inbox,
  inProgress: RefreshCcw,
  unassigned: UserX,
  slaAtRisk: AlertTriangle,
  resolved: CheckCircle2,
};

/**
 * Sangrado a borde completo. <main> (src/layouts/AppLayout.tsx, que NO es de
 * este modulo) aplica `px-8 pt-4 pb-12` y no expone ningun token con esos
 * valores; el tinte del Dashboard tiene que cancelarlos para llegar al borde.
 * Los tres valores ya no viven aqui: son `--plf-page-x/-t/-b`, declarados una
 * sola vez en src/index.css y leidos tanto por AppLayout como por esta pagina.
 * Mientras fueron dos numeros escritos a mano en dos archivos, cambiar el
 * padding del marco rompia el tinte del Dashboard sin que nada avisara.
 */
const BLEED_CLASS =
  "mx-[calc(var(--plf-page-x)*-1)] mt-[calc(var(--plf-page-t)*-1)] mb-[calc(var(--plf-page-b)*-1)] " +
  "px-[var(--plf-page-x)] pt-6 pb-[var(--plf-page-b)]";

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Arranca en true: la primera carga sale ya en vuelo desde el primer render.
  const [refreshing, setRefreshing] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Una sola via de carga para el primer render y para "Actualizar": el exito
  // limpia el error (si no, un fallo pasajero dejaba el aviso pegado para
  // siempre) y sella la hora que muestra SystemStatusCard.
  const fetchData = useCallback(() => {
    dashboardMock
      .data()
      .then((fresh) => {
        setData(fresh);
        setLastSync(new Date());
        setError(null);
      })
      .catch(() => setError("No se pudo cargar el dashboard"))
      .finally(() => setRefreshing(false));
  }, []);

  // Re-carga a peticion: marca el vuelo y reusa exactamente el mismo camino.
  const load = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  useEffect(fetchData, [fetchData]);

  const categoryBreakdown = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const ticket of data.tickets) counts.set(ticket.category, (counts.get(ticket.category) ?? 0) + 1);
    return [...counts.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 4);
  }, [data]);

  return (
    // Tinte propio del Dashboard: rompe con el blanco del resto del panel a
    // proposito (excepcion ya documentada en DESIGN.md) para que las tarjetas
    // blancas tengan de verdad contra que superficie destacar.
    <div className={`bg-fill ${BLEED_CLASS}`}>
      <h1 className="sr-only">Panel de operaciones</h1>

      <div className="flex flex-col gap-6">
        {error && (
          <Alert variant="error">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {error}
              <button
                type="button"
                onClick={load}
                disabled={refreshing}
                className="rounded-edge font-heading text-[11px] font-semibold uppercase tracking-[0.06em]
                  underline underline-offset-2 outline-none focus-visible:ring-3
                  focus-visible:ring-brand-red/25 disabled:cursor-wait disabled:opacity-60"
              >
                Reintentar
              </button>
            </span>
          </Alert>
        )}

        {/* El spinner es solo para la primera carga; un refetch con datos ya en
            pantalla los atenua al 60% en vez de vaciarlos. Y si la primera
            carga falla no hay nada que esperar: el aviso con "Reintentar" es
            todo lo que debe quedar, nunca un spinner eterno debajo. */}
        {data === null ? (
          refreshing && (
            <div className="flex flex-1 items-center justify-center py-24">
              <Spinner />
            </div>
          )
        ) : (
          <div
            aria-busy={refreshing}
            className={`flex flex-col gap-6 transition-opacity duration-200 ${refreshing ? "opacity-60" : ""}`}
          >
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {data.kpis.map((kpi) => (
                <KpiTile
                  key={kpi.key}
                  icon={kpiIcon[kpi.key]}
                  label={kpi.label}
                  value={kpi.value}
                  tone={kpi.tone}
                  emphasis={kpi.emphasis}
                  delta={kpi.delta}
                  sparkline={kpi.sparkline}
                />
              ))}
            </div>

            {/* Charts adaptados de mono-charts (github.com/Subhan-code/Amicro,
                MIT) — estructura original, recoloreados a la paleta de marca. */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <MonoRoundedBarChart data={data.weeklyBars} total={data.weeklyTotal} />
              <MonoRoundedDonutChart data={categoryBreakdown} />
              <MonoRoundedStreamChart data={data.activityStream} peak={data.activityPeak} />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
              <div className="flex flex-col gap-5">
                <SystemStatusCard onRefresh={load} isRefreshing={refreshing} lastSync={lastSync} />

                <DashboardCard className="flex flex-col items-center">
                  <h2 className="mb-3 self-start font-heading text-[13px] font-bold tracking-[-0.01em] text-ink">
                    Cumplimiento de SLA
                  </h2>
                  <SlaDonut compliance={data.slaCompliance} label="a tiempo" />
                  <div className="mt-4 w-full">
                    <PriorityBars rows={data.priorityCompliance} />
                  </div>
                </DashboardCard>
              </div>

              <TicketsTable tickets={data.tickets} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
