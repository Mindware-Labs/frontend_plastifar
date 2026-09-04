import { Check, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { clientsApi } from "../../api/clients";
import { qualityApi, type CreditListResponse, type CreditQuery } from "../../api/quality";
import { staffApi } from "../../api/staff";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { ControlInput } from "../../components/ui/ControlInput";
import { CriteriaField, CriteriaSelect } from "../../components/ui/CriteriaField";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { FilterChip } from "../../components/ui/FilterChip";
import { Pagination } from "../../components/ui/Pagination";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { Spinner } from "../../components/ui/Spinner";
import { Tooltip } from "../../components/ui/Tooltip";
import { useAuth } from "../../context/useAuth";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import { formatAmount, formatDay, formatInstant } from "../../lib/quality";
import type { Client } from "../../types/clients";
import type { CreditRequest, CreditStatus, QualityStaff } from "../../types/quality";
import { CreditDecisionModal } from "./CreditDecisionModal";
import { CreditRequestModal } from "./CreditRequestModal";
import { CreditStatusBadge } from "./StatusBadges";
import { TicketLink } from "./TicketLink";

type ChipKey = "todas" | CreditStatus;

const CHIPS: { key: ChipKey; label: string; status?: string; countKey: "all" | "requested" | "approved" | "rejected" | "applied" }[] = [
  { key: "todas", label: "Todas", countKey: "all" },
  { key: "Solicitada", label: "Solicitadas", status: "Solicitada", countKey: "requested" },
  { key: "Aprobada", label: "Aprobadas", status: "Aprobada", countKey: "approved" },
  { key: "Rechazada", label: "Rechazadas", status: "Rechazada", countKey: "rejected" },
  { key: "Aplicada", label: "Aplicadas", status: "Aplicada", countKey: "applied" },
];

/** RF-Q6, RF-Q7 y RF-Q8: solicitudes de credito. */
export function CreditRequestsPage() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const canWrite = can("quality.write");
  const viewerStaffId = user?.staffId ?? null;

  const [clients, setClients] = useState<Client[]>([]);
  const [staff, setStaff] = useState<QualityStaff[]>([]);

  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState("todos");
  const [minAmount, setMinAmount] = useState("");
  const [chip, setChip] = useState<ChipKey>("todas");
  const [pageSize, setPageSize] = useState(10);

  const [creating, setCreating] = useState(false);
  const [deciding, setDeciding] = useState<{
    request: CreditRequest;
    decision: "aprobar" | "rechazar";
  } | null>(null);

  const debouncedSearch = useDebouncedValue(search).trim();

  useEffect(() => {
    clientsApi
      .list({ page: 1, pageSize: 100 })
      .then((data) => setClients(data.items))
      .catch(() => setClients([]));

    staffApi
      .list({ page: 1, pageSize: 100, status: "activos" })
      .then((data) => setStaff(data.items.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}` }))))
      .catch(() => setStaff([]));
  }, []);

  function clientName(id: number) {
    return clients.find((client) => client.id === id)?.name ?? "—";
  }

  function staffName(id: number | null) {
    if (id === null) return "—";
    if (id === viewerStaffId) return "Tú";
    return staff.find((person) => person.id === id)?.name ?? "—";
  }

  const minimum = minAmount === "" ? undefined : Number(minAmount);

  const criteria: Omit<CreditQuery, "page"> = {
    pageSize,
    search: debouncedSearch || undefined,
    clientId: clientId === "todos" ? undefined : Number(clientId),
    minAmount: minimum === undefined || Number.isNaN(minimum) ? undefined : minimum,
    status: CHIPS.find((c) => c.key === chip)?.status,
  };

  const { data, isStale, error, setPage, refresh } = usePagedList<CreditQuery, CreditListResponse>({
    fetch: qualityApi.creditRequests.list,
    criteria,
    fallbackError: "No se pudieron cargar las solicitudes de crédito",
  });

  const rows = data?.items ?? [];
  const counts = data?.counts;
  const unfiltered = chip === "todas" && clientId === "todos" && minAmount === "" && !debouncedSearch;

  return (
    <div>
      <ModuleHeader
        action={
          canWrite && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-[15px] w-[15px]" />
              Nueva solicitud
            </Button>
          )
        }
      />

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <CriteriaField label="Buscar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Número, cliente, factura o motivo…"
            className="w-[260px]"
          />
        </CriteriaField>

        <CriteriaSelect
          label="Cliente"
          ariaLabel="Filtrar por cliente"
          value={clientId}
          onChange={setClientId}
          options={[
            { value: "todos", label: "Todos los clientes" },
            ...clients.map((client) => ({ value: String(client.id), label: client.name })),
          ]}
          width="w-[220px]"
        />

        <CriteriaField label="Monto desde" htmlFor="credito-monto">
          <ControlInput
            id="credito-monto"
            type="number"
            min="0"
            step="100"
            inputMode="decimal"
            placeholder="0"
            className="w-[130px]"
            value={minAmount}
            onChange={(event) => setMinAmount(event.target.value)}
          />
        </CriteriaField>

        <div className="flex flex-wrap items-center gap-2">
          {CHIPS.map(({ key, label, countKey }) => (
            <FilterChip
              key={key}
              label={label}
              count={counts?.[countKey] ?? 0}
              active={chip === key}
              onClick={() => setChip(key)}
            />
          ))}
        </div>
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
      ) : rows.length === 0 ? (
        <p className="py-14 text-center text-[13.5px] text-faint">
          {unfiltered
            ? "Todavía no hay solicitudes de crédito."
            : "Ninguna solicitud coincide con este filtro o búsqueda."}
        </p>
      ) : (
        <div className={`transition-opacity ${isStale ? "opacity-60" : ""}`}>
          <DataTable>
            <thead>
              <HeadRow>
                <Th>Número</Th>
                <Th className="text-right">Monto</Th>
                <Th>Cliente</Th>
                <Th>Solicitada por</Th>
                <Th>Solicitada el</Th>
                <Th>Estado</Th>
                <Th>Ticket</Th>
                <Th className="w-24 text-right">Acciones</Th>
              </HeadRow>
            </thead>

            <tbody>
              {rows.map((request) => {
                const block = request.decisionBlockedReason;
                const own = request.requestedByStaffId === viewerStaffId;

                return (
                  <Row key={request.id}>
                    <Td>
                      <span className="whitespace-nowrap font-mono text-[12px] font-medium text-ink">
                        {request.number}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-right text-[12.5px] font-medium tabular-nums text-ink">
                      {formatAmount(request.amount, request.currency)}
                    </Td>
                    <Td className="text-[12.5px] text-brand-gray">
                      <span
                        title={clientName(request.clientId)}
                        className="block max-w-[130px] truncate sm:max-w-none sm:overflow-visible"
                      >
                        {clientName(request.clientId)}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-[12.5px] text-brand-gray">
                      {staffName(request.requestedByStaffId)}
                    </Td>
                    <Td className="whitespace-nowrap text-[12.5px] text-brand-gray">
                      {formatDay(request.requestedAt.slice(0, 10))}
                    </Td>
                    <Td>
                      <span className="flex flex-col items-start gap-0.5">
                        <CreditStatusBadge status={request.status} />
                        {request.decidedAt && (
                          <span className="whitespace-nowrap text-[11.5px] text-faint">
                            {staffName(request.decidedByStaffId)} ·{" "}
                            {formatInstant(request.decidedAt)}
                          </span>
                        )}
                      </span>
                    </Td>
                    <Td>
                      <TicketLink number={request.ticketNumber} />
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        {request.status === "Solicitada" ? (
                          block === null ? (
                            <>
                              <RowAction
                                label={`Aprobar ${request.number}`}
                                icon={Check}
                                onClick={() => setDeciding({ request, decision: "aprobar" })}
                              />
                              <RowAction
                                label={`Rechazar ${request.number}`}
                                icon={X}
                                onClick={() => setDeciding({ request, decision: "rechazar" })}
                                danger
                              />
                            </>
                          ) : (
                            <Tooltip content={block}>
                              <span className="text-[11.5px] text-faint">
                                {own ? "Tuya" : "Sin permiso"}
                              </span>
                            </Tooltip>
                          )
                        ) : (
                          <span className="text-[11.5px] text-faint">—</span>
                        )}
                      </div>
                    </Td>
                  </Row>
                );
              })}
            </tbody>
          </DataTable>

          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            totalPages={data.totalPages}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            noun="solicitudes"
          />
        </div>
      )}

      {creating && (
        <CreditRequestModal
          clients={clients}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            refresh();
          }}
        />
      )}

      {deciding && (
        <CreditDecisionModal
          request={deciding.request}
          decision={deciding.decision}
          requesterName={staffName(deciding.request.requestedByStaffId)}
          clientName={clientName(deciding.request.clientId)}
          onClose={() => setDeciding(null)}
          onSaved={() => {
            setDeciding(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
