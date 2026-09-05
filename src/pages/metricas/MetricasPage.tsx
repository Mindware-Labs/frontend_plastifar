import { useEffect, useState } from "react";
import { ApiError } from "../../api/client";
import { emailsApi } from "../../api/emails";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { DateRangePicker } from "../../components/ui/DateRangePicker";
import { Spinner } from "../../components/ui/Spinner";
import type { EmailMetricsResponse } from "../../types/api";
import { dayStart } from "../bandeja/filterCriteria";

function isoDay(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Minutos a algo legible: 45 min, 3,2 h, 1,5 d. */
function formatMinutes(minutes: number | null) {
  if (minutes === null) return "—";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 60 * 24) return `${(minutes / 60).toLocaleString("es-419", { maximumFractionDigits: 1 })} h`;
  return `${(minutes / 60 / 24).toLocaleString("es-419", { maximumFractionDigits: 1 })} d`;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-edge border border-line bg-white px-4 py-3">
      <p className="font-heading text-[10px] font-semibold uppercase tracking-[0.1em] text-faint">{label}</p>
      <p className="mt-1 font-heading text-[22px] font-bold tracking-[-0.02em] text-ink">{value}</p>
      {hint && <p className="text-[11px] text-subtle">{hint}</p>}
    </div>
  );
}

/** Volumen y tiempos de primera respuesta del equipo en un rango de fechas. */
export function MetricasPage() {
  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setDate(today.getDate() - 29);

  const [since, setSince] = useState(isoDay(monthAgo));
  const [until, setUntil] = useState(isoDay(today));
  const [data, setData] = useState<EmailMetricsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Cargando = el rango pedido todavia no es el que trajo la ultima respuesta.
  const [loadedRange, setLoadedRange] = useState("");
  const loading = loadedRange !== `${since}|${until}`;

  useEffect(() => {
    if (!since || !until) return;
    let cancelled = false;

    const end = dayStart(until);
    end.setDate(end.getDate() + 1);

    emailsApi
      .metrics(dayStart(since).toISOString(), end.toISOString())
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "No se pudieron cargar las métricas");
      })
      .finally(() => {
        if (!cancelled) setLoadedRange(`${since}|${until}`);
      });

    return () => {
      cancelled = true;
    };
  }, [since, until]);

  const maxDaily = Math.max(1, ...(data?.daily ?? []).map((d) => Math.max(d.received, d.sent)));
  const answeredRate =
    data && data.conversations > 0 ? Math.round((data.conversationsAnswered / data.conversations) * 100) : null;

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        title="Métricas"
        summary={
          data
            ? `${data.received} recibidos · ${data.sent} enviados · ${data.conversations} conversaciones en el rango`
            : "Volumen de correo y tiempos de respuesta del equipo"
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto pb-8">
        <div className="mb-4 max-w-[320px]">
          <DateRangePicker
            since={since}
            until={until}
            onChange={(nextSince, nextUntil) => {
              setSince(nextSince);
              setUntil(nextUntil);
            }}
          />
        </div>

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
          <div className={`flex flex-col gap-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <Stat label="Recibidos" value={String(data.received)} />
              <Stat label="Enviados" value={String(data.sent)} />
              <Stat label="Conversaciones" value={String(data.conversations)} hint="con correo del cliente" />
              <Stat
                label="Respondidas"
                value={answeredRate === null ? "—" : `${answeredRate} %`}
                hint={`${data.conversationsAnswered} de ${data.conversations}`}
              />
              <Stat label="1.ª respuesta (media)" value={formatMinutes(data.avgFirstResponseMinutes)} />
              <Stat label="1.ª respuesta (mediana)" value={formatMinutes(data.medianFirstResponseMinutes)} />
            </div>

            {data.daily.length > 0 && (
              <div className="rounded-edge border border-line bg-white px-4 py-3">
                <div className="mb-2 flex items-center gap-4 text-[11px] text-subtle">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-brand-gray/70" /> Recibidos
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-brand-red" /> Enviados
                  </span>
                </div>
                <div className="flex h-36 items-end gap-[3px] overflow-x-auto">
                  {data.daily.map((day) => (
                    <div
                      key={day.day}
                      title={`${day.day}: ${day.received} recibidos · ${day.sent} enviados`}
                      className="flex h-full min-w-[10px] flex-1 items-end gap-px"
                    >
                      <span
                        className="w-1/2 rounded-t-[2px] bg-brand-gray/70"
                        style={{ height: `${(day.received / maxDaily) * 100}%` }}
                      />
                      <span
                        className="w-1/2 rounded-t-[2px] bg-brand-red"
                        style={{ height: `${(day.sent / maxDaily) * 100}%` }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DataTable>
              <thead>
                <HeadRow>
                  <Th>Agente</Th>
                  <Th className="text-right">Enviados</Th>
                  <Th className="text-right">Conversaciones respondidas</Th>
                  <Th className="text-right">1.ª respuesta (media)</Th>
                </HeadRow>
              </thead>
              <tbody>
                {data.agents.map((agent) => (
                  <Row key={agent.staffId}>
                    <Td className="text-[13px] font-medium text-ink">{agent.name}</Td>
                    <Td className="text-right tabular-nums text-[13px]">{agent.sent}</Td>
                    <Td className="text-right tabular-nums text-[13px]">{agent.conversationsAnswered}</Td>
                    <Td className="text-right tabular-nums text-[13px]">{formatMinutes(agent.avgFirstResponseMinutes)}</Td>
                  </Row>
                ))}
              </tbody>
            </DataTable>

            {data.agents.length === 0 && (
              <p className="py-10 text-center text-[13.5px] text-faint">Nadie envió correos en este rango.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
