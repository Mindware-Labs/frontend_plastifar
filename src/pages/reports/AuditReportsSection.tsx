import { useState } from "react";
import { reportsApi, type AuditReport } from "../../api/reports";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { Pagination } from "../../components/ui/Pagination";
import { usePagedList } from "../../hooks/usePagedList";
import { downloadCsvSections } from "../../lib/csv";
import { formatInstant } from "../../lib/quality";
import { DateRangeBar } from "./DateRangeBar";
import { ReportState } from "./ReportState";
import { ReportsLayout } from "./ReportsLayout";
import { SectionHeading } from "./SectionHeading";
import { useDateRange } from "./useDateRange";

interface AuditQuery {
  page: number;
  from: string;
  to: string;
  pageSize: number;
}

/**
 * Familia "Auditoria" (seccion 11.2). "Accesos por usuario" sale de la
 * bitacora, que existe desde el primer modulo; "cambios de estado de tickets"
 * y "sesiones revocadas" esperan, respectivamente, a la Bandeja y a exponer
 * ese evento puntual. GET /api/reports/audit agrega y pagina en SQL.
 */
export function AuditReportsSection() {
  const { range, setRange } = useDateRange();
  const [pageSize, setPageSize] = useState(20);

  const { data, isStale, error, setPage, refresh } = usePagedList<AuditQuery, AuditReport>({
    fetch: (query) => reportsApi.audit(query.from, query.to, query.page, query.pageSize),
    criteria: { from: range.from, to: range.to, pageSize },
    fallbackError: "No se pudo cargar el reporte",
  });

  /**
   * Se exporta la pantalla completa -los dos resumenes y la pagina visible de
   * la bitacora-, cada bloque bajo su encabezado. De la bitacora va solo la
   * pagina que se ve: la seccion 11.3 pide "el resultado tal como se ve", y
   * traer todas las paginas seria justo la consulta sin tope que prohibe.
   */
  function exportCsv() {
    if (data === null) return;
    downloadCsvSections(`bitacora_${range.from}_${range.to}_p${data.page}.csv`, [
      {
        title: "Accesos por usuario",
        headers: ["Usuario", "Acciones"],
        rows: data.byActor.map((entry) => [entry.actor, entry.actions]),
      },
      {
        title: "Por tipo de acción",
        headers: ["Acción", "Cantidad"],
        rows: data.byAction.map((entry) => [entry.action, entry.count]),
      },
      {
        title: `Bitácora del período (página ${data.page} de ${data.totalPages})`,
        // Entidad e identificador van fundidos, igual que en la tabla: el CSV
        // no puede tener columnas que la pantalla no muestra.
        headers: ["Cuándo", "Usuario", "Entidad", "Acción"],
        rows: data.items.map((entry) => [
          formatInstant(entry.createdAt),
          entry.actor,
          `${entry.entity} #${entry.entityId}`,
          entry.action,
        ]),
      },
    ]);
  }

  return (
    <ReportsLayout>
      <DateRangeBar
        range={range}
        onChange={setRange}
        onExport={data && data.items.length > 0 ? exportCsv : undefined}
      />

      <ReportState error={error} hasData={data !== null} onRetry={refresh} />

      {data !== null && (
        <div className={`flex flex-col gap-8 transition-opacity ${isStale ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <section>
              <SectionHeading>Accesos por usuario</SectionHeading>
              {data.byActor.length === 0 ? (
                <p className="py-8 text-center text-[13.5px] text-faint">Sin actividad en este rango.</p>
              ) : (
                <DataTable>
                  <thead>
                    <HeadRow>
                      <Th>Usuario</Th>
                      <Th className="text-right">Acciones</Th>
                    </HeadRow>
                  </thead>
                  <tbody>
                    {data.byActor.map((entry) => (
                      <Row key={entry.actor}>
                        <Td className="text-[12.5px] text-brand-gray">{entry.actor}</Td>
                        <Td className="text-right text-[12.5px] tabular-nums text-brand-gray">
                          {entry.actions}
                        </Td>
                      </Row>
                    ))}
                  </tbody>
                </DataTable>
              )}
              <p className="mt-2 text-[12px] text-faint">Los 20 usuarios con más actividad en el rango.</p>
            </section>

            <section>
              <SectionHeading>Por tipo de acción</SectionHeading>
              {data.byAction.length === 0 ? (
                <p className="py-8 text-center text-[13.5px] text-faint">Sin actividad en este rango.</p>
              ) : (
                <DataTable>
                  <thead>
                    <HeadRow>
                      <Th>Acción</Th>
                      <Th className="text-right">Cantidad</Th>
                    </HeadRow>
                  </thead>
                  <tbody>
                    {data.byAction.map((entry) => (
                      <Row key={entry.action}>
                        <Td className="text-[12.5px] text-brand-gray">{entry.action}</Td>
                        <Td className="text-right text-[12.5px] tabular-nums text-brand-gray">
                          {entry.count}
                        </Td>
                      </Row>
                    ))}
                  </tbody>
                </DataTable>
              )}
            </section>
          </div>

          <section>
            <SectionHeading>Bitácora del período</SectionHeading>
            {data.items.length === 0 ? (
              // Sin filas no hay nada que paginar: el paginador debajo del
              // vacio solo repetia "0 acciones" con controles muertos.
              <p className="py-8 text-center text-[13.5px] text-faint">
                Ninguna acción registrada en este rango de fechas.
              </p>
            ) : (
              <>
                <DataTable>
                  <thead>
                    <HeadRow>
                      <Th>Cuándo</Th>
                      <Th>Usuario</Th>
                      <Th>Entidad</Th>
                      <Th>Acción</Th>
                    </HeadRow>
                  </thead>
                  <tbody>
                    {data.items.map((entry) => (
                      <Row key={entry.id}>
                        <Td className="whitespace-nowrap text-[12.5px] text-brand-gray">
                          {formatInstant(entry.createdAt)}
                        </Td>
                        <Td className="text-[12.5px] text-brand-gray">{entry.actor}</Td>
                        <Td className="text-[12.5px] text-brand-gray">
                          {entry.entity} #{entry.entityId}
                        </Td>
                        <Td className="text-[12.5px] text-brand-gray">{entry.action}</Td>
                      </Row>
                    ))}
                  </tbody>
                </DataTable>

                <Pagination
                  page={data.page}
                  pageSize={data.pageSize}
                  total={data.total}
                  totalPages={data.totalPages}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  noun="acciones"
                />
              </>
            )}
          </section>
        </div>
      )}
    </ReportsLayout>
  );
}
