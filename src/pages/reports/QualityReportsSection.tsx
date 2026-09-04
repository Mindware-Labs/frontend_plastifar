import { Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "../../api/client";
import { reportsApi, type QualityReport } from "../../api/reports";
import { Alert } from "../../components/ui/Alert";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { Spinner } from "../../components/ui/Spinner";
import { downloadCsv } from "../../lib/csv";
import { formatAmount } from "../../lib/quality";
import { REPORT_CATALOG } from "../../types/reports";
import { DateRangeBar } from "./DateRangeBar";
import { ReportsLayout } from "./ReportsLayout";
import { StatTile } from "./StatTile";
import { useDateRange } from "./useDateRange";

/**
 * Familia "Calidad y reclamaciones" (seccion 11.2). Tres de sus cinco reportes
 * ya se pueden calcular, porque el modulo de Calidad registra sus propios
 * datos; los otros dos cuentan reclamaciones, que son tickets, y siguen
 * bloqueados por la Bandeja. La agregacion ocurre en SQL, en
 * GET /api/reports/quality (seccion 11.3): esta pantalla solo pinta lo que
 * el servidor ya sumo.
 */

const BLOCKED = ["reclamaciones-por-motivo", "reclamaciones-por-linea"];

const monthFormat = new Intl.DateTimeFormat("es-DO", { month: "long", year: "numeric" });

function monthLabel(key: string) {
  return monthFormat.format(new Date(`${key}-01T00:00:00`));
}

export function QualityReportsSection() {
  const { range, setRange } = useDateRange();
  const [data, setData] = useState<QualityReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    reportsApi
      .quality(range.from, range.to)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudo cargar el reporte"));
  }, [range.from, range.to]);

  const blockedReports = REPORT_CATALOG.filter((report) => BLOCKED.includes(report.id));

  function exportCsv() {
    if (!data) return;
    downloadCsv(
      `hca-por-periodo_${range.from}_${range.to}.csv`,
      ["Mes", "Abiertas", "Cerradas"],
      data.byMonth.map((entry) => [monthLabel(entry.month), entry.opened, entry.closed]),
    );
  }

  return (
    <ReportsLayout>
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="HCA abiertas en el período" value={String(data.openedInRange)} />
            <StatTile label="HCA cerradas en el período" value={String(data.closedInRange)} tone="green" />
            <StatTile
              label="Abiertas hoy"
              value={String(data.openNow)}
              hint={data.overdueNow > 0 ? `${data.overdueNow} ya vencidas` : "Ninguna vencida"}
              tone={data.overdueNow > 0 ? "red" : "neutral"}
            />
            <StatTile
              label="Tiempo medio de cierre"
              value={data.averageClosureDays === 0 ? "—" : `${data.averageClosureDays} días`}
              hint="Desde detectada hasta cerrada"
            />
          </div>

          <section>
            <h2 className="mb-2 font-heading text-[14px] font-bold tracking-[-0.01em] text-ink">
              HCA abiertas y cerradas por período
            </h2>
            {data.byMonth.length === 0 ? (
              <p className="py-8 text-center text-[13.5px] text-faint">
                Ninguna hoja de corrección cae en este rango de fechas.
              </p>
            ) : (
              <DataTable>
                <thead>
                  <HeadRow>
                    <Th>Mes</Th>
                    <Th className="text-right">Abiertas</Th>
                    <Th className="text-right">Cerradas</Th>
                    <Th className="text-right">Diferencia</Th>
                  </HeadRow>
                </thead>
                <tbody>
                  {data.byMonth.map((entry) => {
                    const balance = entry.opened - entry.closed;
                    return (
                      <Row key={entry.month}>
                        <Td className="text-[12.5px] text-brand-gray first-letter:uppercase">
                          {monthLabel(entry.month)}
                        </Td>
                        <Td className="text-right text-[12.5px] tabular-nums text-brand-gray">
                          {entry.opened}
                        </Td>
                        <Td className="text-right text-[12.5px] tabular-nums text-brand-gray">
                          {entry.closed}
                        </Td>
                        <Td
                          className={`text-right text-[12.5px] font-medium tabular-nums ${
                            balance > 0 ? "text-brand-red-dark" : "text-brand-green"
                          }`}
                        >
                          {balance > 0 ? `+${balance}` : balance}
                        </Td>
                      </Row>
                    );
                  })}
                </tbody>
              </DataTable>
            )}
            <p className="mt-2 text-[12px] text-faint">
              Una diferencia positiva significa que se abrieron más hojas de las que se cerraron en
              ese mes.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-heading text-[14px] font-bold tracking-[-0.01em] text-ink">
              Notas de crédito emitidas y monto acumulado
            </h2>
            {data.credits.count === 0 ? (
              <p className="py-8 text-center text-[13.5px] text-faint">
                No se aprobó ninguna nota de crédito en este rango de fechas.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile label="Notas emitidas" value={String(data.credits.count)} />
                {data.credits.byCurrency.map((entry) => (
                  <StatTile
                    key={entry.currency}
                    label={`Acumulado ${entry.currency}`}
                    value={formatAmount(entry.total, entry.currency)}
                    hint={`${entry.count} ${entry.count === 1 ? "nota" : "notas"}`}
                  />
                ))}
              </div>
            )}
            <p className="mt-2 text-[12px] text-faint">
              Cuenta solo las solicitudes aprobadas o ya aplicadas, por la fecha en que se decidieron.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-heading text-[14px] font-bold tracking-[-0.01em] text-ink">
              Todavía bloqueados
            </h2>
            <div className="mb-3 flex items-start gap-2.5 border border-dashed border-line-strong bg-canvas px-3.5 py-3">
              <Lock aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
              <p className="text-[12.5px] leading-relaxed text-muted">
                Los otros dos reportes de esta familia cuentan reclamaciones, y una reclamación es un
                ticket: llegan con la{" "}
                <strong className="font-medium text-ink">Bandeja de tickets</strong>.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {blockedReports.map((report) => (
                <div key={report.id} className="flex flex-col gap-1.5 border border-line-soft px-4 py-3.5">
                  <span className="text-[13px] font-medium leading-tight text-ink">{report.name}</span>
                  <span className="text-[12px] leading-relaxed text-faint">{report.description}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </ReportsLayout>
  );
}
