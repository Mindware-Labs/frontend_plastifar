import { Download } from "lucide-react";
import { useCallback } from "react";
import { reportsApi, type ClientsReport } from "../../api/reports";
import { Button } from "../../components/ui/Button";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { downloadCsvSections } from "../../lib/csv";
import { REPORT_CATALOG } from "../../types/reports";
import { BlockedReports } from "./BlockedReports";
import { ReportState } from "./ReportState";
import { ReportsLayout } from "./ReportsLayout";
import { SectionHeading } from "./SectionHeading";
import { StatTile } from "./StatTile";
import { todayIso } from "./useDateRange";
import { useReportData } from "./useReportData";

/**
 * Familia "Clientes" (seccion 11.2). De sus cuatro reportes, "Actividad por
 * vendedor" ya se calcula sobre la cartera; los otros tres cuentan tickets y
 * reclamaciones, y siguen bloqueados por la Bandeja. GET /api/reports/clients
 * agrega en SQL y no pide rango de fechas: es una foto de la cartera de hoy,
 * no un periodo. El reparto por territorio no es uno de los 31 reportes
 * nombrados; es contexto adicional que el mismo endpoint ya trae.
 */
const BLOCKED = ["ranking-volumen", "ranking-reclamaciones", "clientes-sin-actividad"];

export function ClientsReportsSection() {
  const fetch = useCallback(() => reportsApi.clients(), []);
  const { data, isStale, error, retry } = useReportData<ClientsReport>({
    fetch,
    key: "cartera",
    fallbackError: "No se pudo cargar el reporte",
  });

  const blockedReports = REPORT_CATALOG.filter((report) => BLOCKED.includes(report.id));

  /**
   * Una hoja con la pantalla completa, cada bloque bajo su encabezado: son
   * cortes distintos de la misma cartera y separarlos en tres descargas
   * obligaria a recomponerlos a mano en Excel. La fecha del corte va en el
   * nombre porque el reporte es una foto: sin ella, dos descargas de meses
   * distintos se pisaban.
   */
  function exportCsv() {
    if (data === null) return;
    downloadCsvSections(`cartera-de-clientes_${todayIso()}.csv`, [
      {
        title: "Resumen de la cartera",
        headers: ["Indicador", "Valor"],
        rows: [
          ["Clientes totales", data.total],
          ["Activos", data.active],
          ["Sin vendedor", data.withoutSalesRep],
        ],
      },
      {
        title: "Reparto de la cartera por territorio",
        headers: ["Territorio", "Clientes", "Activos"],
        rows: data.byTerritory.map((entry) => [entry.territory, entry.total, entry.active]),
      },
      {
        title: "Actividad por vendedor",
        headers: ["Vendedor", "Clientes"],
        rows: data.bySalesRep.map((entry) => [entry.salesRep, entry.clients]),
      },
    ]);
  }

  const hasRows = data !== null && (data.byTerritory.length > 0 || data.bySalesRep.length > 0);

  return (
    <ReportsLayout
      action={
        hasRows && (
          <Button variant="ghost" size="sm" onClick={exportCsv}>
            <Download className="h-[15px] w-[15px]" />
            Exportar CSV
          </Button>
        )
      }
    >
      <ReportState error={error} hasData={data !== null} onRetry={retry} />

      {data !== null && (
        <div className={`flex flex-col gap-8 transition-opacity ${isStale ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Clientes totales" value={String(data.total)} />
            <StatTile label="Activos" value={String(data.active)} tone="green" />
            <StatTile
              label="Sin vendedor"
              value={String(data.withoutSalesRep)}
              tone={data.withoutSalesRep > 0 ? "warn" : "neutral"}
            />
          </div>

          <section>
            <SectionHeading>Reparto de la cartera por territorio</SectionHeading>
            {data.byTerritory.length === 0 ? (
              <p className="py-8 text-center text-[13.5px] text-faint">Todavía no hay territorios con clientes.</p>
            ) : (
              <DataTable>
                <thead>
                  <HeadRow>
                    <Th>Territorio</Th>
                    <Th className="text-right">Clientes</Th>
                    <Th className="text-right">Activos</Th>
                  </HeadRow>
                </thead>
                <tbody>
                  {/* El nombre no es identificador: dos territorios (o dos
                      vendedores) homonimos colisionaban como clave. */}
                  {data.byTerritory.map((entry, index) => (
                    <Row key={`${entry.territory}#${index}`}>
                      <Td className="text-[12.5px] text-brand-gray">{entry.territory}</Td>
                      <Td className="text-right text-[12.5px] tabular-nums text-brand-gray">{entry.total}</Td>
                      <Td className="text-right text-[12.5px] tabular-nums text-brand-gray">{entry.active}</Td>
                    </Row>
                  ))}
                </tbody>
              </DataTable>
            )}
          </section>

          <section>
            <SectionHeading>Actividad por vendedor</SectionHeading>
            {data.bySalesRep.length === 0 ? (
              <p className="py-8 text-center text-[13.5px] text-faint">Ningún vendedor activo tiene cartera asignada.</p>
            ) : (
              <DataTable>
                <thead>
                  <HeadRow>
                    <Th>Vendedor</Th>
                    <Th className="text-right">Clientes</Th>
                  </HeadRow>
                </thead>
                <tbody>
                  {data.bySalesRep.map((entry, index) => (
                    <Row key={`${entry.salesRep}#${index}`}>
                      <Td className="text-[12.5px] text-brand-gray">{entry.salesRep}</Td>
                      <Td className="text-right text-[12.5px] tabular-nums text-brand-gray">{entry.clients}</Td>
                    </Row>
                  ))}
                </tbody>
              </DataTable>
            )}
          </section>

          <section>
            <SectionHeading>Todavía bloqueados</SectionHeading>
            <BlockedReports
              note={
                <>
                  Estos tres reportes cuentan reclamaciones y actividad de tickets: llegan con la{" "}
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
