import { useState } from "react";
import {
  reportsApi,
  type AuditReport,
  type AuditSliceReport,
  type AuditSliceRow,
} from "../../api/reports";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { Pagination } from "../../components/ui/Pagination";
import { usePagedList } from "../../hooks/usePagedList";
import { downloadCsvSections, type CsvSection } from "../../lib/csv";
import { formatInstant } from "../../lib/quality";
import { REPORT_CATALOG } from "../../types/reports";
import { BlockedReports } from "./BlockedReports";
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

/** "Cambios de estado de tickets" es el unico de los cuatro que sigue sin fuente. */
const BLOCKED = ["cambios-estado-tickets"];

type SliceFetcher = (
  from: string,
  to: string,
  page: number,
  pageSize: number,
) => Promise<AuditSliceReport>;

/**
 * Uno de los tres reportes de auditoria que miran una accion concreta. Cada uno
 * pagina por su cuenta -son listados independientes y avanzar en uno no debe
 * mover los otros- sobre el rango de fechas comun de la pantalla.
 */
function useAuditSlice(fetcher: SliceFetcher, from: string, to: string, fallbackError: string) {
  const [pageSize, setPageSize] = useState(10);

  const paged = usePagedList<AuditQuery, AuditSliceReport>({
    fetch: (query) => fetcher(query.from, query.to, query.page, query.pageSize),
    criteria: { from, to, pageSize },
    fallbackError,
  });

  return { ...paged, setPageSize };
}

/**
 * Familia "Auditoria" (seccion 11.2). Tres de sus cuatro reportes salen de la
 * bitacora, que existe desde el primer modulo y tiene endpoint propio para cada
 * uno; el cuarto -"cambios de estado de tickets"- espera a la Bandeja. La
 * agregacion y la paginacion ocurren en SQL (seccion 11.3).
 */
export function AuditReportsSection() {
  const { range, setRange } = useDateRange();
  const [pageSize, setPageSize] = useState(20);

  const logins = useAuditSlice(
    reportsApi.auditLogins,
    range.from,
    range.to,
    "No se pudieron cargar los accesos",
  );

  const deactivations = useAuditSlice(
    reportsApi.auditDeactivations,
    range.from,
    range.to,
    "No se pudieron cargar las bajas y desactivaciones",
  );

  const revocations = useAuditSlice(
    reportsApi.auditRevokedSessions,
    range.from,
    range.to,
    "No se pudieron cargar las sesiones revocadas",
  );

  const log = usePagedList<AuditQuery, AuditReport>({
    fetch: (query) => reportsApi.audit(query.from, query.to, query.page, query.pageSize),
    criteria: { from: range.from, to: range.to, pageSize },
    fallbackError: "No se pudo cargar la bitácora",
  });

  const blockedReports = REPORT_CATALOG.filter((report) => BLOCKED.includes(report.id));

  /**
   * Se exporta lo que hay en pantalla, cada bloque bajo su encabezado. De los
   * listados va solo la pagina que se ve: la seccion 11.3 pide "el resultado
   * tal como se ve", y recorrer todas las paginas seria justo la consulta sin
   * tope que la misma seccion prohibe. Un bloque que no llego -porque su
   * peticion fallo- no aparece en la hoja en vez de aparecer vacio.
   */
  function exportCsv() {
    const sections: CsvSection[] = [];

    if (logins.data) {
      sections.push({
        title: "Accesos por usuario · resumen",
        headers: ["Usuario", "Accesos", "Último acceso"],
        rows: logins.data.byActor.map((entry) => [
          entry.actor,
          entry.count,
          formatInstant(entry.lastAt),
        ]),
      });
      sections.push({
        title: `Accesos por usuario · detalle (página ${logins.data.page} de ${logins.data.totalPages})`,
        headers: ["Cuándo", "Usuario", "Dirección IP", "Navegador"],
        rows: logins.data.items.map((entry) => [
          formatInstant(entry.createdAt),
          entry.actor,
          entry.ipAddress ?? "Sin registrar",
          entry.userAgent ?? "Sin registrar",
        ]),
      });
    }

    if (deactivations.data) {
      sections.push(
        sliceCsv(
          `Bajas y desactivaciones (página ${deactivations.data.page} de ${deactivations.data.totalPages})`,
          deactivations.data,
        ),
      );
    }

    if (revocations.data) {
      sections.push(
        sliceCsv(
          `Sesiones revocadas (página ${revocations.data.page} de ${revocations.data.totalPages})`,
          revocations.data,
        ),
      );
    }

    if (log.data) {
      sections.push({
        title: "Actividad registrada por usuario",
        headers: ["Usuario", "Acciones registradas"],
        rows: log.data.byActor.map((entry) => [entry.actor, entry.actions]),
      });
      sections.push({
        title: "Por tipo de acción",
        headers: ["Acción", "Cantidad"],
        rows: log.data.byAction.map((entry) => [entry.action, entry.count]),
      });
      sections.push({
        title: `Bitácora completa del período (página ${log.data.page} de ${log.data.totalPages})`,
        headers: ["Cuándo", "Usuario", "Entidad", "Acción"],
        rows: log.data.items.map((entry) => [
          formatInstant(entry.createdAt),
          entry.actor,
          `${entry.entity} #${entry.entityId}`,
          entry.action,
        ]),
      });
    }

    if (sections.length === 0) return;
    downloadCsvSections(`auditoria_${range.from}_${range.to}.csv`, sections);
  }

  const anyData =
    logins.data !== null ||
    deactivations.data !== null ||
    revocations.data !== null ||
    log.data !== null;

  return (
    <ReportsLayout>
      <DateRangeBar range={range} onChange={setRange} onExport={anyData ? exportCsv : undefined} />

      <div className="flex flex-col gap-8">
        <section>
          <SectionHeading>Accesos por usuario</SectionHeading>
          <ReportState
            error={logins.error}
            hasData={logins.data !== null}
            onRetry={logins.refresh}
          />

          {logins.data !== null && (
            <div className={`flex flex-col gap-4 transition-opacity ${logins.isStale ? "opacity-60" : ""}`}>
              {logins.data.total === 0 ? (
                <p className="py-8 text-center text-[13.5px] text-faint">
                  Nadie inició sesión en este rango de fechas.
                </p>
              ) : (
                <>
                  <DataTable>
                    <thead>
                      <HeadRow>
                        <Th>Usuario</Th>
                        <Th className="text-right">Accesos</Th>
                        <Th>Último acceso</Th>
                      </HeadRow>
                    </thead>
                    <tbody>
                      {/* Por identificador, no por nombre: dos personas que se
                          llaman igual son dos filas, y con el nombre como clave
                          React las trataba como una. */}
                      {logins.data.byActor.map((entry) => (
                        <Row key={entry.actorId}>
                          <Td className="text-[12.5px] text-brand-gray">{entry.actor}</Td>
                          <Td className="text-right text-[12.5px] tabular-nums text-brand-gray">
                            {entry.count}
                          </Td>
                          <Td className="whitespace-nowrap text-[12.5px] text-brand-gray">
                            {formatInstant(entry.lastAt)}
                          </Td>
                        </Row>
                      ))}
                    </tbody>
                  </DataTable>

                  <div>
                    <p className="mb-2 text-[12px] text-faint">
                      Cada acceso, con la dirección y el navegador desde los que se hizo.
                    </p>
                    <DataTable>
                      <thead>
                        <HeadRow>
                          <Th>Cuándo</Th>
                          <Th>Usuario</Th>
                          <Th>Dirección IP</Th>
                          <Th>Navegador</Th>
                        </HeadRow>
                      </thead>
                      <tbody>
                        {logins.data.items.map((entry) => (
                          <Row key={entry.id}>
                            <Td className="whitespace-nowrap text-[12.5px] text-brand-gray">
                              {formatInstant(entry.createdAt)}
                            </Td>
                            <Td className="text-[12.5px] text-brand-gray">{entry.actor}</Td>
                            <Td className="whitespace-nowrap font-mono text-[10.5px] text-brand-gray">
                              {entry.ipAddress ?? <span className="font-sans text-faint">Sin registrar</span>}
                            </Td>
                            <Td className="text-[12.5px] text-brand-gray">
                              {entry.userAgent ? (
                                // El agente es una cadena larga y sin interes
                                // salvo cuando se compara: se recorta y el valor
                                // completo queda en el título y en el CSV.
                                <span
                                  title={entry.userAgent}
                                  className="block max-w-[280px] truncate"
                                >
                                  {entry.userAgent}
                                </span>
                              ) : (
                                <span className="text-faint">Sin registrar</span>
                              )}
                            </Td>
                          </Row>
                        ))}
                      </tbody>
                    </DataTable>

                    <Pagination
                      page={logins.data.page}
                      pageSize={logins.data.pageSize}
                      total={logins.data.total}
                      totalPages={logins.data.totalPages}
                      onPageChange={logins.setPage}
                      onPageSizeChange={logins.setPageSize}
                      noun="accesos"
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </section>

        <AuditSliceSection
          title="Bajas y desactivaciones"
          note="Registros dados de baja o desactivados en el período, con quién lo hizo."
          empty="No se dio de baja ni se desactivó nada en este rango de fechas."
          noun="bajas"
          slice={deactivations}
        />

        <AuditSliceSection
          title="Sesiones revocadas"
          note="Cierres forzados de sesión: quién los ordenó y sobre quién."
          empty="No se revocó ninguna sesión en este rango de fechas."
          noun="revocaciones"
          nounSingular="revocación"
          slice={revocations}
        />

        <section>
          <SectionHeading>Bitácora completa del período</SectionHeading>
          <ReportState error={log.error} hasData={log.data !== null} onRetry={log.refresh} />

          {log.data !== null && (
            <div className={`flex flex-col gap-6 transition-opacity ${log.isStale ? "opacity-60" : ""}`}>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  {/* No es "accesos por usuario": cuenta toda accion registrada,
                      de cualquier tipo. Ese reporte es el primero de la
                      pantalla, y confundirlos era decir que quien mas edita es
                      quien mas entra. */}
                  <p className="mb-2 text-[12px] text-faint">
                    Los 20 usuarios con más actividad registrada. Cuenta acciones de cualquier tipo,
                    no accesos.
                  </p>
                  {log.data.byActor.length === 0 ? (
                    <p className="py-8 text-center text-[13.5px] text-faint">
                      Sin actividad en este rango.
                    </p>
                  ) : (
                    <DataTable>
                      <thead>
                        <HeadRow>
                          <Th>Usuario</Th>
                          <Th className="text-right">Acciones registradas</Th>
                        </HeadRow>
                      </thead>
                      <tbody>
                        {log.data.byActor.map((entry) => (
                          <Row key={entry.actorId}>
                            <Td className="text-[12.5px] text-brand-gray">{entry.actor}</Td>
                            <Td className="text-right text-[12.5px] tabular-nums text-brand-gray">
                              {entry.actions}
                            </Td>
                          </Row>
                        ))}
                      </tbody>
                    </DataTable>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-[12px] text-faint">Reparto por tipo de acción.</p>
                  {log.data.byAction.length === 0 ? (
                    <p className="py-8 text-center text-[13.5px] text-faint">
                      Sin actividad en este rango.
                    </p>
                  ) : (
                    <DataTable>
                      <thead>
                        <HeadRow>
                          <Th>Acción</Th>
                          <Th className="text-right">Cantidad</Th>
                        </HeadRow>
                      </thead>
                      <tbody>
                        {log.data.byAction.map((entry) => (
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
                </div>
              </div>

              {log.data.items.length === 0 ? (
                // Sin filas no hay nada que paginar: el paginador debajo del
                // vacio solo repetia "0 acciones" con controles muertos.
                <p className="py-8 text-center text-[13.5px] text-faint">
                  Ninguna acción registrada en este rango de fechas.
                </p>
              ) : (
                <div>
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
                      {log.data.items.map((entry) => (
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
                    page={log.data.page}
                    pageSize={log.data.pageSize}
                    total={log.data.total}
                    totalPages={log.data.totalPages}
                    onPageChange={log.setPage}
                    onPageSizeChange={setPageSize}
                    noun="acciones"
                  />
                </div>
              )}
            </div>
          )}
        </section>

        <section>
          <SectionHeading>Todavía bloqueados</SectionHeading>
          <BlockedReports
            note={
              <>
                El cuarto reporte de esta familia sigue el estado de un ticket, y los tickets llegan
                con la <strong className="font-medium text-ink">Bandeja de tickets</strong>.
              </>
            }
            reports={blockedReports}
          />
        </section>
      </div>
    </ReportsLayout>
  );
}

/** Mismo bloque de CSV para las dos porciones que no llevan IP ni navegador. */
function sliceCsv(title: string, data: AuditSliceReport): CsvSection {
  return {
    title,
    headers: ["Cuándo", "Usuario", "Entidad", "Acción"],
    rows: data.items.map((entry) => [
      formatInstant(entry.createdAt),
      entry.actor,
      `${entry.entity} #${entry.entityId}`,
      entry.action,
    ]),
  };
}

interface AuditSliceSectionProps {
  title: string;
  note: string;
  empty: string;
  noun: string;
  nounSingular?: string;
  slice: {
    data: AuditSliceReport | null;
    isStale: boolean;
    error: string | null;
    setPage: (page: number) => void;
    setPageSize: (pageSize: number) => void;
    refresh: () => void;
  };
}

/**
 * "Bajas y desactivaciones" y "Sesiones revocadas" se ven igual -misma forma de
 * respuesta y mismas columnas- y se escriben una sola vez: dos copias del mismo
 * bloque acaban divergiendo en la primera correccion que solo se aplica a una.
 */
function AuditSliceSection({
  title,
  note,
  empty,
  noun,
  nounSingular,
  slice,
}: AuditSliceSectionProps) {
  const rows: AuditSliceRow[] = slice.data?.items ?? [];

  return (
    <section>
      <SectionHeading>{title}</SectionHeading>
      <ReportState error={slice.error} hasData={slice.data !== null} onRetry={slice.refresh} />

      {slice.data !== null && (
        <div className={`transition-opacity ${slice.isStale ? "opacity-60" : ""}`}>
          <p className="mb-2 text-[12px] text-faint">{note}</p>

          {rows.length === 0 ? (
            <p className="py-8 text-center text-[13.5px] text-faint">{empty}</p>
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
                  {rows.map((entry) => (
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
                page={slice.data.page}
                pageSize={slice.data.pageSize}
                total={slice.data.total}
                totalPages={slice.data.totalPages}
                onPageChange={slice.setPage}
                onPageSizeChange={slice.setPageSize}
                noun={noun}
                nounSingular={nounSingular}
              />
            </>
          )}
        </div>
      )}
    </section>
  );
}
