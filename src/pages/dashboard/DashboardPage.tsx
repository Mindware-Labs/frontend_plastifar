import { AlertTriangle, CheckCircle2, Inbox, RefreshCcw, UserX } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert } from "../../components/ui/Alert";
import { Spinner } from "../../components/ui/Spinner";
import { dashboardMock } from "../../mocks/dashboard";
import type { DashboardData, KpiKey } from "../../types/dashboard";
import { ActivityHeatmap } from "./ActivityHeatmap";
import { DashboardCard } from "./DashboardCard";
import { DashboardHeader } from "./DashboardHeader";
import { KpiTile } from "./KpiTile";
import { PriorityBars } from "./PriorityBars";
import { SlaDonut } from "./SlaDonut";
import { SystemStatusCard } from "./SystemStatusCard";
import { TicketsTable } from "./TicketsTable";
import { VolumeTracker } from "./VolumeTracker";

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

  return (
    // Tinte propio del Dashboard: rompe con el blanco del resto del panel a
    // proposito (excepcion ya documentada en DESIGN.md) para que las tarjetas
    // blancas tengan de verdad contra que superficie destacar. El margen
    // negativo cancela el padding de <main> para que el tinte llegue al borde.
    <div className="-mx-8 -mt-4 -mb-12 bg-fill px-8 pt-6 pb-12">
      <div className="flex flex-col gap-6">
        <DashboardHeader />

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

            {/* Fila A: modulo angosto + modulo ancho de dos paneles — mismo
                ritmo que la referencia (grafico simple | grafico doble). */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <DashboardCard className="flex flex-col">
                <h2 className="mb-1 font-heading text-[13px] font-bold tracking-[-0.01em] text-ink">
                  Volumen de tickets
                </h2>
                <p className="mb-4 text-[12px] text-muted">Ritmo diario de la semana</p>
                <div className="min-h-[180px] flex-1">
                  <VolumeTracker data={data.weeklyVolume} delta={data.weeklyVolumeDelta} />
                </div>
              </DashboardCard>

              <DashboardCard className="flex flex-col">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-heading text-[13px] font-bold tracking-[-0.01em] text-ink">
                    Rendimiento operativo
                  </h2>
                  <span className="text-[11px] text-faint">Últimos 7 días</span>
                </div>

                <div className="grid flex-1 grid-cols-1 gap-6 sm:grid-cols-[1.3fr_1fr]">
                  <div className="flex flex-col">
                    <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-faint">
                      Actividad por hora
                    </p>
                    <div className="min-h-[160px] flex-1">
                      <ActivityHeatmap cells={data.hourlyActivity} />
                    </div>
                  </div>

                  <div className="flex flex-col items-center border-l border-line-soft pl-6">
                    <p className="mb-3 self-start text-[11.5px] font-semibold uppercase tracking-[0.06em] text-faint">
                      Cumplimiento de SLA
                    </p>
                    <SlaDonut compliance={data.slaCompliance} label="a tiempo" />
                    <div className="mt-4 w-full">
                      <PriorityBars rows={data.priorityCompliance} />
                    </div>
                  </div>
                </div>
              </DashboardCard>
            </div>

            {/* Fila B: tarjeta de estado + la bandeja, ahora en su propia
                fila completa en vez de compartir una barra lateral alta. */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
              <SystemStatusCard onRefresh={refresh} isRefreshing={refreshing} />
              <TicketsTable tickets={data.tickets} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
