import { useState } from "react";
import { reportsApi, type AuditReport } from "../../api/reports";
import { Alert } from "../../components/ui/Alert";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { Pagination } from "../../components/ui/Pagination";
import { Spinner } from "../../components/ui/Spinner";
import { usePagedList } from "../../hooks/usePagedList";
import { formatInstant } from "../../lib/quality";
import { DateRangeBar } from "./DateRangeBar";
import { ReportsLayout } from "./ReportsLayout";
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

  const { data, isStale, error, setPage } = usePagedList<AuditQuery, AuditReport>({
    fetch: (query) => reportsApi.audit(query.from, query.to, query.page, query.pageSize),
    criteria: { from: range.from, to: range.to, pageSize },
    fallbackError: "No se pudo cargar el reporte",
  });

  return (
    <ReportsLayout>
      <DateRangeBar range={range} onChange={setRange} />

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
        <div className={`flex flex-col gap-8 transition-opacity ${isStale ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <section>
              <h2 className="mb-2 font-heading text-[14px] font-bold tracking-[-0.01em] text-ink">
                Accesos por usuario
              </h2>
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
              <h2 className="mb-2 font-heading text-[14px] font-bold tracking-[-0.01em] text-ink">
                Por tipo de acción
              </h2>
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
            <h2 className="mb-2 font-heading text-[14px] font-bold tracking-[-0.01em] text-ink">
              Bitácora del período
            </h2>
            {data.items.length === 0 ? (
              <p className="py-8 text-center text-[13.5px] text-faint">
                Ninguna acción registrada en este rango de fechas.
              </p>
            ) : (
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
            )}

            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              totalPages={data.totalPages}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              noun="acciones"
            />
          </section>
        </div>
      )}
    </ReportsLayout>
  );
}
