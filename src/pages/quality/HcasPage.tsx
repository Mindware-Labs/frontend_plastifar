import {
  Building2,
  Eye,
  Factory,
  FileSpreadsheet,
  FileText,
  Layers,

  ShieldCheck,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchAllPages } from "../../api/paging";
import { productLinesApi } from "../../api/productLines";
import { qualityApi } from "../../api/quality";
import { settingsApi } from "../../api/settings";
import { ModuleHeader } from "../../components/app/ModuleHeader";

import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { ErrorRetry } from "../../components/ui/ErrorRetry";
import {
  ClearFiltersButton,
  DateRangeFilterDropdown,
  FilterDropdown,
  LookupFilterDropdown,
} from "../../components/ui/FilterDropdown";
import { HeaderTag, type HeaderTagTone } from "../../components/ui/HeaderTag";
import { ListEmptyState } from "../../components/ui/ListEmptyState";
import { ListPanel } from "../../components/ui/ListPanel";
import { Pagination } from "../../components/ui/Pagination";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { SelectBox } from "../../components/ui/SelectBox";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { TableSelectionBar, type TableSelectionAction } from "../../components/ui/TableSelectionBar";
import { useReceipts } from "../../context/useReceipts";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";

import { useSort } from "../../hooks/useSort";
import { useTablePageSelection } from "../../hooks/useTablePageSelection";
import { useEnterpriseListReturnRestore } from "../../hooks/useEnterpriseListReturnRestore";
import { captureListScrollY } from "../../lib/enterpriseListReturn";
import { formatDay } from "../../lib/dates";
import { isHcaOverdue } from "../../lib/quality";
import { exportHcasListToExcel, exportHcasListToPdf } from "../../lib/hcaListExport";
import { resolveClientLabel, searchClients } from "../../lib/lookups";
import type { Plant, ProductLine } from "../../types/settings";
import type {
  CorrectiveActionSheet,
  HcaQuery,
  HcaStatus,
  SheetCounts,
  SheetListResponse,
} from "../../types/quality";

import { HcaStatusBadge } from "./StatusBadges";
import { HcaSummaryDrawer } from "./HcaSummaryDrawer";

type SortKey = "fecha" | "numero" | "cliente";
type ChipKey = "todas" | HcaStatus;

/** Filtro por estado en la cabecera, como en Discrepancias y Retiros. El servidor filtra por `status`. */
const CHIPS: {
  key: ChipKey;
  singular: string;
  plural: string;
  countKey: keyof SheetCounts;
  tone: HeaderTagTone;
}[] = [
  { key: "todas", singular: "HCA", plural: "HCA", countKey: "all", tone: "neutral" },
  { key: "Abierta", singular: "registrada", plural: "registradas", countKey: "open", tone: "blue" },
  { key: "En análisis", singular: "en análisis", plural: "en análisis", countKey: "inAnalysis", tone: "amber" },
  { key: "En ejecución", singular: "en ejecución", plural: "en ejecución", countKey: "inExecution", tone: "amber" },
  { key: "En verificación", singular: "en verificación", plural: "en verificación", countKey: "inVerification", tone: "amber" },
  { key: "Cerrada", singular: "cerrada", plural: "cerradas", countKey: "closed", tone: "emerald" },
];

/**
 * Listado paginado de las HCA, «Hecho, Causa y Acción» (PF-FOR-109).
 * Funciona de manera idéntica al módulo de Discrepancias: se registra el formulario,
 * queda asentado permanentemente en el sistema con su estado completado y se consulta
 * de inmediato desde el drawer o la vista completa.
 */
export function HcasPage() {
  const navigate = useNavigate();
  const receipts = useReceipts();


  const [plants, setPlants] = useState<Plant[]>([]);
  const [productLines, setProductLines] = useState<ProductLine[]>([]);

  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState("todos");
  const [plantId, setPlantId] = useState("todas");
  const [productLineId, setProductLineId] = useState("todas");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [chip, setChip] = useState<ChipKey>("todas");
  const { sort, sortOf, setSort } = useSort<SortKey>("fecha", "desc");
  const [pageSize, setPageSize] = useState(10);

  // Drawer de resumen ejecutivo (igual a Discrepancias)
  const [summarySheetId, setSummarySheetId] = useState<number | null>(null);


  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectionCache, setSelectionCache] = useState<Map<number, CorrectiveActionSheet>>(() => new Map());

  const debouncedSearch = useDebouncedValue(search).trim();


  useEffect(() => {
    fetchAllPages<Plant>((page, size) => settingsApi.plants.list({ page, pageSize: size }))
      .then(setPlants)
      .catch(() => setPlants([]));

    fetchAllPages<ProductLine>((page, size) => productLinesApi.list({ page, pageSize: size }))
      .then(setProductLines)
      .catch(() => setProductLines([]));
  }, []);

  const criteria: Omit<HcaQuery, "page"> = {
    pageSize,
    search: debouncedSearch || undefined,
    clientId: clientId === "todos" ? undefined : Number(clientId),
    plantId: plantId === "todas" ? undefined : Number(plantId),
    productLineId: productLineId === "todas" ? undefined : Number(productLineId),
    from: from || undefined,
    to: to || undefined,
    status: chip === "todas" ? undefined : chip,
    sort: sort.key,
    dir: sort.dir,
  };

  const { data, isStale, error, page, setPage, refresh } = usePagedList<HcaQuery, SheetListResponse>({
    fetch: qualityApi.sheets.list,
    criteria,
    fallbackError: "No se pudieron cargar las HCA. Vuelve a intentarlo.",
  });

  const listLoading = data === null || isStale;
  const rows = useMemo(() => (isStale ? [] : (data?.items ?? [])), [data?.items, isStale]);
  const counts = data?.counts;

  useEffect(() => {
    if (rows.length === 0) return;
    setSelectionCache((prev) => {
      const next = new Map(prev);
      for (const row of rows) next.set(row.id, row);
      return next;
    });
  }, [rows]);

  const { selectedIds, pageState, toggleSelect, togglePage, clearSelection } =
    useTablePageSelection(rows.map((r) => r.id));

  const selectedItems = useMemo(
    () => Array.from(selectedIds).map((id) => selectionCache.get(id)).filter((item): item is CorrectiveActionSheet => item !== undefined),
    [selectedIds, selectionCache],
  );

  const applyListState = useCallback(
    (state: Record<string, unknown>) => {
      if (typeof state.search === "string") setSearch(state.search);
      if (typeof state.clientId === "string") setClientId(state.clientId);
      if (typeof state.plantId === "string") setPlantId(state.plantId);
      if (typeof state.productLineId === "string") setProductLineId(state.productLineId);
      if (typeof state.from === "string") setFrom(state.from);
      if (typeof state.to === "string") setTo(state.to);
      if (typeof state.chip === "string" && CHIPS.some((c) => c.key === state.chip)) setChip(state.chip as ChipKey);
      if (typeof state.pageSize === "number") setPageSize(state.pageSize);
      if (typeof state.sortKey === "string" && (state.sortDir === "asc" || state.sortDir === "desc")) {
        setSort({ key: state.sortKey as SortKey, dir: state.sortDir });
      }
    },
    [setSort],
  );

  const getReturnSnapshot = useCallback(() => {
    if (summarySheetId === null) return null;
    const row = selectionCache.get(summarySheetId) ?? rows.find((r) => r.id === summarySheetId);
    return {
      listPath: "/calidad/hca",
      scrollY: captureListScrollY(),
      bannerTitle: "Hecho, Causa y Acción (HCA)",
      bannerDetail: row ? `${row.number} · ${row.clientName ?? "Sin cliente"}` : undefined,
      listState: {
        search,
        clientId,
        plantId,
        productLineId,
        from,
        to,
        chip,
        pageSize,
        page,
        sortKey: sort.key,
        sortDir: sort.dir,
        summaryId: summarySheetId,
      },
    };
  }, [
    summarySheetId,
    selectionCache,
    rows,
    search,
    clientId,
    plantId,
    productLineId,
    from,
    to,
    chip,
    pageSize,
    page,
    sort.key,
    sort.dir,
  ]);

  const { listEnterMotion } = useEnterpriseListReturnRestore({
    applyListState,
    setPage,
    openSummary: setSummarySheetId,
    listReady: !listLoading && data !== null,
  });

  const plantOptions = useMemo(
    () => [
      { value: "todas", label: "Todas las plantas" },
      ...plants.map((p) => ({ value: String(p.id), label: p.name })),
    ],
    [plants],
  );

  const productLineOptions = useMemo(
    () => [
      { value: "todas", label: "Todas las líneas de producto" },
      ...productLines.map((pl) => ({ value: String(pl.id), label: pl.name })),
    ],
    [productLines],
  );

  const narrowFiltersCount =
    (clientId !== "todos" ? 1 : 0) +
    (plantId !== "todas" ? 1 : 0) +
    (productLineId !== "todas" ? 1 : 0) +
    (from || to ? 1 : 0);

  function clearNarrowFilters() {
    setClientId("todos");
    setPlantId("todas");
    setProductLineId("todas");
    setFrom("");
    setTo("");
  }

  const unfiltered = chip === "todas" && narrowFiltersCount === 0 && !debouncedSearch;

  async function handleBulkExportExcel() {
    if (selectedItems.length === 0) return;
    try {
      setBulkBusy(true);
      await exportHcasListToExcel(selectedItems);
      const count = selectedItems.length;
      receipts.done({
        action: "exportar-hca-excel",
        title: "Excel descargado",
        detail: `${count} HCA en el archivo`,
      });
    } catch {
      receipts.failed({ action: "exportar-hca-excel", title: "No se pudo generar el Excel" });
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleBulkExportPdf() {
    if (selectedItems.length === 0) return;
    try {
      setBulkBusy(true);
      await exportHcasListToPdf(selectedItems);
      const count = selectedItems.length;
      receipts.done({
        action: "exportar-hca-pdf",
        title: "PDF descargado",
        detail: `${count} HCA en el archivo`,
      });
    } catch {
      receipts.failed({ action: "exportar-hca-pdf", title: "No se pudo generar el PDF" });
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
    <div
      className={`flex h-full min-h-0 flex-col ${
        listEnterMotion === "back" ? "animate-plf-side-panel-back motion-reduce:animate-none" : ""
      }`}
    >
      <ModuleHeader
        title="Hecho, Causa y Acción (HCA)"
        summary={
          counts ? (
            <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
              {CHIPS.map((c, index) => {
                const count = counts[c.countKey];
                return (
                  <Fragment key={c.key}>
                    {index > 0 && <span aria-hidden className="text-zinc-300">·</span>}
                    <HeaderTag
                      label={count === 1 ? c.singular : c.plural}
                      count={count}
                      active={chip === c.key}
                      onClick={() => {
                        setChip(c.key);
                        setPage(1);
                      }}
                      tone={c.tone}
                      dot={c.key !== "todas"}
                      title={c.key === "todas" ? "Mostrar todas las HCA" : `Filtrar por HCA ${c.plural}`}
                    />
                  </Fragment>
                );
              })}
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-300" />
              Cargando las HCA…
            </span>
          )
        }
      />

      {error && (
        <ErrorRetry className="mb-3" onRetry={refresh}>
          {error}
        </ErrorRetry>
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
                placeholder="Número, hecho, cliente, producto, responsable…"
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

              <FilterDropdown
                title="Planta"
                aria-label="Filtrar por planta"
                options={plantOptions}
                value={plantId}
                onChange={setPlantId}
                defaultIcon={<Factory className="h-3.5 w-3.5 text-zinc-500" />}
                searchable
                searchPlaceholder="Buscar planta…"
              />

              <FilterDropdown
                title="Línea de producto"
                aria-label="Filtrar por línea de producto"
                options={productLineOptions}
                value={productLineId}
                onChange={setProductLineId}
                defaultIcon={<Layers className="h-3.5 w-3.5 text-zinc-500" />}
                searchable
                searchPlaceholder="Buscar línea de producto…"
              />

              <DateRangeFilterDropdown
                from={from}
                to={to}
                onFromChange={setFrom}
                onToChange={setTo}
                aria-label="Filtrar por fecha de detección"
              />

              {(search || narrowFiltersCount > 0) && (
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
              loading={listLoading}
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              totalPages={data.totalPages}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              noun="HCA"
              nounSingular="HCA"
            />
          )
        }
      >
        {listLoading ? (
          error === null && <TableSkeleton rows={pageSize} columns={8} />
        ) : rows.length === 0 ? (
          <ListEmptyState
            icon={ShieldCheck}
            isFiltered={!unfiltered}
            filteredTitle="Ninguna HCA coincide con este filtro o búsqueda."
            onClearFilters={() => {
              setSearch("");
              setChip("todas");
              clearNarrowFilters();
            }}
            emptyTitle="Todavía no hay HCA registradas."
            emptyDescription="Las HCA se generan y gestionan derivadas directamente desde un ticket o reclamación."
          />
        ) : (
          <div className="plf-results-in">
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
                  <Th sort={sortOf("numero")}>Código HCA</Th>
                  <Th sort={sortOf("cliente")}>Cliente</Th>
                  <Th>Línea / Planta</Th>
                  <Th>Responsable</Th>
                  <Th sort={sortOf("fecha")}>Fecha</Th>
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
                      onClick={() => setSummarySheetId(item.id)}
                    >
                      <Td className="w-9 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <SelectBox
                          checked={isChecked}
                          label={`Seleccionar HCA ${item.number}`}
                          onToggle={() => toggleSelect(item.id)}
                        />
                      </Td>
                      <Td>
                        <Link
                          to={`/calidad/hca/${item.id}`}
                          onClick={(event) => event.stopPropagation()}
                          className="whitespace-nowrap font-mono text-[12px] font-medium text-ink hover:text-brand-red"
                        >
                          {item.number}
                        </Link>
                      </Td>
                      <Td className="text-[12.5px] text-brand-gray">
                        <span title={item.clientName} className="block max-w-[200px] truncate font-medium text-ink">
                          {item.clientName}
                        </span>
                      </Td>
                      <Td className="text-[12.5px] text-brand-gray">
                        <span className="block max-w-[180px] truncate">
                          {item.productLineName}
                          {item.plantName ? ` · ${item.plantName}` : ""}
                        </span>
                      </Td>
                      <Td className="text-[12.5px] text-brand-gray">
                        <span title={item.responsibleName} className="block max-w-[170px] truncate">
                          {item.responsibleName}
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap text-[12.5px] tabular-nums text-brand-gray">
                        {formatDay(item.detectedAt.slice(0, 10))}
                      </Td>
                      <Td>
                        <HcaStatusBadge status={item.status} overdue={isHcaOverdue(item)} />
                      </Td>
                      <Td>
                        <div
                          className="flex h-7 items-center justify-end gap-1"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <RowAction
                            label={`Ver resumen de ${item.number}`}
                            icon={Eye}
                            onClick={() => setSummarySheetId(item.id)}
                          />
                          <RowAction
                            label={`Documento oficial ${item.number}`}
                            icon={FileText}
                            onClick={() => navigate(`/calidad/hca/${item.id}?documento=1`)}
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

      {/* Drawer de Resumen Ejecutivo (unificado con Discrepancias) */}
      {summarySheetId !== null && (
        <HcaSummaryDrawer
          sheetId={summarySheetId}
          getReturnSnapshot={getReturnSnapshot}
          onClose={() => setSummarySheetId(null)}
        />
      )}
    </div>
  );
}
