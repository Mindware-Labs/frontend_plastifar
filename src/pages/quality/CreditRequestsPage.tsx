import { BadgeCheck, Check, Plus, X } from "lucide-react";
import { useState } from "react";
import {
  qualityApi,
  type CreditListResponse,
  type CreditQuery,
} from "../../api/quality";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { ControlInput } from "../../components/ui/ControlInput";
import { CriteriaField, CriteriaLookup } from "../../components/ui/CriteriaField";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { HeaderTag } from "../../components/ui/HeaderTag";
import { ListPanel } from "../../components/ui/ListPanel";
import { Pagination } from "../../components/ui/Pagination";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { Tooltip } from "../../components/ui/Tooltip";
import { useAuth } from "../../context/useAuth";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import { resolveClientLabel, searchClients } from "../../lib/lookups";
import { formatAmount, formatDay, formatInstant } from "../../lib/quality";
import type { CreditRequest, CreditStatus } from "../../types/quality";
import { CreditDecisionModal } from "./CreditDecisionModal";
import { CreditRequestModal } from "./CreditRequestModal";
import { CreditStatusBadge } from "./StatusBadges";
import { TicketLink } from "./TicketLink";
import { FilterPopover } from "../../components/ui/FilterPopover";

type ChipKey = "todas" | CreditStatus;

const CHIPS: { key: ChipKey; label: string; status?: string; countKey: "all" | "requested" | "approved" | "rejected" | "applied" }[] = [
  { key: "todas", label: "Todas", countKey: "all" },
  { key: "Solicitada", label: "Solicitadas", status: "Solicitada", countKey: "requested" },
  { key: "Aprobada", label: "Aprobadas", status: "Aprobada", countKey: "approved" },
  { key: "Rechazada", label: "Rechazadas", status: "Rechazada", countKey: "rejected" },
  { key: "Aplicada", label: "Aplicadas", status: "Aplicada", countKey: "applied" },
];

/**
 * Por que esta fila no ofrece ninguna accion.
 *
 * El permiso que se nombra es el que exige el endpoint, no el que parezca
 * razonable: decirle a alguien que le falta `quality.write` cuando el servidor
 * comprueba `quality.approve` lo manda a pedir el permiso equivocado.
 */
function inactionReason(status: CreditStatus, canApprove: boolean): string {
  if (status === "Aprobada") {
    return canApprove
      ? "Aprobada: solo queda marcarla como aplicada."
      : "Aprobada. Marcarla como aplicada requiere el permiso quality.approve.";
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
  /**
   * `POST /credit-requests/{id}/apply` esta anotado con `quality.approve` en
   * CreditRequestsController. El boton se apaga con el permiso que el endpoint
   * comprueba de verdad: ofrecerlo con `quality.write` mandaba a quien solo
   * escribe a chocar contra un 403 que la pantalla podia haberle evitado
   * (RF-P6). Que ese sea el permiso correcto para Contabilidad es otra
   * discusion, y es de Plastifar, no de la interfaz.
   */
  const canApply = can("quality.approve");
  const viewerStaffId = user?.staffId ?? null;


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

  /** «Tú» cuando es quien mira: la regla de la seccion 10.3 es sobre personas. */
  function staffLabel(id: number | null, name: string | null) {
    if (id === null) return "—";
    return id === viewerStaffId ? "Tú" : (name ?? "—");
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
  /* Los criterios que viven detras del boton. El numero viaja al disparador:
     un recorte que no se ve deja leer una tabla parcial como si fuera entera. */
  const filtrosPuestos = (clientId !== "todos" ? 1 : 0) + (minAmount !== "" ? 1 : 0);

  /** Quita solo lo del panel; la busqueda y las pastillas no se tocan. */
  function clearNarrowFilters() {
    setClientId("todos");
    setMinAmount("");
    setPage(1);
  }

  const unfiltered =
    chip === "todas" && clientId === "todos" && debouncedMinAmount === "" && !debouncedSearch;

  return (
    <div>
      <ModuleHeader
        title="Solicitudes de crédito"
        summary={
          counts ? (
            <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
              <HeaderTag
                label={counts.all === 1 ? "solicitud" : "solicitudes"}
                count={counts.all}
                active={chip === "todas"}
                onClick={() => {
                  setChip("todas");
                  setPage(1);
                }}
                tone="neutral"
                title="Mostrar todas las solicitudes de crédito"
              />
              <span aria-hidden className="text-zinc-300">·</span>
              <HeaderTag
                label={counts.requested === 1 ? "solicitada" : "solicitadas"}
                count={counts.requested}
                active={chip === "Solicitada"}
                onClick={() => {
                  setChip("Solicitada");
                  setPage(1);
                }}
                tone="amber"
                dot
                title="Filtrar por solicitudes pendientes de decisión"
              />
              <span aria-hidden className="text-zinc-300">·</span>
              <HeaderTag
                label={counts.approved === 1 ? "aprobada" : "aprobadas"}
                count={counts.approved}
                active={chip === "Aprobada"}
                onClick={() => {
                  setChip("Aprobada");
                  setPage(1);
                }}
                tone="emerald"
                dot
                title="Filtrar por solicitudes aprobadas"
              />
              <span aria-hidden className="text-zinc-300">·</span>
              <HeaderTag
                label={counts.rejected === 1 ? "rechazada" : "rechazadas"}
                count={counts.rejected}
                active={chip === "Rechazada"}
                onClick={() => {
                  setChip("Rechazada");
                  setPage(1);
                }}
                tone="red"
                dot
                title="Filtrar por solicitudes rechazadas"
              />
              <span aria-hidden className="text-zinc-300">·</span>
              <HeaderTag
                label={counts.applied === 1 ? "aplicada" : "aplicadas"}
                count={counts.applied}
                active={chip === "Aplicada"}
                onClick={() => {
                  setChip("Aplicada");
                  setPage(1);
                }}
                tone="blue"
                dot
                title="Filtrar por solicitudes aplicadas"
              />
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-300" />
              Cargando las solicitudes de crédito…
            </span>
          )
        }
        action={
          canWrite && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-[15px] w-[15px]" />
              Nueva solicitud
            </Button>
          )
        }
      />

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


      <ListPanel
        toolbar={
          <>
        {/* Sin rótulo: el placeholder ya dice qué busca. */}
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Número, cliente, factura o motivo…"
          className="w-[260px]"
        />

        {/* Cliente y monto minimo, guardados. La barra tenia nueve controles en
            tres renglones y 119 px; los dos que se esconden se usan cuando se
            busca una solicitud concreta, no al abrir la pantalla. */}
        <FilterPopover count={filtrosPuestos} onClear={clearNarrowFilters}>
          <CriteriaLookup
          label="Cliente"
          ariaLabel="Filtrar por cliente"
          width="w-[220px]"
          placeholder="Todos los clientes"
          searchPlaceholder="Buscar cliente…"
          clearLabel="Todos los clientes"
          value={clientId === "todos" ? "" : clientId}
          onChange={(value) => setClientId(value === "" ? "todos" : value)}
          search={searchClients}
          resolveSelectedLabel={resolveClientLabel}
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
        </FilterPopover>
      </>
        }
        footer={
          data !== null && (
            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              totalPages={data.totalPages}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              noun="solicitudes"
            />
          )
        }
      >
        {data === null ? (
          error === null && <TableSkeleton rows={pageSize} columns={8} />
        ) : rows.length === 0 ? (
          <p className="py-14 text-center text-[13.5px] text-faint">
            {unfiltered
              ? "Todavía no hay solicitudes de crédito."
              : "Ninguna solicitud coincide con este filtro o búsqueda."}
          </p>
        ) : (
          <div className={`plf-results-in transition-opacity ${isStale ? "opacity-60" : ""}`}>
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
                        title={request.clientName}
                        className="block max-w-[170px] truncate"
                      >
                        {request.clientName}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-[12.5px] text-brand-gray">
                      {staffLabel(request.requestedByStaffId, request.requestedByName)}
                    </Td>
                    <Td className="whitespace-nowrap text-[12.5px] tabular-nums text-brand-gray">
                      {formatDay(request.requestedAt.slice(0, 10))}
                    </Td>
                    {/* Pastilla y resolucion EN LINEA, y la resolucion truncada.
                        Apiladas, la columna pedia 317 px —la mas ancha de la
                        tabla, por un dato secundario— y empujaba el listado 86 px
                        fuera del panel; ademas dejaba las filas resueltas 20 px
                        mas altas que las pendientes. */}
                    <Td>
                      <span className="flex items-center gap-2">
                        <CreditStatusBadge status={request.status} />
                        {request.decidedAt && (
                          <span
                            className="whitespace-nowrap text-[11.5px] tabular-nums text-faint"
                            title={`${staffLabel(request.decidedByStaffId, request.decidedByName)} · ${formatInstant(request.decidedAt)}`}
                          >
                            {formatDay(request.decidedAt.slice(0, 10))}
                          </span>
                        )}
                      </span>
                    </Td>
                    {/* `nowrap`: con la columna estrujada, «Sin ticket» partia en
                        dos lineas y esos 36 px marcaban la altura de la fila entera. */}
                    <Td className="whitespace-nowrap">
                      <TicketLink number={request.ticketNumber} />
                    </Td>
                    <Td>
                      <div className="flex h-7 items-center justify-end gap-1">
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
                        ) : request.status === "Aprobada" && canApply ? (
                          <RowAction
                            label={`Marcar ${request.number} como aplicada`}
                            icon={BadgeCheck}
                            onClick={() => setApplying(request)}
                          />
                        ) : (
                          // Una raya sola no dice nada. La rama hermana explica
                          // su propio bloqueo con un Tooltip; esta tambien.
                          <Tooltip content={inactionReason(request.status, canApply)}>
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
          </div>
        )}
      </ListPanel>

      {creating && (
        <CreditRequestModal
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
          requesterName={staffLabel(
            deciding.request.requestedByStaffId,
            deciding.request.requestedByName,
          )}
          clientName={deciding.request.clientName}
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
              de {applying.clientName} como aplicada. Hazlo solo cuando ya
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
