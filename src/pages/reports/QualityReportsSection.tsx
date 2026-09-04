import { Lock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Alert } from "../../components/ui/Alert";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { Spinner } from "../../components/ui/Spinner";
import { downloadCsv } from "../../lib/csv";
import { formatAmount, isSheetOverdue } from "../../lib/quality";
import { qualityMock } from "../../mocks/quality";
import type { CorrectiveActionSheet, CreditRequest } from "../../types/quality";
import { REPORT_CATALOG } from "../../types/reports";
import { DateRangeBar } from "./DateRangeBar";
import { ReportsLayout } from "./ReportsLayout";
import { StatTile } from "./StatTile";
import { useDateRange } from "./useDateRange";

/**
 * Familia "Calidad y reclamaciones" (seccion 11.2). Tres de sus cinco reportes
 * ya se pueden calcular, porque el modulo de Calidad registra sus propios
 * datos; los otros dos cuentan reclamaciones, que son tickets, y siguen
 * bloqueados por la Bandeja.
 *
 * La agregacion se hace aqui solo mientras no exista el API: el plan es
 * explicito en que ningun reporte trae filas al servidor para sumarlas en
 * memoria (seccion 11.3), asi que estos tres calculos son la especificacion de
 * las tres consultas SQL que hay que escribir, no su implementacion final.
 */

const BLOCKED = ["reclamaciones-por-motivo", "reclamaciones-por-linea"];

interface QualityReportData {
  openedInRange: number;
  closedInRange: number;
  openAtEnd: number;
  overdueOpen: number;
  avgClosureDays: number | null;
  byMonth: { month: string; opened: number; closed: number }[];
  credits: { count: number; byCurrency: { currency: string; total: number; count: number }[] };
}

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

const monthFormat = new Intl.DateTimeFormat("es-DO", { month: "long", year: "numeric" });

function monthLabel(key: string) {
  return monthFormat.format(new Date(`${key}-01T00:00:00`));
}

function aggregate(
  sheets: CorrectiveActionSheet[],
  credits: CreditRequest[],
  from: string,
  to: string,
): QualityReportData {
  const inRange = (iso: string | null) => iso !== null && iso.slice(0, 10) >= from && iso.slice(0, 10) <= to;

  const opened = sheets.filter((sheet) => inRange(sheet.detectedAt));
  const closed = sheets.filter((sheet) => inRange(sheet.closedAt));

  // Tiempo de cierre: desde detectada hasta cerrada, en dias completos.
  const closureDays = closed.map((sheet) =>
    Math.max(
      0,
      Math.round(
        (Date.parse(sheet.closedAt!) - Date.parse(sheet.detectedAt)) / 86_400_000,
      ),
    ),
  );

  const months = [
    ...new Set([
      ...opened.map((sheet) => monthKey(sheet.detectedAt)),
      ...closed.map((sheet) => monthKey(sheet.closedAt!)),
    ]),
  ].sort();

  const emitted = credits.filter(
    (credit) => (credit.status === "Aprobada" || credit.status === "Aplicada") && inRange(credit.decidedAt),
  );

  const byCurrency = [...new Set(emitted.map((credit) => credit.currency))].sort().map((currency) => {
    const ofCurrency = emitted.filter((credit) => credit.currency === currency);
    return {
      currency,
      count: ofCurrency.length,
      total: ofCurrency.reduce((sum, credit) => sum + credit.amount, 0),
    };
  });

  return {
    openedInRange: opened.length,
    closedInRange: closed.length,
    // Estado actual, no reconstruido a la fecha de corte: sin historial de
    // transiciones no se puede saber que estaba abierto aquel dia.
    openAtEnd: sheets.filter((sheet) => sheet.status !== "Cerrada").length,
    // Igual que openAtEnd: estado actual a hoy, no reconstruido al corte del
    // rango elegido — de lo contrario un rango pasado o futuro desalinea esta
    // cifra con "abiertas ahora".
    overdueOpen: sheets.filter((sheet) => isSheetOverdue(sheet)).length,
    avgClosureDays:
      closureDays.length === 0
        ? null
        : Math.round(closureDays.reduce((sum, days) => sum + days, 0) / closureDays.length),
    byMonth: months.map((month) => ({
      month,
      opened: opened.filter((sheet) => monthKey(sheet.detectedAt) === month).length,
      closed: closed.filter((sheet) => monthKey(sheet.closedAt!) === month).length,
    })),
    credits: { count: emitted.length, byCurrency },
  };
}

export function QualityReportsSection() {
  const { range, setRange } = useDateRange();
  const [sheets, setSheets] = useState<CorrectiveActionSheet[] | null>(null);
  const [credits, setCredits] = useState<CreditRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([qualityMock.sheets(), qualityMock.creditRequests(null)])
      .then(([loadedSheets, loadedCredits]) => {
        setSheets(loadedSheets);
        setCredits(loadedCredits);
      })
      .catch(() => setError("No se pudo cargar el reporte"));
  }, []);

  const data = useMemo(
    () =>
      sheets === null || credits === null
        ? null
        : aggregate(sheets, credits, range.from, range.to),
    [sheets, credits, range.from, range.to],
  );

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
              value={String(data.openAtEnd)}
              hint={data.overdueOpen > 0 ? `${data.overdueOpen} ya vencidas` : "Ninguna vencida"}
              tone={data.overdueOpen > 0 ? "red" : "neutral"}
            />
            <StatTile
              label="Tiempo medio de cierre"
              value={data.avgClosureDays === null ? "—" : `${data.avgClosureDays} días`}
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

          <p className="max-w-[76ch] text-[12px] leading-relaxed text-faint">
            Datos de prueba: estas cifras se calculan sobre las hojas y solicitudes de ejemplo del
            módulo de Calidad. Cuando exista el API, la agregación se hace en SQL — el plan no acepta
            traer filas al servidor para sumarlas en memoria.
          </p>
        </div>
      )}
    </ReportsLayout>
  );
}
