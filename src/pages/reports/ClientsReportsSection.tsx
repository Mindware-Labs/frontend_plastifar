import { Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "../../api/client";
import { reportsApi, type ClientsReport } from "../../api/reports";
import { Alert } from "../../components/ui/Alert";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { Spinner } from "../../components/ui/Spinner";
import { REPORT_CATALOG } from "../../types/reports";
import { ReportsLayout } from "./ReportsLayout";
import { StatTile } from "./StatTile";

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
  const [data, setData] = useState<ClientsReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    reportsApi
      .clients()
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudo cargar el reporte"));
  }, []);

  const blockedReports = REPORT_CATALOG.filter((report) => BLOCKED.includes(report.id));

  return (
    <ReportsLayout>
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
            <StatTile label="Clientes totales" value={String(data.total)} />
            <StatTile label="Activos" value={String(data.active)} tone="green" />
            <StatTile
              label="Sin vendedor"
              value={String(data.withoutSalesRep)}
              tone={data.withoutSalesRep > 0 ? "warn" : "neutral"}
            />
          </div>

          <section>
            <h2 className="mb-2 font-heading text-[14px] font-bold tracking-[-0.01em] text-ink">
              Reparto de la cartera por territorio
            </h2>
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
                  {data.byTerritory.map((entry) => (
                    <Row key={entry.territory}>
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
            <h2 className="mb-2 font-heading text-[14px] font-bold tracking-[-0.01em] text-ink">
              Actividad por vendedor
            </h2>
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
                  {data.bySalesRep.map((entry) => (
                    <Row key={entry.salesRep}>
                      <Td className="text-[12.5px] text-brand-gray">{entry.salesRep}</Td>
                      <Td className="text-right text-[12.5px] tabular-nums text-brand-gray">{entry.clients}</Td>
                    </Row>
                  ))}
                </tbody>
              </DataTable>
            )}
          </section>

          <section>
            <h2 className="mb-2 font-heading text-[14px] font-bold tracking-[-0.01em] text-ink">
              Todavía bloqueados
            </h2>
            <div className="mb-3 flex items-start gap-2.5 border border-dashed border-line-strong bg-canvas px-3.5 py-3">
              <Lock aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
              <p className="text-[12.5px] leading-relaxed text-muted">
                Estos dos reportes cuentan reclamaciones y actividad de tickets: llegan con la{" "}
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
