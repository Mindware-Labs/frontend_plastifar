import { BadgeCheck, Check, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { clientsApi } from "../../api/clients";
import {
  qualityApi,
  type CreditCounts,
  type CreditListResponse,
  type CreditQuery,
} from "../../api/quality";
import { staffApi } from "../../api/staff";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
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

/**
 * Lo que el listado debe antes de lo que contiene: una solicitud sin decidir es
 * dinero parado, y esa es la unica cifra que mueve a quien abre esta pantalla.
 */
function listDebt(counts: CreditCounts): string {
  if (counts.requested === 0) {
    return "Ninguna solicitud espera decisión.";
  }
  const head =
    counts.requested === 1
      ? "1 solicitud espera decisión"
      : `${counts.requested} solicitudes esperan decisión`;
  return `${head}. Nadie puede aprobar la suya propia: esas las decide otra persona.`;
}

/** Por que esta fila no ofrece ninguna accion. */
function inactionReason(status: CreditStatus, canWrite: boolean): string {
  if (status === "Aprobada") {
    return canWrite
      ? "Aprobada: solo queda marcarla como aplicada."
      : "Aprobada. Marcarla como aplicada requiere el permiso quality.write.";
  }
  if (status === "Aplicada") return "Ya aplicada: la nota de crédito está registrada.";
  if (status === "Rechazada") return "Rechazada: para cambiar el monto se crea otra solicitud.";
  return "Sin acciones disponibles para esta solicitud.";
}

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
  const [applying, setApplying] = useState<CreditRequest | null>(null);

  const debouncedSearch = useDebouncedValue(search).trim();
  // El monto tambien se escribe tecla a tecla: sin retardo, «12500» disparaba
  // cinco consultas y devolvia la lista a la primera pagina cinco veces.
  const debouncedMinAmount = useDebouncedValue(minAmount);

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

  const minimum = debouncedMinAmount === "" ? undefined : Number(debouncedMinAmount);

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
    fallbackError: "No se pudieron cargar las solicitudes de crédito. Vuelve a intentarlo.",
  });

  const rows = data?.items ?? [];
  const counts = data?.counts;
  const unfiltered =
    chip === "todas" && clientId === "todos" && debouncedMinAmount === "" && !debouncedSearch;

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

        {/* Antes de la primera respuesta no hay contadores: un «0» junto a
            «Solicitadas» es un dato, y seria falso. Se reserva el sitio. */}
        <div className="flex flex-wrap items-center gap-2">
          {counts
            ? CHIPS.map(({ key, label, countKey }) => (
                <FilterChip
                  key={key}
                  label={label}
                  count={counts[countKey]}
                  active={chip === key}
                  onClick={() => setChip(key)}
                />
              ))
            : CHIPS.map(({ key }) => (
                <span
                  key={key}
                  aria-hidden
                  className="h-8 w-[110px] animate-pulse rounded-full bg-fill"
                />
              ))}
        </div>
      </div>

      {error && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="min-w-[240px] flex-1">
            <Alert variant="error">{error}</Alert>
          </div>
          <Button size="sm" variant="secondary" onClick={refresh}>
            Reintentar
          </Button>
        </div>
      )}

      {counts && <p className="mb-3 text-[12.5px] text-brand-gray">{listDebt(counts)}</p>}

      {data === null ? (
        error === null && (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        )
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
                    <Td className="whitespace-nowrap text-[12.5px] tabular-nums text-brand-gray">
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
                        ) : request.status === "Aprobada" && canWrite ? (
                          <RowAction
                            label={`Marcar ${request.number} como aplicada`}
                            icon={BadgeCheck}
                            onClick={() => setApplying(request)}
                          />
                        ) : (
                          // Una raya sola no dice nada. La rama hermana explica
                          // su propio bloqueo con un Tooltip; esta tambien.
                          <Tooltip content={inactionReason(request.status, canWrite)}>
                            <span className="text-[11.5px] text-faint">—</span>
                          </Tooltip>
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

      {applying && (
        <ConfirmDialog
          // El propio texto dice que no se deshace: eso es «danger», no «warn».
          tone="danger"
          icon={BadgeCheck}
          title={`Aplicar ${applying.number}`}
          description={
            <>
              Se marcará la nota de crédito por{" "}
              <strong className="font-medium text-ink">
                {formatAmount(applying.amount, applying.currency)}
              </strong>{" "}
              de {clientName(applying.clientId)} como aplicada. Hazlo solo cuando ya
              esté registrada en el sistema contable. Esta acción no se puede deshacer.
            </>
          }
          confirmLabel="Marcar como aplicada"
          onConfirm={async () => {
            await qualityApi.creditRequests.apply(applying.id);
            refresh();
          }}
          onClose={() => setApplying(null)}
        />
      )}
    </div>
  );
}
