import { Building2, Eye, FileSpreadsheet, FileText, ShieldAlert, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { discrepanciesApi, type DiscrepancyListResponse, type DiscrepancyQuery } from "../../api/discrepancies";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { ErrorRetry } from "../../components/ui/ErrorRetry";
import {
  ClearFiltersButton,
  DateRangeFilterDropdown,
  InputFilterDropdown,
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
import { exportDiscrepanciesListToExcel, exportDiscrepanciesListToPdf } from "../../lib/discrepancyListExport";
import { formatDay } from "../../lib/dates";
import { resolveClientLabel, searchClients } from "../../lib/lookups";
import type { DiscrepancyStatus, DiscrepancySummary } from "../../types/discrepancies";
import { DiscrepancyStatusBadge } from "./DiscrepancyStatusBadge";
import { DiscrepancySummaryDrawer } from "./DiscrepancySummaryDrawer";

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

/** RF-D9: listado paginado con selección múltiple, exportación y resumen en drawer. */
export function DiscrepanciesPage() {
  const receipts = useReceipts();

  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState("todos");
  const [dispatcher, setDispatcher] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [chip, setChip] = useState<ChipKey>("todas");
  const { sort, sortOf } = useSort<SortKey>("fecha", "desc");
  const [pageSize, setPageSize] = useState(10);
  const [summaryId, setSummaryId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectionCache, setSelectionCache] = useState<Map<number, DiscrepancySummary>>(() => new Map());

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

  const rows = useMemo(() => data?.items ?? [], [data?.items]);
  const counts = data?.counts;
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

  const selectedItems = useMemo(
    () =>
      Array.from(selectedIds)
        .map((id) => selectionCache.get(id))
        .filter((item): item is DiscrepancySummary => item !== undefined),
    [selectedIds, selectionCache],
  );

  const filtrosPuestos = (clientId !== "todos" ? 1 : 0) + (dispatcher !== "" ? 1 : 0) + (from !== "" ? 1 : 0) + (to !== "" ? 1 : 0);
  const unfiltered = chip === "todas" && filtrosPuestos === 0 && !debouncedSearch;

  function clearNarrowFilters() {
    setClientId("todos");
    setDispatcher("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  async function handleBulkExportExcel() {
    if (selectedItems.length === 0) return;
    try {
      setBulkBusy(true);
      await exportDiscrepanciesListToExcel(selectedItems);
      const count = selectedItems.length;
      receipts.done({
        action: "exportar-discrepancias-excel",
        title: "Excel descargado",
        detail: `${count} ${count === 1 ? "investigación en el archivo" : "investigaciones en el archivo"}`,
      });
    } catch {
      receipts.failed({ action: "exportar-discrepancias-excel", title: "No se pudo generar el Excel" });
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleBulkExportPdf() {
    if (selectedItems.length === 0) return;
    try {
      setBulkBusy(true);
      await exportDiscrepanciesListToPdf(selectedItems);
      const count = selectedItems.length;
      receipts.done({
        action: "exportar-discrepancias-pdf",
        title: "PDF descargado",
        detail: `${count} ${count === 1 ? "investigación en el archivo" : "investigaciones en el archivo"}`,
      });
    } catch {
      receipts.failed({ action: "exportar-discrepancias-pdf", title: "No se pudo generar el PDF" });
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
              noun="investigaciones"
              nounSingular="investigación"
            />
          )
        }
      >
        {data === null ? (
          error === null && <TableSkeleton rows={pageSize} columns={9} />
        ) : rows.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-[13.5px] text-faint">
              {unfiltered ? "Todavía no hay investigaciones registradas." : "Ninguna investigación coincide con este filtro o búsqueda."}
            </p>
            {unfiltered && (
              <p className="mx-auto mt-1.5 max-w-md text-[12.5px] text-faint">
                Se registran desde el ticket: abre el ticket y entra a la pestaña «Discrepancia de carga».
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
                  <Th sort={sortOf("numero")}>Número</Th>
                  <Th sort={sortOf("ticket")}>Ticket</Th>
                  <Th sort={sortOf("cliente")}>Cliente</Th>
                  <Th sort={sortOf("fecha")}>Fecha</Th>
                  <Th>Despachador</Th>
                  <Th>Seguridad</Th>
                  <Th>Estado</Th>
                  <Th className="w-24 text-right">Acciones</Th>
                </HeadRow>
              </thead>
              <tbody>
                {rows.map((item) => {
                  const isChecked = selectedIds.has(item.id);
                  return (
                    <Row
                      key={item.id}
                      className={`cursor-pointer ${isChecked ? "bg-brand-red/[0.03]" : ""}`}
                      onClick={() => setSummaryId(item.id)}
                    >
                      <Td className="w-9 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <SelectBox
                          checked={isChecked}
                          label={`Seleccionar investigación ${item.number}`}
                          onToggle={() => toggleSelect(item.id)}
                        />
                      </Td>
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
                      <Td className="whitespace-nowrap text-[12.5px] tabular-nums text-brand-gray">
                        {formatDay(item.createdAt.slice(0, 10))}
                      </Td>
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
                      <Td>
                        <div className="flex h-7 items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                          <RowAction
                            label={`Ver resumen de ${item.number}`}
                            icon={Eye}
                            onClick={() => setSummaryId(item.id)}
                          />
                          <RowAction
                            label={`Imprimir ${item.number}`}
                            icon={FileText}
                            onClick={() => window.open(`/discrepancias/${item.id}/imprimir`, "_blank")}
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

      {summaryId !== null && (
        <DiscrepancySummaryDrawer discrepancyId={summaryId} onClose={() => setSummaryId(null)} />
      )}
    </div>
  );
}
