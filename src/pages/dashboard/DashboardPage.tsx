import { AlertTriangle, CheckCircle2, Inbox, RefreshCcw, UserX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    dashboardMock
      .data()
      .then(setData)
      .catch(() => setError("No se pudo cargar el dashboard"));
  }, []);

  function refresh() {
    setRefreshing(true);
    dashboardMock
      .data()
      .then(setData)
      .catch(() => setError("No se pudo cargar el dashboard"))
      .finally(() => setRefreshing(false));
  }

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
    // blancas tengan de verdad contra que superficie destacar. El margen
    // negativo cancela el padding de <main> para que el tinte llegue al borde.
    <div className="-mx-8 -mt-4 -mb-12 bg-fill px-8 pt-6 pb-12">
      <div className="flex flex-col gap-6">
        {error && <Alert variant="error">{error}</Alert>}

        {data === null ? (
          <div className="flex flex-1 items-center justify-center py-24">
            <Spinner />
          </div>
        ) : (
          <>
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
                <SystemStatusCard onRefresh={refresh} isRefreshing={refreshing} />

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
          </>
        )}
      </div>
    </div>
  );
}
