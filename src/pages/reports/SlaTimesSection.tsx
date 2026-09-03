import { useEffect, useState } from "react";
import { Alert } from "../../components/ui/Alert";
import { Spinner } from "../../components/ui/Spinner";
import { downloadCsv } from "../../lib/csv";
import { reportsMock } from "../../mocks/reports";
import type { SlaTimesData } from "../../types/reports";
import { DateRangeBar } from "./DateRangeBar";
import { ReportsLayout } from "./ReportsLayout";
import { StatTile } from "./StatTile";
import { useDateRange } from "./useDateRange";

function humanizeMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

function complianceTone(value: number): "red" | "warn" | "green" {
  if (value >= 90) return "green";
  if (value >= 75) return "warn";
  return "red";
}

export function SlaTimesSection() {
  const { range, setRange } = useDateRange();
  const [data, setData] = useState<SlaTimesData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    reportsMock
      .slaTimes(range)
      .then(setData)
      .catch(() => setError("No se pudo cargar el reporte"));
  }, [range]);

  function exportCsv() {
    if (!data) return;
    downloadCsv(
      `cumplimiento-sla-por-prioridad_${range.from}_${range.to}.csv`,
      ["Prioridad", "Cumplimiento %"],
      data.byPriority.map((entry) => [entry.priority, entry.compliance]),
    );
  }

  return (
    <ReportsLayout summary="Cumplimiento y tiempos reales contra el compromiso de SLA">
      <DateRangeBar range={range} onChange={setRange} onExport={data ? exportCsv : undefined} />

      {error && (
        <div className="mb-3">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {data === null ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatTile
              label="1ª respuesta a tiempo"
              value={`${data.firstResponseCompliance}%`}
              tone={complianceTone(data.firstResponseCompliance)}
            />
            <StatTile
              label="Resolución a tiempo"
              value={`${data.resolutionCompliance}%`}
              tone={complianceTone(data.resolutionCompliance)}
            />
            <StatTile label="Tiempo medio 1ª respuesta" value={humanizeMinutes(data.avgFirstResponseMinutes)} />
            <StatTile label="Tiempo medio de resolución" value={humanizeMinutes(data.avgResolutionMinutes)} />
            <StatTile label="En espera del cliente" value={humanizeMinutes(data.avgPausedMinutes)} hint="No cuenta contra el agente" />
          </div>

          <section>
            <h2 className="mb-2 font-heading text-[14px] font-bold tracking-[-0.01em] text-ink">
              Cumplimiento de resolución por prioridad
            </h2>
            <div className="flex flex-col gap-2.5">
              {data.byPriority.map((entry) => (
                <div key={entry.priority} className="flex items-center gap-3">
                  <span className="w-[100px] shrink-0 text-[12.5px] text-brand-gray">
                    {entry.priority}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-fill">
                    <div
                      className={`h-full rounded-full ${
                        complianceTone(entry.compliance) === "green"
                          ? "bg-brand-green"
                          : complianceTone(entry.compliance) === "warn"
                            ? "bg-warn"
                            : "bg-brand-red"
                      }`}
                      style={{ width: `${entry.compliance}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-[12.5px] font-medium tabular-nums text-ink">
                    {entry.compliance}%
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </ReportsLayout>
  );
}
