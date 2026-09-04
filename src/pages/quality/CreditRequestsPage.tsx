import { Check, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { usePermissions } from "../../hooks/usePermissions";
import { upsertById } from "../../lib/catalog";
import { creditDecisionBlock, formatAmount, formatDay, formatInstant } from "../../lib/quality";
import { clientsMock } from "../../mocks/clients";
import { qualityMock } from "../../mocks/quality";
import type { Client } from "../../types/clients";
import type { CreditRequest, CreditStatus } from "../../types/quality";
import { CreditDecisionModal } from "./CreditDecisionModal";
import { CreditRequestModal } from "./CreditRequestModal";
import { CreditStatusBadge } from "./StatusBadges";
import { TicketLink } from "./TicketLink";

type ChipKey = "todas" | CreditStatus;

/** RF-Q6, RF-Q7 y RF-Q8: solicitudes de credito. */
export function CreditRequestsPage() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const canWrite = can("quality.write");
  const canApprove = can("quality.approve");
  const viewerStaffId = user?.staffId ?? null;

  const [requests, setRequests] = useState<CreditRequest[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState("todos");
  const [minAmount, setMinAmount] = useState("");
  const [chip, setChip] = useState<ChipKey>("todas");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [creating, setCreating] = useState(false);
  const [deciding, setDeciding] = useState<{
    request: CreditRequest;
    decision: "aprobar" | "rechazar";
  } | null>(null);

  const staff = qualityMock.staff();
  const debouncedSearch = useDebouncedValue(search).trim().toLowerCase();

  useEffect(() => {
    Promise.all([qualityMock.creditRequests(viewerStaffId), clientsMock.clients()])
      .then(([loadedRequests, loadedClients]) => {
        setRequests(loadedRequests);
        setClients(loadedClients);
      })
      .catch(() => setError("No se pudieron cargar las solicitudes de crédito"));
  }, [viewerStaffId]);

  const all = useMemo(() => requests ?? [], [requests]);

  function clientName(id: number) {
    return clients.find((client) => client.id === id)?.name ?? "—";
  }

  function staffName(id: number | null) {
    if (id === null) return "—";
    if (id === viewerStaffId) return "Tú";
    return staff.find((person) => person.id === id)?.name ?? "—";
  }

  const minimum = minAmount === "" ? null : Number(minAmount);

  const base = all.filter((request) => {
    const byClient = clientId === "todos" || request.clientId === Number(clientId);
    const byAmount = minimum === null || Number.isNaN(minimum) || request.amount >= minimum;
    const bySearch =
      debouncedSearch === "" ||
      request.number.toLowerCase().includes(debouncedSearch) ||
      request.reason.toLowerCase().includes(debouncedSearch) ||
      (request.invoiceRef?.toLowerCase().includes(debouncedSearch) ?? false) ||
      clientName(request.clientId).toLowerCase().includes(debouncedSearch);

    return byClient && byAmount && bySearch;
  });

  const counts = {
    todas: base.length,
    Solicitada: base.filter((request) => request.status === "Solicitada").length,
    Aprobada: base.filter((request) => request.status === "Aprobada").length,
    Rechazada: base.filter((request) => request.status === "Rechazada").length,
    Aplicada: base.filter((request) => request.status === "Aplicada").length,
  };

  const rows = base.filter((request) => chip === "todas" || request.status === chip);

  // Paginacion de prueba: el corte lo hace la vista solo mientras no exista
  // /api/quality/credit-requests. El endpoint devuelve la pagina ya cortada en
  // SQL, con total, totalPages y counts (anexo 12.1).
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function resetToFirstPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  function upsert(request: CreditRequest) {
    setRequests((previous) => upsertById(previous ?? [], request));
  }

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
        {/* Sin htmlFor: SearchInput ya trae su propio aria-label. */}
        <CriteriaField label="Buscar">
          <SearchInput
            value={search}
            onChange={resetToFirstPage(setSearch)}
            placeholder="Número, cliente, factura o motivo…"
            className="w-[260px]"
          />
        </CriteriaField>

        <CriteriaSelect
          label="Cliente"
          ariaLabel="Filtrar por cliente"
          value={clientId}
          onChange={resetToFirstPage(setClientId)}
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
            onChange={(event) => resetToFirstPage(setMinAmount)(event.target.value)}
          />
        </CriteriaField>

        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            label="Todas"
            count={counts.todas}
            active={chip === "todas"}
            onClick={() => resetToFirstPage(setChip)("todas")}
          />
          <FilterChip
            label="Solicitadas"
            count={counts.Solicitada}
            active={chip === "Solicitada"}
            onClick={() => resetToFirstPage(setChip)("Solicitada")}
          />
          <FilterChip
            label="Aprobadas"
            count={counts.Aprobada}
            active={chip === "Aprobada"}
            onClick={() => resetToFirstPage(setChip)("Aprobada")}
          />
          <FilterChip
            label="Rechazadas"
            count={counts.Rechazada}
            active={chip === "Rechazada"}
            onClick={() => resetToFirstPage(setChip)("Rechazada")}
          />
          <FilterChip
            label="Aplicadas"
            count={counts.Aplicada}
            active={chip === "Aplicada"}
            onClick={() => resetToFirstPage(setChip)("Aplicada")}
          />
        </div>
      </div>

      {error && (
        <div className="mb-3">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {requests === null ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : pageRows.length === 0 ? (
        <p className="py-14 text-center text-[13.5px] text-faint">
          {all.length === 0
            ? "Todavía no hay solicitudes de crédito."
            : "Ninguna solicitud coincide con este filtro o búsqueda."}
        </p>
      ) : (
        <>
          <DataTable>
            <thead>
              <HeadRow>
                {/* El monto viaja junto al número: en pantalla estrecha la
                    tabla se desplaza, y el dato por el que existe esta
                    pantalla no puede ser el que se queda fuera. */}
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
              {pageRows.map((request) => {
                const block = creditDecisionBlock(request, viewerStaffId, canApprove);
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
                      {/* En pantalla estrecha el nombre cede con puntos
                          suspensivos en vez de empujar la tabla. */}
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
                      {/* Solo el dia: la hora exacta vive en el detalle, y aqui
                          le quitaba el ancho al nombre del cliente. */}
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
                            // La regla de separacion entre quien pide y quien
                            // aprueba se dice, no se esconde: un boton ausente
                            // se lee como un fallo de la pantalla.
                            <Tooltip
                              content={
                                own
                                  ? "No puedes aprobar tu propia solicitud"
                                  : "No tienes permiso para decidir"
                              }
                            >
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
            page={currentPage}
            pageSize={pageSize}
            total={total}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            noun="solicitudes"
          />
        </>
      )}

      <p className="mt-4 max-w-[76ch] text-[12px] leading-relaxed text-faint">
        Datos de prueba: el módulo de Calidad todavía no tiene backend. Los montos, los clientes y
        las decisiones que se ven aquí son de ejemplo; ninguna nota de crédito real se emite desde
        esta pantalla.
      </p>

      {creating && (
        <CreditRequestModal
          clients={clients}
          existing={all}
          requestedByStaffId={viewerStaffId}
          onClose={() => setCreating(false)}
          onSave={upsert}
        />
      )}

      {deciding && (
        <CreditDecisionModal
          request={deciding.request}
          decision={deciding.decision}
          requesterName={staffName(deciding.request.requestedByStaffId)}
          clientName={clientName(deciding.request.clientId)}
          decidedByStaffId={viewerStaffId}
          onClose={() => setDeciding(null)}
          onSave={upsert}
        />
      )}
    </div>
  );
}
