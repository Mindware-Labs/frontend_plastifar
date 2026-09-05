import { useCallback } from "react";
import { reportsApi, type QualityReport } from "../../api/reports";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { downloadCsvSections } from "../../lib/csv";
import { formatAmount } from "../../lib/quality";
import { REPORT_CATALOG } from "../../types/reports";
import { BlockedReports } from "./BlockedReports";
import { DateRangeBar } from "./DateRangeBar";
import { ReportState } from "./ReportState";
import { ReportsLayout } from "./ReportsLayout";
import { SectionHeading } from "./SectionHeading";
import { StatTile } from "./StatTile";
import { useDateRange } from "./useDateRange";
import { useReportData } from "./useReportData";

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

  const fetch = useCallback(() => reportsApi.quality(range.from, range.to), [range.from, range.to]);
  const { data, isStale, error, retry } = useReportData<QualityReport>({
    fetch,
    key: `${range.from}|${range.to}`,
    fallbackError: "No se pudo cargar el reporte",
  });

  const blockedReports = REPORT_CATALOG.filter((report) => BLOCKED.includes(report.id));

  /**
   * Se exporta la pantalla entera, no una de sus tablas: cada bloque va bajo su
   * propio encabezado en la misma hoja, que es lo que significa "el resultado
   * tal como se ve". El nombre lleva el rango, como en las demas familias.
   */
  function exportCsv() {
    if (!data) return;
    downloadCsvSections(`calidad_${range.from}_${range.to}.csv`, [
      {
        title: "Resumen del período",
        headers: ["Indicador", "Valor"],
        rows: [
          ["HCA abiertas en el período", data.openedInRange],
          ["HCA cerradas en el período", data.closedInRange],
          ["Abiertas hoy", data.openNow],
          ["Vencidas hoy", data.overdueNow],
          [
            "Tiempo medio de cierre (días)",
            data.averageClosureDays === 0 ? "—" : data.averageClosureDays,
          ],
        ],
      },
      {
        title: "HCA abiertas y cerradas por período",
        headers: ["Mes", "Abiertas", "Cerradas", "Diferencia"],
        rows: data.byMonth.map((entry) => [
          monthLabel(entry.month),
          entry.opened,
          entry.closed,
          entry.opened - entry.closed,
        ]),
      },
      {
        title: "Notas de crédito emitidas y monto acumulado",
        headers: ["Moneda", "Notas", "Acumulado"],
        rows: data.credits.byCurrency.map((entry) => [
          entry.currency,
          entry.count,
          formatAmount(entry.total, entry.currency),
        ]),
      },
    ]);
  }

  return (
    <ReportsLayout>
      <DateRangeBar range={range} onChange={setRange} onExport={data ? exportCsv : undefined} />

      <ReportState error={error} hasData={data !== null} onRetry={retry} />

      {data !== null && (
        <div className={`flex flex-col gap-8 transition-opacity ${isStale ? "opacity-60" : ""}`}>
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
            <SectionHeading>HCA abiertas y cerradas por período</SectionHeading>
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
            <SectionHeading>Notas de crédito emitidas y monto acumulado</SectionHeading>
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
            <SectionHeading>Todavía bloqueados</SectionHeading>
            <BlockedReports
              note={
                <>
                  Los otros dos reportes de esta familia cuentan reclamaciones, y una reclamación es
                  un ticket: llegan con la{" "}
                  <strong className="font-medium text-ink">Bandeja de tickets</strong>.
                </>
              }
              reports={blockedReports}
            />
          </section>
        </div>
      )}
    </ReportsLayout>
  );
}
