import { ClipboardList, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { claimsApi, type ClaimListResponse, type ClaimQuery } from "../../api/claims";
import { fetchAllPages } from "../../api/paging";
import { settingsApi } from "../../api/settings";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { ControlInput } from "../../components/ui/ControlInput";
import { CriteriaField, CriteriaLookup, CriteriaSelect } from "../../components/ui/CriteriaField";
import { DataTable, HeadRow, Row, Td, Th, type SortDir } from "../../components/ui/DataTable";
import { HeaderTag } from "../../components/ui/HeaderTag";
import { FilterPopover } from "../../components/ui/FilterPopover";
import { ListPanel } from "../../components/ui/ListPanel";
import { Pagination } from "../../components/ui/Pagination";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { Tooltip } from "../../components/ui/Tooltip";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { resolveClientLabel, searchClients } from "../../lib/lookups";
import { formatAmount, formatDay } from "../../lib/quality";
import { CLAIM_REASONS, type ClaimStatus } from "../../types/claims";
import type { Plant } from "../../types/settings";
import { ClaimStatusBadge } from "./ClaimStatusBadge";

type ChipKey = "todas" | ClaimStatus;
type SortKey = "fecha" | "cliente" | "total" | "ticket";

const CHIPS: { key: ChipKey; label: string; status?: string; countKey: "all" | "registered" | "inTreatment" | "closed" }[] = [
  { key: "todas", label: "Todas", countKey: "all" },
  { key: "Registrada", label: "Registradas", status: "Registrada", countKey: "registered" },
  { key: "En tratamiento", label: "En tratamiento", status: "En tratamiento", countKey: "inTreatment" },
  { key: "Cerrada", label: "Cerradas", status: "Cerrada", countKey: "closed" },
];

/**
 * RF-R8: listado paginado de reclamaciones con pastillas por estado y filtros
 * por motivo, planta, cliente y rango de fechas. No hay «Nueva reclamación»
 * aquí a propósito: una reclamación nace de su ticket (RF-R1), desde la
 * pestaña «Reclamación» del detalle del ticket.
 */
export function ClaimsPage() {
  const navigate = useNavigate();
  const [plants, setPlants] = useState<Plant[]>([]);

  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("todos");
  const [plantId, setPlantId] = useState("todas");
  const [clientId, setClientId] = useState("todos");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [chip, setChip] = useState<ChipKey>("todas");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "fecha", dir: "desc" });
  const [pageSize, setPageSize] = useState(10);

  const debouncedSearch = useDebouncedValue(search).trim();

  // Las plantas son catálogo acotado: se recorren enteras para el filtro.
  useEffect(() => {
    fetchAllPages<Plant>((page, size) => settingsApi.plants.list({ page, pageSize: size }))
      .then(setPlants)
      .catch(() => setPlants([]));
  }, []);

  const criteria: Omit<ClaimQuery, "page"> = {
    pageSize,
    search: debouncedSearch || undefined,
    reason: reason === "todos" ? undefined : reason,
    plantId: plantId === "todas" ? undefined : Number(plantId),
    clientId: clientId === "todos" ? undefined : Number(clientId),
    from: from || undefined,
    to: to || undefined,
    status: CHIPS.find((c) => c.key === chip)?.status,
    sort: sort.key,
    dir: sort.dir,
  };

  const { data, isStale, error, setPage, refresh } = usePagedList<ClaimQuery, ClaimListResponse>({
    fetch: claimsApi.list,
    criteria,
    fallbackError: "No se pudieron cargar las reclamaciones. Vuelve a intentarlo.",
  });

  const rows = data?.items ?? [];
  const counts = data?.counts;

  const filtrosPuestos =
    (reason !== "todos" ? 1 : 0) +
    (plantId !== "todas" ? 1 : 0) +
    (clientId !== "todos" ? 1 : 0) +
    (from !== "" ? 1 : 0) +
    (to !== "" ? 1 : 0);

  function clearNarrowFilters() {
    setReason("todos");
    setPlantId("todas");
    setClientId("todos");
    setFrom("");
    setTo("");
    setPage(1);
  }

  function toggleSort(key: SortKey) {
    setSort((current) =>
      current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  const sortOf = (key: SortKey) => ({ dir: sort.key === key ? sort.dir : null, onToggle: () => toggleSort(key) });

  const unfiltered = chip === "todas" && filtrosPuestos === 0 && !debouncedSearch;

  return (
    <div>
      <ModuleHeader
        title="Reclamaciones"
        summary={
          counts ? (
            <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
              <HeaderTag
                label={counts.all === 1 ? "reclamación" : "reclamaciones"}
                count={counts.all}
                active={chip === "todas"}
                onClick={() => {
                  setChip("todas");
                  setPage(1);
                }}
                tone="neutral"
                title="Mostrar todas las reclamaciones"
              />
              <span aria-hidden className="text-zinc-300">·</span>
              <HeaderTag
                label={counts.registered === 1 ? "registrada" : "registradas"}
                count={counts.registered}
                active={chip === "Registrada"}
                onClick={() => {
                  setChip("Registrada");
                  setPage(1);
                }}
                tone="blue"
                dot
                title="Filtrar por reclamaciones registradas"
              />
              <span aria-hidden className="text-zinc-300">·</span>
              <HeaderTag
                label="en tratamiento"
                count={counts.inTreatment}
                active={chip === "En tratamiento"}
                onClick={() => {
                  setChip("En tratamiento");
                  setPage(1);
                }}
                tone="amber"
                dot
                title="Filtrar por reclamaciones en tratamiento"
              />
              <span aria-hidden className="text-zinc-300">·</span>
              <HeaderTag
                label={counts.closed === 1 ? "cerrada" : "cerradas"}
                count={counts.closed}
                active={chip === "Cerrada"}
                onClick={() => {
                  setChip("Cerrada");
                  setPage(1);
                }}
                tone="emerald"
                dot
                title="Filtrar por reclamaciones cerradas"
              />
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-300" />
              Cargando las reclamaciones de clientes…
            </span>
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
              placeholder="Ticket, cliente, factura, PO o producto…"
              className="w-[280px]"
            />

            <FilterPopover count={filtrosPuestos} onClear={clearNarrowFilters}>
              <CriteriaSelect
                label="Motivo"
                ariaLabel="Filtrar por motivo del reclamo"
                value={reason}
                onChange={setReason}
                options={[
                  { value: "todos", label: "Todos los motivos" },
                  ...CLAIM_REASONS.map((value) => ({ value, label: value })),
                ]}
              />
              <CriteriaSelect
                label="Planta"
                ariaLabel="Filtrar por planta involucrada"
                value={plantId}
                onChange={setPlantId}
                options={[
                  { value: "todas", label: "Todas las plantas" },
                  ...plants.map((plant) => ({ value: String(plant.id), label: plant.name })),
                ]}
              />
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
              <CriteriaField label="Desde" htmlFor="reclamacion-desde">
                <ControlInput
                  id="reclamacion-desde"
                  type="date"
                  className="w-[150px]"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                />
              </CriteriaField>
              <CriteriaField label="Hasta" htmlFor="reclamacion-hasta">
                <ControlInput
                  id="reclamacion-hasta"
                  type="date"
                  className="w-[150px]"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
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
              noun="reclamaciones"
              nounSingular="reclamación"
            />
          )
        }
      >
        {data === null ? (
          error === null && <TableSkeleton rows={pageSize} columns={7} />
        ) : rows.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-[13.5px] text-faint">
              {unfiltered
                ? "Todavía no hay reclamaciones registradas."
                : "Ninguna reclamación coincide con este filtro o búsqueda."}
            </p>
            {unfiltered && (
              <p className="mx-auto mt-1.5 max-w-md text-[12.5px] text-faint">
                Se registran desde el ticket: abre el ticket de la reclamación y entra a su pestaña «Reclamación».
              </p>
            )}
          </div>
        ) : (
          <div className={`plf-results-in transition-opacity ${isStale ? "opacity-60" : ""}`}>
            <DataTable>
              <thead>
                <HeadRow>
                  <Th sort={sortOf("ticket")}>Ticket</Th>
                  <Th sort={sortOf("cliente")}>Cliente</Th>
                  <Th sort={sortOf("fecha")}>Fecha</Th>
                  <Th>Motivo</Th>
                  <Th>Plantas</Th>
                  <Th className="text-right" sort={sortOf("total")}>
                    Total
                  </Th>
                  <Th>Estado</Th>
                  <Th className="w-20 text-right">Acciones</Th>
                </HeadRow>
              </thead>
              <tbody>
                {rows.map((claim) => (
                  <Row
                    key={claim.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/reclamaciones/${claim.id}`)}
                  >
                    <Td>
                      <Link
                        to={`/reclamaciones/${claim.id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="whitespace-nowrap font-mono text-[12px] font-medium text-ink hover:text-brand-red"
                      >
                        {claim.ticketNumber}
                      </Link>
                    </Td>
                    <Td className="text-[12.5px] text-brand-gray">
                      <span title={claim.clientName} className="block max-w-[200px] truncate">
                        {claim.clientName}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-[12.5px] tabular-nums text-brand-gray">
                      {formatDay(claim.claimDate)}
                    </Td>
                    <Td className="text-[12.5px] text-brand-gray">
                      {claim.reason === "Otros" && claim.reasonOther ? (
                        <span title={claim.reasonOther}>Otros · {claim.reasonOther}</span>
                      ) : (
                        claim.reason
                      )}
                    </Td>
                    <Td className="text-[12.5px] text-brand-gray">
                      <span title={claim.plants.join(", ")} className="block max-w-[180px] truncate">
                        {claim.plants.join(", ") || "—"}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-right text-[12.5px] font-medium tabular-nums text-ink">
                      {claim.currency ? formatAmount(claim.totalAmount, claim.currency) : "—"}
                    </Td>
                    <Td>
                      <span className="flex items-center gap-2">
                        <ClaimStatusBadge status={claim.status} />
                        {claim.hasHca && (
                          <Tooltip content="Tiene una HCA ligada al ticket">
                            <ClipboardList aria-hidden className="h-3.5 w-3.5 text-faint" />
                          </Tooltip>
                        )}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex h-7 items-center justify-end" onClick={(event) => event.stopPropagation()}>
                        <RowAction
                          label={`Imprimir la reclamación de ${claim.ticketNumber}`}
                          icon={FileText}
                          onClick={() => window.open(`/reclamaciones/${claim.id}/imprimir`, "_blank")}
                        />
                      </div>
                    </Td>
                  </Row>
                ))}
              </tbody>
            </DataTable>
          </div>
        )}
      </ListPanel>
    </div>
  );
}
