import { AlertTriangle } from "lucide-react";
import type {
  AuditReport,
  AuditSliceReport,
  ClientsReport,
  QualityReport,
} from "../../api/reports";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { formatAmount } from "../../lib/quality";
import type { ReportDefinition } from "../../types/reports";
import type { ReportCriteria } from "./ReportFilters";
import { StatTile } from "./StatTile";

/**
 * Un renderizador por reporte, no uno por endpoint.
 *
 * `/api/reports/quality` devuelve de una vez el ritmo mensual, el tiempo medio
 * de cierre y las notas de credito: son tres reportes del catalogo, y el
 * generador ensena solo el que se pidio. Antes la pantalla los apilaba los tres
 * siempre, y quien buscaba uno tenia que recorrer los otros dos.
 */

const monthFormat = new Intl.DateTimeFormat("es-DO", { month: "long", year: "numeric" });

function monthLabel(key: string) {
  return monthFormat.format(new Date(`${key}-01T00:00:00`));
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-[13.5px] text-faint">{children}</p>;
}

/** El bloque no honra todos los filtros activos y hay que decirlo. */
function ScopeWarning({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 flex items-start gap-2 border-l-[3px] border-warn bg-warn/[0.06] px-3 py-2 text-[12.5px] text-warn">
      <AlertTriangle aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
      <span className="max-w-[76ch] text-brand-gray">{children}</span>
    </p>
  );
}

/** El movimiento mes a mes. Lo comparten «HCA por período» y «Tiempo de cierre». */
function MonthTable({ data, criteria }: { data: QualityReport; criteria: ReportCriteria }) {
  if (data.byMonth.length === 0) {
    return (
      <Empty>
        No se abrió ni se cerró ninguna HCA entre el {criteria.from} y el {criteria.to} con estos
        criterios.
      </Empty>
    );
  }

  return (
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
      <tfoot>
        <tr className="border-t border-line">
          <th
            scope="row"
            className="py-2.5 pl-0 pr-3.5 text-left text-[12.5px] font-medium text-ink"
          >
            Total del período
          </th>
          <td className="px-3.5 py-2.5 text-right text-[12.5px] font-medium tabular-nums text-ink">
            {data.byMonth.reduce((sum, e) => sum + e.opened, 0)}
          </td>
          <td className="px-3.5 py-2.5 text-right text-[12.5px] font-medium tabular-nums text-ink">
            {data.byMonth.reduce((sum, e) => sum + e.closed, 0)}
          </td>
          <td className="py-2.5 pl-3.5 pr-0 text-right text-[12.5px] font-medium tabular-nums text-ink">
            {data.byMonth.reduce((sum, e) => sum + e.opened - e.closed, 0)}
          </td>
        </tr>
      </tfoot>
    </DataTable>
  );
}

export function QualityResult({
  report,
  data,
  criteria,
}: {
  report: ReportDefinition;
  data: QualityReport;
  criteria: ReportCriteria;
}) {
  if (report.id === "tiempo-cierre-hca") {
    return (
      <>
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Tiempo medio de cierre"
            value={data.averageClosureDays === null ? "—" : `${data.averageClosureDays} días`}
            hint={
              data.averageClosureDays === null
                ? "No se cerró ninguna HCA en este recorte"
                : "Desde detectada hasta cerrada"
            }
          />
          <StatTile
            label="HCA cerradas en el período"
            value={String(data.closedInRange)}
            tone="green"
          />
          <StatTile label="HCA abiertas hoy" value={String(data.openNow)} />
          <StatTile
            label="Vencidas hoy"
            value={String(data.overdueNow)}
            tone={data.overdueNow > 0 ? "red" : "neutral"}
          />
        </div>

        {/* El servidor devuelve un unico promedio del periodo, no uno por mes:
            la tabla detalla el movimiento del que sale esa media, que es lo que
            permite juzgar si el promedio significa algo o lo sostienen dos
            cierres sueltos. */}
        <MonthTable data={data} criteria={criteria} />
        <p className="mt-2 text-[12px] text-faint">
          El promedio cubre el período completo. Este detalle mensual es el movimiento sobre el que
          se calcula.
        </p>
      </>
    );
  }

  if (report.id === "creditos-emitidos") {
    return (
      <>
        {!data.credits.scoped && (
          <ScopeWarning>
            Una nota de crédito se emite contra un cliente, no contra una línea de producto ni
            contra el responsable de una HCA. Esas dos columnas no existen en la solicitud, así que
            estas cifras cubren todo el período sin ese recorte.
          </ScopeWarning>
        )}
        {data.credits.count === 0 ? (
          <Empty>No se aprobó ninguna nota de crédito con estos criterios.</Empty>
        ) : (
          <>
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatTile label="Notas emitidas" value={String(data.credits.count)} />
              <StatTile label="Monedas distintas" value={String(data.credits.byCurrency.length)} />
              {/* El acumulado mas grande no se puede llamar "total": son monedas
                  distintas y no se suman entre si. Se nombra la moneda. */}
              {data.credits.byCurrency.slice(0, 1).map((entry) => (
                <StatTile
                  key={entry.currency}
                  label={`Acumulado ${entry.currency}`}
                  value={formatAmount(entry.total, entry.currency)}
                  hint={`${entry.count} ${entry.count === 1 ? "nota" : "notas"}`}
                />
              ))}
            </div>

            <DataTable>
            <thead>
              <HeadRow>
                <Th>Moneda</Th>
                <Th className="text-right">Notas</Th>
                <Th className="text-right">Acumulado</Th>
              </HeadRow>
            </thead>
            <tbody>
              {data.credits.byCurrency.map((entry) => (
                <Row key={entry.currency}>
                  <Td className="text-[12.5px] text-brand-gray">{entry.currency}</Td>
                  <Td className="text-right text-[12.5px] tabular-nums text-brand-gray">
                    {entry.count}
                  </Td>
                  <Td className="text-right text-[12.5px] font-medium tabular-nums text-ink">
                    {formatAmount(entry.total, entry.currency)}
                  </Td>
                </Row>
              ))}
            </tbody>
            <tfoot>
              {/* Los montos no se suman entre monedas: el pie totaliza lo unico
                  que se puede totalizar. */}
              <tr className="border-t border-line">
                <th
                  scope="row"
                  className="py-2.5 pl-0 pr-3.5 text-left text-[12.5px] font-medium text-ink"
                >
                  Total de notas
                </th>
                <td className="px-3.5 py-2.5 text-right text-[12.5px] font-medium tabular-nums text-ink">
                  {data.credits.count}
                </td>
                <td className="py-2.5 pl-3.5 pr-0 text-right text-[12px] text-faint">
                  {data.credits.byCurrency.length === 1
                    ? "en una moneda"
                    : `en ${data.credits.byCurrency.length} monedas`}
                </td>
              </tr>
            </tfoot>
            </DataTable>
          </>
        )}
      </>
    );
  }

  // hca-por-periodo
  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Abiertas en el período" value={String(data.openedInRange)} />
        <StatTile label="Cerradas en el período" value={String(data.closedInRange)} tone="green" />
        <StatTile label="Abiertas hoy" value={String(data.openNow)} />
        <StatTile
          label="Vencidas hoy"
          value={String(data.overdueNow)}
          tone={data.overdueNow > 0 ? "red" : "neutral"}
        />
      </div>

      <MonthTable data={data} criteria={criteria} />
      <p className="mt-2 text-[12px] text-faint">
        Una diferencia positiva significa que se abrieron más HCA de las que se cerraron en ese mes.
      </p>
    </>
  );
}

export function ClientsResult({
  report,
  data,
}: {
  report: ReportDefinition;
  data: ClientsReport;
}) {
  const isTerritory = report.id === "cartera-por-territorio";

  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Clientes en el recorte" value={String(data.total)} />
        <StatTile label="Activos" value={String(data.active)} tone="green" />
        <StatTile
          label="Sin vendedor"
          value={String(data.withoutSalesRep)}
          tone={data.withoutSalesRep > 0 ? "warn" : "neutral"}
        />
      </div>

      {isTerritory ? (
        data.byTerritory.length === 0 ? (
          <Empty>Ningún territorio tiene clientes con estos criterios.</Empty>
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
                  <Td className="text-right text-[12.5px] tabular-nums text-brand-gray">
                    {entry.total}
                  </Td>
                  <Td className="text-right text-[12.5px] tabular-nums text-brand-gray">
                    {entry.active}
                  </Td>
                </Row>
              ))}
            </tbody>
          </DataTable>
        )
      ) : data.bySalesRep.length === 0 ? (
        <Empty>Ningún vendedor activo tiene cartera con estos criterios.</Empty>
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
                <Td className="text-right text-[12.5px] tabular-nums text-brand-gray">
                  {entry.clients}
                </Td>
              </Row>
            ))}
          </tbody>
        </DataTable>
      )}
    </>
  );
}

const instantFormat = new Intl.DateTimeFormat("es-DO", { dateStyle: "medium", timeStyle: "short" });

export function AuditSliceResult({
  data,
  criteria,
}: {
  report: ReportDefinition;
  data: AuditReport | AuditSliceReport;
  criteria: ReportCriteria;
}) {
  if (data.total === 0) {
    return (
      <Empty>
        No se registró ninguna entrada entre el {criteria.from} y el {criteria.to}.
      </Empty>
    );
  }

  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Entradas en el período" value={String(data.total)} />
        <StatTile label="Personas distintas" value={String(data.byActor.length)} />
        <StatTile label="Tipos de acción" value={String(data.byAction.length)} />
      </div>

      <DataTable>
        <thead>
          <HeadRow>
            <Th>Cuándo</Th>
            <Th>Quién</Th>
            <Th>Acción</Th>
            <Th>Sobre</Th>
          </HeadRow>
        </thead>
        <tbody>
          {data.items.map((item) => (
            <Row key={item.id}>
              <Td className="whitespace-nowrap text-[12.5px] tabular-nums text-brand-gray">
                {instantFormat.format(new Date(item.createdAt))}
              </Td>
              <Td className="text-[12.5px] text-brand-gray">{item.actor}</Td>
              <Td className="text-[12.5px] text-brand-gray">{item.action}</Td>
              <Td className="text-[12.5px] text-faint">
                {item.entity} <span className="font-mono text-[11px]">{item.entityId}</span>
              </Td>
            </Row>
          ))}
        </tbody>
      </DataTable>

      {data.total > data.items.length && (
        <p className="mt-2 text-[12px] text-faint">
          Se muestran las {data.items.length} más recientes de {data.total}. «Exportar CSV» genera
          el período completo en el servidor, no solo esta página.
        </p>
      )}
    </>
  );
}
