import {
  Building2,
  ClipboardList,
  Eye,
  Factory,
  FileSpreadsheet,
  FileText,
  Tag,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { claimsApi, type ClaimListResponse, type ClaimQuery } from "../../api/claims";
import { fetchAllPages } from "../../api/paging";
import { settingsApi } from "../../api/settings";
import { ticketTopicsApi } from "../../api/ticketTopics";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { ErrorRetry } from "../../components/ui/ErrorRetry";
import {
  ClearFiltersButton,
  DateRangeFilterDropdown,
  FilterDropdown,
  LookupFilterDropdown,
} from "../../components/ui/FilterDropdown";
import { HeaderTag } from "../../components/ui/HeaderTag";
import { ListPanel } from "../../components/ui/ListPanel";
import { Pagination } from "../../components/ui/Pagination";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { SelectBox } from "../../components/ui/SelectBox";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { TableSelectionBar, type TableSelectionAction } from "../../components/ui/TableSelectionBar";
import { Tooltip } from "../../components/ui/Tooltip";
import { useReceipts } from "../../context/useReceipts";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { useSort } from "../../hooks/useSort";
import { useTablePageSelection } from "../../hooks/useTablePageSelection";
import { exportClaimsListToExcel, exportClaimsListToPdf } from "../../lib/claimExcelExport";
import { formatDay } from "../../lib/dates";
import { resolveClientLabel, searchClients } from "../../lib/lookups";
import { formatAmount } from "../../lib/numbers";
import type { TicketTopicResponse } from "../../types/api";
import { topicRequiresOther, type ClaimStatus, type ClaimSummary } from "../../types/claims";
import type { Plant } from "../../types/settings";
import { ClaimStatusBadge } from "./ClaimStatusBadge";
import { ClaimSummaryDrawer } from "./ClaimSummaryDrawer";

type ChipKey = "todas" | ClaimStatus;
type SortKey = "fecha" | "cliente" | "total" | "ticket";

const CHIPS: { key: ChipKey; label: string; status?: string; countKey: "all" | "registered" | "inTreatment" | "closed" }[] = [
  { key: "todas", label: "Todas", countKey: "all" },
  { key: "Registrada", label: "Registradas", status: "Registrada", countKey: "registered" },
  { key: "En tratamiento", label: "En tratamiento", status: "En tratamiento", countKey: "inTreatment" },
  { key: "Cerrada", label: "Cerradas", status: "Cerrada", countKey: "closed" },
];

/** RF-R8: listado paginado de reclamaciones con selección múltiple, exportación en común (... */
export function ClaimsPage() {
  const receipts = useReceipts();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [topics, setTopics] = useState<TicketTopicResponse[]>([]);

  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("todos");
  const [plantId, setPlantId] = useState("todas");
  const [clientId, setClientId] = useState("todos");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [chip, setChip] = useState<ChipKey>("todas");
  const { sort, sortOf } = useSort<SortKey>("fecha", "desc");
  const [pageSize, setPageSize] = useState(10);

  // Resumen modal/drawer
  const [summaryClaimId, setSummaryClaimId] = useState<number | null>(null);

  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectionCache, setSelectionCache] = useState<Map<number, ClaimSummary>>(() => new Map());

  const debouncedSearch = useDebouncedValue(search).trim();

  // Las plantas son catálogo acotado: se recorren enteras para el filtro.
  useEffect(() => {
    fetchAllPages<Plant>((page, size) => settingsApi.plants.list({ page, pageSize: size }))
      .then(setPlants)
      .catch(() => setPlants([]));
  }, []);

  useEffect(() => {
    fetchAllPages<TicketTopicResponse>((page, size) =>
      ticketTopicsApi.list({ page, pageSize: size, status: "activos" }),
    )
      .then(setTopics)
      .catch(() => setTopics([]));
  }, []);

  const criteria: Omit<ClaimQuery, "page"> = {
    pageSize,
    search: debouncedSearch || undefined,
    topicId: reason === "todos" ? undefined : Number(reason),
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

  const rows = useMemo(() => data?.items ?? [], [data?.items]);
  const counts = data?.counts;

  // Multi-row selection
  const pageIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const { selectedIds, pageState, togglePage, toggleSelect, clearSelection } = useTablePageSelection(pageIds);

  useEffect(() => {
    setSelectionCache((prev) => {
      const next = new Map(prev);
      for (const id of next.keys()) {
        if (!selectedIds.has(id)) next.delete(id);
      }
      for (const row of rows) {
        if (selectedIds.has(row.id)) next.set(row.id, row);
      }
      return next;
    });
  }, [rows, selectedIds]);

  const selectedClaims = useMemo(
    () =>
      Array.from(selectedIds)
        .map((id) => selectionCache.get(id))
        .filter((claim): claim is ClaimSummary => claim !== undefined),
    [selectedIds, selectionCache],
  );

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

  const unfiltered = chip === "todas" && filtrosPuestos === 0 && !debouncedSearch;

  // Actividades en común (Bulk actions)
  async function handleBulkExportExcel() {
    if (selectedClaims.length === 0) return;
    try {
      setBulkBusy(true);
      await exportClaimsListToExcel(selectedClaims);
      const count = selectedClaims.length;
      receipts.done({
        action: "exportar-reclamaciones-excel",
        title: "Excel descargado",
        detail: `${count} ${count === 1 ? "reclamación en el archivo" : "reclamaciones en el archivo"}`,
      });
    } catch {
      receipts.failed({
        action: "exportar-reclamaciones-excel",
        title: "No se pudo generar el Excel",
      });
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleBulkExportPdf() {
    if (selectedClaims.length === 0) return;
    try {
      setBulkBusy(true);
      await exportClaimsListToPdf(selectedClaims);
      const count = selectedClaims.length;
      receipts.done({
        action: "exportar-reclamaciones-pdf",
        title: "PDF descargado",
        detail: `${count} ${count === 1 ? "reclamación en el archivo" : "reclamaciones en el archivo"}`,
      });
    } catch {
      receipts.failed({
        action: "exportar-reclamaciones-pdf",
        title: "No se pudo generar el PDF",
      });
    } finally {
      setBulkBusy(false);
    }
  }

  const bulkActions: TableSelectionAction[] = [
    {
      key: "excel",
      label: "Exportar Excel",
      icon: <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />,
      onClick: handleBulkExportExcel,
    },
    {
      key: "pdf",
      label: "Exportar PDF",
      icon: <FileText className="h-3.5 w-3.5 text-rose-600" />,
      onClick: handleBulkExportPdf,
    },
  ];

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
        <ErrorRetry className="mb-3" onRetry={refresh}>{error}</ErrorRetry>
      )}

      <ListPanel
        toolbar={
          selectedIds.size > 0 ? (
            <TableSelectionBar
              count={selectedIds.size}
              pageState={pageState}
              busy={bulkBusy}
              onTogglePage={togglePage}
              onClear={clearSelection}
              actions={bulkActions}
            />
          ) : (
            <>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Ticket, cliente, factura, PO o producto…"
                className="w-[280px]"
              />

              <FilterDropdown
                title="Seleccionar motivo"
                aria-label="Filtrar por motivo del reclamo"
                value={reason}
                onChange={setReason}
                defaultIcon={<Tag className="h-3.5 w-3.5 text-zinc-500" />}
                options={[
                  { value: "todos", label: "Todos los motivos" },
                  ...topics.map((topic) => ({ value: String(topic.id), label: topic.name })),
                ]}
              />

              <FilterDropdown
                title="Seleccionar planta"
                aria-label="Filtrar por planta involucrada"
                value={plantId}
                onChange={setPlantId}
                defaultIcon={<Factory className="h-3.5 w-3.5 text-zinc-500" />}
                options={[
                  { value: "todas", label: "Todas las plantas" },
                  ...plants.map((plant) => ({ value: String(plant.id), label: plant.name })),
                ]}
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
          )
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
          error === null && <TableSkeleton rows={pageSize} columns={8} />
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
                  <Th className="w-9 px-2 text-center">
                    <SelectBox
                      checked={pageState}
                      label={pageState === true ? "Quitar selección de la página" : "Seleccionar toda la página"}
                      onToggle={togglePage}
                    />
                  </Th>
                  <Th sort={sortOf("ticket")}>Ticket</Th>
                  <Th sort={sortOf("cliente")}>Cliente</Th>
                  <Th sort={sortOf("fecha")}>Fecha</Th>
                  <Th>Motivo</Th>
                  <Th>Plantas</Th>
                  <Th className="text-right" sort={sortOf("total")}>
                    Total
                  </Th>
                  <Th>Estado</Th>
                  <Th className="w-24 text-right">Acciones</Th>
                </HeadRow>
              </thead>
              <tbody>
                {rows.map((claim) => {
                  const isChecked = selectedIds.has(claim.id);
                  return (
                    <Row
                      key={claim.id}
                      className={`cursor-pointer ${isChecked ? "bg-brand-red/[0.03]" : ""}`}
                      onClick={() => setSummaryClaimId(claim.id)}
                    >
                      <Td className="w-9 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <SelectBox
                          checked={isChecked}
                          label={`Seleccionar reclamación ${claim.ticketNumber}`}
                          onToggle={() => toggleSelect(claim.id)}
                        />
                      </Td>
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
                        {topicRequiresOther(claim.reason) && claim.reasonOther ? (
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
                        <div className="flex h-7 items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                          <RowAction
                            label={`Ver resumen ejecutivo de ${claim.ticketNumber}`}
                            icon={Eye}
                            onClick={() => setSummaryClaimId(claim.id)}
                          />
                          <RowAction
                            label={`Imprimir la reclamación de ${claim.ticketNumber}`}
                            icon={FileText}
                            onClick={() => window.open(`/reclamaciones/${claim.id}/imprimir`, "_blank")}
                          />
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

      {/** Drawer con el Resumen Ejecutivo al hacer clic */}
      {summaryClaimId !== null && (
        <ClaimSummaryDrawer claimId={summaryClaimId} onClose={() => setSummaryClaimId(null)} />
      )}
    </div>
  );
}
