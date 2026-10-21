import { Building2, Plus, Tag, UserCheck } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { withdrawalsApi, type WithdrawalCounts, type WithdrawalListResponse, type WithdrawalQuery } from "../../api/withdrawals";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { DataTable, HeadRow, Row, Td, Th, type SortDir } from "../../components/ui/DataTable";
import {
  ClearFiltersButton,
  DateRangeFilterDropdown,
  FilterDropdown,
  LookupFilterDropdown,
} from "../../components/ui/FilterDropdown";
import { HeaderTag } from "../../components/ui/HeaderTag";
import { ListPanel } from "../../components/ui/ListPanel";
import { Pagination } from "../../components/ui/Pagination";
import { SearchInput } from "../../components/ui/SearchInput";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import { resolveClientLabel, resolveStaffLabel, searchClients, searchStaff } from "../../lib/lookups";
import { formatAmount, formatDay } from "../../lib/quality";
import { WITHDRAWAL_REASONS, type WithdrawalStatus } from "../../types/withdrawals";
import { WithdrawalFormModal } from "./WithdrawalFormModal";
import { WithdrawalStatusBadge } from "./WithdrawalStatusBadge";

type ChipKey = "todas" | WithdrawalStatus;
type SortKey = "fecha" | "numero" | "cliente" | "valor";

const CHIPS: { key: ChipKey; label: string; status?: string; countKey: keyof WithdrawalCounts }[] = [
  { key: "todas", label: "Todas", countKey: "all" },
  { key: "Solicitado", label: "Solicitadas", status: "Solicitado", countKey: "requested" },
  { key: "Aprobado", label: "Aprobadas", status: "Aprobado", countKey: "approved" },
  { key: "Retirado", label: "Retiradas", status: "Retirado", countKey: "withdrawn" },
  { key: "Rechazado", label: "Rechazadas", status: "Rechazado", countKey: "rejected" },
  { key: "Cancelado", label: "Canceladas", status: "Cancelado", countKey: "cancelled" },
];

const REASON_OPTIONS = [{ value: "", label: "Todos los motivos" }, ...WITHDRAWAL_REASONS.map((value) => ({ value, label: value }))];

/** Vendedores en el filtro: activos e inactivos, porque una solicitud vieja puede ser de alguien que ya no está. */
const searchSellers = searchStaff();

/**
 * RF-W6: listado paginado con pastillas por estado y filtros por cliente,
 * vendedor, motivo y fechas. Es también el punto de alta mientras la
 * integración con el alta del ticket (RF-W1, docs/plan/02) siga diferida.
 */
export function WithdrawalsPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canWrite = can("withdrawals.write");

  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [reason, setReason] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [chip, setChip] = useState<ChipKey>("todas");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "fecha", dir: "desc" });
  const [pageSize, setPageSize] = useState(10);
  const [creating, setCreating] = useState(false);

  const debouncedSearch = useDebouncedValue(search).trim();

  const criteria: Omit<WithdrawalQuery, "page"> = {
    pageSize,
    search: debouncedSearch || undefined,
    clientId: clientId === "" ? undefined : Number(clientId),
    requestedByStaffId: sellerId === "" ? undefined : Number(sellerId),
    reason: reason || undefined,
    from: from || undefined,
    to: to || undefined,
    status: CHIPS.find((c) => c.key === chip)?.status,
    sort: sort.key,
    dir: sort.dir,
  };

  const { data, isStale, error, setPage, refresh } = usePagedList<WithdrawalQuery, WithdrawalListResponse>({
    fetch: withdrawalsApi.list,
    criteria,
    fallbackError: "No se pudieron cargar las solicitudes de retiro. Vuelve a intentarlo.",
  });

  const rows = data?.items ?? [];
  const counts = data?.counts;
  const filtrosPuestos = [clientId, sellerId, reason, from, to].filter((value) => value !== "").length;
  const unfiltered = chip === "todas" && filtrosPuestos === 0 && !debouncedSearch;

  function clearNarrowFilters() {
    setClientId("");
    setSellerId("");
    setReason("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  function toggleSort(key: SortKey) {
    setSort((current) => (current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  const sortOf = (key: SortKey) => ({ dir: sort.key === key ? sort.dir : null, onToggle: () => toggleSort(key) });

  return (
    <div>
      <ModuleHeader
        title="Retiros"
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
                title="Mostrar todas las solicitudes de retiro"
              />
              <span aria-hidden className="text-zinc-300">·</span>
              <HeaderTag
                label={counts.requested === 1 ? "solicitada" : "solicitadas"}
                count={counts.requested}
                active={chip === "Solicitado"}
                onClick={() => {
                  setChip("Solicitado");
                  setPage(1);
                }}
                tone="amber"
                dot
                title="Filtrar por solicitudes pendientes"
              />
              <span aria-hidden className="text-zinc-300">·</span>
              <HeaderTag
                label={counts.approved === 1 ? "aprobada" : "aprobadas"}
                count={counts.approved}
                active={chip === "Aprobado"}
                onClick={() => {
                  setChip("Aprobado");
                  setPage(1);
                }}
                tone="emerald"
                dot
                title="Filtrar por solicitudes aprobadas"
              />
              <span aria-hidden className="text-zinc-300">·</span>
              <HeaderTag
                label={counts.withdrawn === 1 ? "retirada" : "retiradas"}
                count={counts.withdrawn}
                active={chip === "Retirado"}
                onClick={() => {
                  setChip("Retirado");
                  setPage(1);
                }}
                tone="blue"
                dot
                title="Filtrar por mercancía retirada"
              />
              <span aria-hidden className="text-zinc-300">·</span>
              <HeaderTag
                label={counts.rejected === 1 ? "rechazada" : "rechazadas"}
                count={counts.rejected}
                active={chip === "Rechazado"}
                onClick={() => {
                  setChip("Rechazado");
                  setPage(1);
                }}
                tone="red"
                dot
                title="Filtrar por solicitudes rechazadas"
              />
              <span aria-hidden className="text-zinc-300">·</span>
              <HeaderTag
                label={counts.cancelled === 1 ? "cancelada" : "canceladas"}
                count={counts.cancelled}
                active={chip === "Cancelado"}
                onClick={() => {
                  setChip("Cancelado");
                  setPage(1);
                }}
                tone="neutral"
                title="Filtrar por solicitudes canceladas"
              />
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-300" />
              Cargando las solicitudes de retiro de mercancía…
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
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Número, ticket, cliente o producto…"
              className="w-[300px]"
            />

            <LookupFilterDropdown
              title="Seleccionar cliente"
              aria-label="Filtrar por cliente"
              placeholder="Todos los clientes"
              searchPlaceholder="Buscar cliente…"
              defaultIcon={<Building2 className="h-3.5 w-3.5 text-zinc-500" />}
              value={clientId}
              onChange={setClientId}
              search={searchClients}
              resolveSelectedLabel={resolveClientLabel}
            />

            <LookupFilterDropdown
              title="Seleccionar vendedor"
              aria-label="Filtrar por vendedor"
              placeholder="Todos los vendedores"
              searchPlaceholder="Buscar colaborador…"
              defaultIcon={<UserCheck className="h-3.5 w-3.5 text-zinc-500" />}
              value={sellerId}
              onChange={setSellerId}
              search={searchSellers}
              resolveSelectedLabel={resolveStaffLabel}
            />

            <FilterDropdown
              title="Seleccionar motivo"
              aria-label="Filtrar por motivo"
              value={reason}
              onChange={setReason}
              defaultIcon={<Tag className="h-3.5 w-3.5 text-zinc-500" />}
              options={REASON_OPTIONS}
            />

            <DateRangeFilterDropdown
              from={from}
              to={to}
              onFromChange={setFrom}
              onToChange={setTo}
              aria-label="Filtrar por fecha"
            />

            {(search || filtrosPuestos > 0) && (
              <ClearFiltersButton
                onClick={() => {
                  setSearch("");
                  clearNarrowFilters();
                }}
              />
            )}
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
              nounSingular="solicitud"
            />
          )
        }
      >
        {data === null ? (
          error === null && <TableSkeleton rows={pageSize} columns={7} />
        ) : rows.length === 0 ? (
          <p className="py-14 text-center text-[13.5px] text-faint">
            {unfiltered ? "Todavía no hay solicitudes de retiro registradas." : "Ninguna solicitud coincide con este filtro o búsqueda."}
          </p>
        ) : (
          <div className={`plf-results-in transition-opacity ${isStale ? "opacity-60" : ""}`}>
            <DataTable>
              <thead>
                <HeadRow>
                  <Th sort={sortOf("numero")}>Número</Th>
                  <Th sort={sortOf("cliente")}>Cliente</Th>
                  <Th sort={sortOf("fecha")}>Fecha</Th>
                  <Th>Motivo</Th>
                  <Th>Vendedor</Th>
                  <Th sort={sortOf("valor")} className="text-right">
                    Valor
                  </Th>
                  <Th>Estado</Th>
                </HeadRow>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <Row key={item.id} className="cursor-pointer" onClick={() => navigate(`/retiros/${item.id}`)}>
                    <Td>
                      <Link
                        to={`/retiros/${item.id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="whitespace-nowrap font-mono text-[12px] font-medium text-ink hover:text-brand-red"
                      >
                        {item.number}
                      </Link>
                      <span className="block font-mono text-[11px] text-faint">{item.ticketNumber}</span>
                    </Td>
                    <Td className="text-[12.5px] text-brand-gray">
                      <span title={item.clientName} className="block max-w-[200px] truncate">
                        {item.clientName}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-[12.5px] tabular-nums text-brand-gray">{formatDay(item.requestDate)}</Td>
                    <Td className="whitespace-nowrap text-[12.5px] text-brand-gray">
                      {item.reason}
                      {item.errorOrigin && <span className="block text-[11.5px] text-faint">Error de {item.errorOrigin.toLowerCase()}</span>}
                    </Td>
                    <Td className="whitespace-nowrap text-[12.5px] text-brand-gray">{item.requestedByName}</Td>
                    <Td className="whitespace-nowrap text-right text-[12.5px] tabular-nums text-ink">
                      {item.currency ? formatAmount(item.totalValue, item.currency) : <span className="text-faint">—</span>}
                    </Td>
                    <Td>
                      <WithdrawalStatusBadge status={item.status} />
                    </Td>
                  </Row>
                ))}
              </tbody>
            </DataTable>
          </div>
        )}
      </ListPanel>

      {creating && (
        <WithdrawalFormModal
          onClose={() => setCreating(false)}
          onSaved={(detail) => {
            setCreating(false);
            navigate(`/retiros/${detail.withdrawal.id}`);
          }}
        />
      )}
    </div>
  );
}
