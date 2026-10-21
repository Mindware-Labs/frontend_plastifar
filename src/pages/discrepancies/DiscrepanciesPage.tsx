import { Building2, Plus, ShieldAlert, Truck } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { discrepanciesApi, type DiscrepancyListResponse, type DiscrepancyQuery } from "../../api/discrepancies";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { DataTable, HeadRow, Row, Td, Th, type SortDir } from "../../components/ui/DataTable";
import {
  ClearFiltersButton,
  DateRangeFilterDropdown,
  InputFilterDropdown,
  LookupFilterDropdown,
} from "../../components/ui/FilterDropdown";
import { HeaderTag } from "../../components/ui/HeaderTag";
import { ListPanel } from "../../components/ui/ListPanel";
import { Pagination } from "../../components/ui/Pagination";
import { SearchInput } from "../../components/ui/SearchInput";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { Tooltip } from "../../components/ui/Tooltip";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import { resolveClientLabel, searchClients } from "../../lib/lookups";
import { formatDay } from "../../lib/quality";
import type { DiscrepancyStatus } from "../../types/discrepancies";
import { DiscrepancyFormModal } from "./DiscrepancyFormModal";
import { DiscrepancyStatusBadge } from "./DiscrepancyStatusBadge";

type ChipKey = "todas" | DiscrepancyStatus | "hallazgo";
type SortKey = "fecha" | "numero" | "ticket" | "cliente";

const CHIPS: { key: ChipKey; label: string; status?: string; countKey: "all" | "investigating" | "completed" | "approved" | "returned" | "withFinding" }[] = [
  { key: "todas", label: "Todas", countKey: "all" },
  { key: "En investigación", label: "En investigación", status: "En investigación", countKey: "investigating" },
  { key: "Completada", label: "Completadas", status: "Completada", countKey: "completed" },
  { key: "Aprobada", label: "Aprobadas", status: "Aprobada", countKey: "approved" },
  { key: "Devuelta", label: "Devueltas", status: "Devuelta", countKey: "returned" },
  { key: "hallazgo", label: "Con hallazgo de seguridad", status: "hallazgo", countKey: "withFinding" },
];

/** RF-D9: listado paginado con pastillas por estado y «Con hallazgo de seguridad». */
export function DiscrepanciesPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canWrite = can("discrepancies.write");

  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState("todos");
  const [dispatcher, setDispatcher] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [chip, setChip] = useState<ChipKey>("todas");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "fecha", dir: "desc" });
  const [pageSize, setPageSize] = useState(10);
  const [creating, setCreating] = useState(false);

  const debouncedSearch = useDebouncedValue(search).trim();
  const debouncedDispatcher = useDebouncedValue(dispatcher).trim();

  const criteria: Omit<DiscrepancyQuery, "page"> = {
    pageSize,
    search: debouncedSearch || undefined,
    clientId: clientId === "todos" ? undefined : Number(clientId),
    dispatcher: debouncedDispatcher || undefined,
    from: from || undefined,
    to: to || undefined,
    status: CHIPS.find((c) => c.key === chip)?.status,
    sort: sort.key,
    dir: sort.dir,
  };

  const { data, isStale, error, setPage, refresh } = usePagedList<DiscrepancyQuery, DiscrepancyListResponse>({
    fetch: discrepanciesApi.list,
    criteria,
    fallbackError: "No se pudieron cargar las investigaciones. Vuelve a intentarlo.",
  });

  const rows = data?.items ?? [];
  const counts = data?.counts;
  const filtrosPuestos = (clientId !== "todos" ? 1 : 0) + (dispatcher !== "" ? 1 : 0) + (from !== "" ? 1 : 0) + (to !== "" ? 1 : 0);
  const unfiltered = chip === "todas" && filtrosPuestos === 0 && !debouncedSearch;

  function clearNarrowFilters() {
    setClientId("todos");
    setDispatcher("");
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
        title="Discrepancias"
        summary={
          counts ? (
            <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
              <HeaderTag
                label={counts.all === 1 ? "investigación" : "investigaciones"}
                count={counts.all}
                active={chip === "todas"}
                onClick={() => {
                  setChip("todas");
                  setPage(1);
                }}
                tone="neutral"
                title="Mostrar todas las investigaciones de discrepancia"
              />
              <span aria-hidden className="text-zinc-300">·</span>
              <HeaderTag
                label="en investigación"
                count={counts.investigating}
                active={chip === "En investigación"}
                onClick={() => {
                  setChip("En investigación");
                  setPage(1);
                }}
                tone="amber"
                dot
                title="Filtrar por investigaciones en curso"
              />
              <span aria-hidden className="text-zinc-300">·</span>
              <HeaderTag
                label={counts.completed === 1 ? "completada" : "completadas"}
                count={counts.completed}
                active={chip === "Completada"}
                onClick={() => {
                  setChip("Completada");
                  setPage(1);
                }}
                tone="blue"
                dot
                title="Filtrar por investigaciones completadas"
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
                title="Filtrar por investigaciones aprobadas"
              />
              <span aria-hidden className="text-zinc-300">·</span>
              <HeaderTag
                label={counts.returned === 1 ? "devuelta" : "devueltas"}
                count={counts.returned}
                active={chip === "Devuelta"}
                onClick={() => {
                  setChip("Devuelta");
                  setPage(1);
                }}
                tone="red"
                dot
                title="Filtrar por investigaciones devueltas"
              />
              <span aria-hidden className="text-zinc-300">·</span>
              <HeaderTag
                label="hallazgo de seguridad"
                count={counts.withFinding}
                active={chip === "hallazgo"}
                onClick={() => {
                  setChip("hallazgo");
                  setPage(1);
                }}
                tone="red"
                dot
                title="Filtrar por discrepancias con hallazgo de seguridad"
              />
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-300" />
              Cargando las investigaciones de discrepancia…
            </span>
          )
        }
        action={
          canWrite && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-[15px] w-[15px]" />
              Nueva investigación
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
              placeholder="Número, ticket, cliente, factura, despachador o producto…"
              className="w-[300px]"
            />

            <LookupFilterDropdown
              title="Seleccionar cliente"
              aria-label="Filtrar por cliente"
              placeholder="Todos los clientes"
              searchPlaceholder="Buscar cliente…"
              defaultIcon={<Building2 className="h-3.5 w-3.5 text-zinc-500" />}
              value={clientId === "todos" ? "" : clientId}
              onChange={(value) => setClientId(value === "" ? "todos" : value)}
              search={searchClients}
              resolveSelectedLabel={resolveClientLabel}
            />

            <InputFilterDropdown
              title="Filtrar por despachador"
              aria-label="Filtrar por despachador"
              placeholder="Todos los despachadores"
              inputPlaceholder="Nombre del despachador…"
              defaultIcon={<Truck className="h-3.5 w-3.5 text-zinc-500" />}
              value={dispatcher}
              onChange={setDispatcher}
              formatActiveLabel={(val) => `Despachador: ${val}`}
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
              noun="investigaciones"
              nounSingular="investigación"
            />
          )
        }
      >
        {data === null ? (
          error === null && <TableSkeleton rows={pageSize} columns={7} />
        ) : rows.length === 0 ? (
          <p className="py-14 text-center text-[13.5px] text-faint">
            {unfiltered ? "Todavía no hay investigaciones registradas." : "Ninguna investigación coincide con este filtro o búsqueda."}
          </p>
        ) : (
          <div className={`plf-results-in transition-opacity ${isStale ? "opacity-60" : ""}`}>
            <DataTable>
              <thead>
                <HeadRow>
                  <Th sort={sortOf("numero")}>Número</Th>
                  <Th sort={sortOf("ticket")}>Ticket</Th>
                  <Th sort={sortOf("cliente")}>Cliente</Th>
                  <Th sort={sortOf("fecha")}>Fecha</Th>
                  <Th>Despachador</Th>
                  <Th>Seguridad</Th>
                  <Th>Estado</Th>
                </HeadRow>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <Row key={item.id} className="cursor-pointer" onClick={() => navigate(`/discrepancias/${item.id}`)}>
                    <Td>
                      <Link
                        to={`/discrepancias/${item.id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="whitespace-nowrap font-mono text-[12px] font-medium text-ink hover:text-brand-red"
                      >
                        {item.number}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap font-mono text-[12px] text-brand-gray">{item.ticketNumber}</Td>
                    <Td className="text-[12.5px] text-brand-gray">
                      <span title={item.clientName ?? undefined} className="block max-w-[200px] truncate">
                        {item.clientName ?? "—"}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-[12.5px] tabular-nums text-brand-gray">{formatDay(item.createdAt.slice(0, 10))}</Td>
                    <Td className="text-[12.5px] text-brand-gray">
                      <span title={item.dispatchers.join(", ")} className="block max-w-[180px] truncate">
                        {item.dispatchers.join(", ") || "—"}
                      </span>
                    </Td>
                    <Td>
                      {item.hasSecurityFinding ? (
                        <Tooltip content="Algún punto de seguridad del 1 al 8 es positivo">
                          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-red-dark">
                            <ShieldAlert aria-hidden className="h-3.5 w-3.5" />
                            Hallazgo
                          </span>
                        </Tooltip>
                      ) : (
                        <span className="text-[12px] text-faint">—</span>
                      )}
                    </Td>
                    <Td>
                      <DiscrepancyStatusBadge status={item.status} />
                    </Td>
                  </Row>
                ))}
              </tbody>
            </DataTable>
          </div>
        )}
      </ListPanel>

      {creating && (
        <DiscrepancyFormModal
          onClose={() => setCreating(false)}
          onSaved={(detail) => {
            setCreating(false);
            navigate(`/discrepancias/${detail.discrepancy.id}`);
          }}
        />
      )}
    </div>
  );
}
