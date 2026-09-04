import { useEffect, useState } from "react";
import { Alert } from "../../components/ui/Alert";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { Spinner } from "../../components/ui/Spinner";
import { downloadCsv } from "../../lib/csv";
import { reportsMock } from "../../mocks/reports";
import type { LiveOperationData } from "../../types/reports";
import { DateRangeBar } from "./DateRangeBar";
import { ReportsLayout } from "./ReportsLayout";
import { StatTile } from "./StatTile";
import { useDateRange } from "./useDateRange";

const barTone: Record<string, string> = {
  neutral: "bg-brand-gray",
  red: "bg-brand-red",
  green: "bg-brand-green",
  warn: "bg-warn",
};

export function LiveOperationSection() {
  const { range, setRange } = useDateRange();
  const [data, setData] = useState<LiveOperationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    reportsMock
      .liveOperation(range)
      .then((loaded) => {
        if (cancelled) return;
        setData(loaded);
      })
      .catch(() => {
        if (cancelled) return;
        setError("No se pudo cargar el reporte");
      });

    return () => {
      cancelled = true;
    };
  }, [range]);

  const total = data?.byStatus.reduce((sum, entry) => sum + entry.count, 0) ?? 0;

  function exportCsv() {
    if (!data) return;
    downloadCsv(
      `bandeja-por-estado_${range.from}_${range.to}.csv`,
      ["Estado", "Tickets"],
      data.byStatus.map((entry) => [entry.status, entry.count]),
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
            <StatTile label="Sin asignar" value={String(data.unassigned)} />
            <StatTile label="Por vencer" value={String(data.dueSoon)} tone="warn" />
            <StatTile label="Vencidos" value={String(data.overdue)} tone="red" />
            <StatTile label="Total en bandeja" value={String(total)} />
          </div>

          <section>
            <h2 className="mb-2 font-heading text-[14px] font-bold tracking-[-0.01em] text-ink">
              Bandeja por estado
            </h2>
            <div className="flex flex-col gap-2.5">
              {data.byStatus.map((entry) => (
                <div key={entry.status} className="flex items-center gap-3">
                  <span className="w-[168px] shrink-0 text-[12.5px] text-brand-gray">
                    {entry.status}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-fill">
                    <div
                      className={`h-full rounded-full ${barTone[entry.tone]}`}
                      style={{ width: `${total === 0 ? 0 : (entry.count / total) * 100}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-[12.5px] font-medium tabular-nums text-ink">
                    {entry.count}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-2 font-heading text-[14px] font-bold tracking-[-0.01em] text-ink">
              Carga por agente
            </h2>
            <DataTable>
              <thead>
                <HeadRow>
                  <Th>Agente</Th>
                  <Th>Departamento</Th>
                  <Th>Tickets abiertos</Th>
                </HeadRow>
              </thead>
              <tbody>
                {data.byAgent.map((agent) => (
                  <Row key={agent.agentName}>
                    <Td className="text-[13px] font-medium text-ink">{agent.agentName}</Td>
                    <Td className="text-[12.5px] text-brand-gray">{agent.departmentName}</Td>
                    <Td className="text-[12.5px] tabular-nums text-brand-gray">
                      {agent.openTickets}
                    </Td>
                  </Row>
                ))}
              </tbody>
            </DataTable>
          </section>
        </div>
      )}
    </ReportsLayout>
  );
}
