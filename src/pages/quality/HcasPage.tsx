import {
  Building2,
  Eye,
  Factory,
  FileSpreadsheet,
  FileText,
  Layers,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchAllPages } from "../../api/paging";
import { productLinesApi } from "../../api/productLines";
import { qualityApi } from "../../api/quality";
import { settingsApi } from "../../api/settings";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Button } from "../../components/ui/Button";
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
import { Tooltip } from "../../components/ui/Tooltip";
import { useReceipts } from "../../context/useReceipts";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import { useSort } from "../../hooks/useSort";
import { useTablePageSelection } from "../../hooks/useTablePageSelection";
import { formatDay } from "../../lib/dates";
import { exportHcasListToExcel, exportHcasListToPdf } from "../../lib/hcaListExport";
import { resolveClientLabel, searchClients } from "../../lib/lookups";
import { describeDueShort, isSheetOverdue } from "../../lib/quality";
import type { Plant, ProductLine } from "../../types/settings";
import type { CorrectiveActionSheet, HcaQuery, HcaStatus, SheetListResponse } from "../../types/quality";
import { HcaFormModal } from "./HcaFormModal";
import { HcaStatusBadge } from "./StatusBadges";

type ChipKey = "todas" | HcaStatus;
type SortKey = "fecha" | "numero" | "cliente" | "vencimiento";

const CHIPS: {
  key: ChipKey;
  label: string;
  status?: string;
  countKey: "all" | "open" | "inAnalysis" | "inExecution" | "inVerification" | "closed";
  tone: HeaderTagTone;
}[] = [
  { key: "todas", label: "Todas", countKey: "all", tone: "neutral" },
  { key: "Abierta", label: "Abiertas", status: "Abierta", countKey: "open", tone: "amber" },
  { key: "En análisis" as HcaStatus, label: "En análisis", status: "En análisis", countKey: "inAnalysis", tone: "blue" },
  { key: "En ejecución" as HcaStatus, label: "En ejecución", status: "En ejecución", countKey: "inExecution", tone: "amber" },
  { key: "En verificación" as HcaStatus, label: "En verificación", status: "En verificación", countKey: "inVerification", tone: "blue" },
  { key: "Cerrada", label: "Cerradas", status: "Cerrada", countKey: "closed", tone: "emerald" },
];

/**
 * Listado paginado de Hojas de Acción Correctiva (HCA, PF-FOR-109)
 * con filtros completos, selección múltiple, exportación a Excel/PDF y navegación fluida.
 */
export function HcasPage() {
  const navigate = useNavigate();
  const receipts = useReceipts();
  const { can } = usePermissions();

  const [plants, setPlants] = useState<Plant[]>([]);
  const [productLines, setProductLines] = useState<ProductLine[]>([]);

  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState("todos");
  const [plantId, setPlantId] = useState("todas");
  const [productLineId, setProductLineId] = useState("todas");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [chip, setChip] = useState<ChipKey>("todas");
  const { sort, sortOf } = useSort<SortKey>("fecha", "desc");
  const [pageSize, setPageSize] = useState(10);

  const [creating, setCreating] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectionCache, setSelectionCache] = useState<Map<number, CorrectiveActionSheet>>(() => new Map());

  const debouncedSearch = useDebouncedValue(search).trim();
  const canWrite = can("quality.write");

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
    status: CHIPS.find((c) => c.key === chip)?.status,
    sort: sort.key,
    dir: sort.dir,
  };

  const { data, isStale, error, setPage, refresh } = usePagedList<HcaQuery, SheetListResponse>({
    fetch: qualityApi.sheets.list,
    criteria,
    fallbackError: "No se pudieron cargar las HCA. Vuelve a intentarlo.",
  });

  const rows = useMemo(() => data?.items ?? [], [data?.items]);
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

  const unfiltered = narrowFiltersCount === 0 && !debouncedSearch && chip === "todas";

  async function handleBulkExportExcel() {
    if (selectedItems.length === 0) return;
    try {
      setBulkBusy(true);
      await exportHcasListToExcel(selectedItems);
      const count = selectedItems.length;
      receipts.done({
        action: "exportar-hca-excel",
        title: "Excel descargado",
        detail: `${count} ${count === 1 ? "acción correctiva en el archivo" : "acciones correctivas en el archivo"}`,
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
        detail: `${count} ${count === 1 ? "acción correctiva en el archivo" : "acciones correctivas en el archivo"}`,
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
    <div>
      <ModuleHeader
        title="Acciones Correctivas (HCA)"
        action={
          canWrite && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Nueva HCA
            </Button>
          )
        }
        summary={
          counts ? (
            <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
              {CHIPS.map((c, i) => (
                <span key={c.key} className="inline-flex items-center gap-1.5">
                  {i > 0 && <span aria-hidden className="text-zinc-300">·</span>}
                  <HeaderTag
                    label={c.label}
                    count={counts[c.countKey]}
                    active={chip === c.key}
                    onClick={() => {
                      setChip(c.key);
                      setPage(1);
                    }}
                    tone={c.tone}
                    dot={c.key !== "todas"}
                    title={`Filtrar por ${c.label.toLowerCase()}`}
                  />
                </span>
              ))}
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-300" />
              Cargando las acciones correctivas…
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
              />

              <FilterDropdown
                title="Línea de producto"
                aria-label="Filtrar por línea de producto"
                options={productLineOptions}
                value={productLineId}
                onChange={setProductLineId}
                defaultIcon={<Layers className="h-3.5 w-3.5 text-zinc-500" />}
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
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              totalPages={data.totalPages}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              noun="acciones correctivas"
              nounSingular="acción correctiva"
            />
          )
        }
      >
        {data === null ? (
          error === null && <TableSkeleton rows={pageSize} columns={8} />
        ) : rows.length === 0 ? (
          <ListEmptyState
            icon={ShieldCheck}
            isFiltered={!unfiltered}
            filteredTitle="Ninguna acción correctiva coincide con este filtro o búsqueda."
            onClearFilters={() => {
              setSearch("");
              clearNarrowFilters();
            }}
            emptyTitle="Todavía no hay acciones correctivas (HCA) registradas."
            emptyDescription="Se pueden crear desde aquí con el botón 'Nueva HCA' o derivadas directamente desde un ticket o reclamación."
          />
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
                  <Th sort={sortOf("numero")}>Código HCA</Th>
                  <Th sort={sortOf("cliente")}>Cliente</Th>
                  <Th>Línea / Planta</Th>
                  <Th>Responsable</Th>
                  <Th sort={sortOf("fecha")}>Detección</Th>
                  <Th sort={sortOf("vencimiento")}>Vencimiento</Th>
                  <Th>Estado</Th>
                  <Th className="w-24 text-right">Acciones</Th>
                </HeadRow>
              </thead>
              <tbody>
                {rows.map((item) => {
                  const isChecked = selectedIds.has(item.id);
                  const overdue = isSheetOverdue(item);
                  return (
                    <Row
                      key={item.id}
                      className={`cursor-pointer ${isChecked ? "bg-brand-red/[0.03]" : ""}`}
                      onClick={() => navigate(`/calidad/hca/${item.id}`)}
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
                          className="whitespace-nowrap font-mono text-[12.5px] font-semibold text-ink hover:text-brand-red"
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
                      <Td className="whitespace-nowrap text-[12.5px] tabular-nums">
                        {overdue ? (
                          <Tooltip content={`Venció el ${formatDay(item.dueDate)}`}>
                            <span className="font-medium text-red-600">
                              {describeDueShort(item.dueDate)}
                            </span>
                          </Tooltip>
                        ) : (
                          <span className="text-brand-gray">
                            {describeDueShort(item.dueDate)}
                          </span>
                        )}
                      </Td>
                      <Td>
                        <HcaStatusBadge status={item.status} overdue={overdue} />
                      </Td>
                      <Td>
                        <div
                          className="flex h-7 items-center justify-end gap-1"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <RowAction
                            label={`Ver detalle de ${item.number}`}
                            icon={Eye}
                            onClick={() => navigate(`/calidad/hca/${item.id}`)}
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

      {creating && (
        <HcaFormModal
          productLines={productLines}
          onClose={() => setCreating(false)}
          onSaved={(newSheet) => {
            setCreating(false);
            receipts.done({
              action: "crear-hca",
              title: "HCA creada",
              detail: `Se registró la hoja ${newSheet.number} exitosamente`,
            });
            navigate(`/calidad/hca/${newSheet.id}`);
          }}
        />
      )}
    </div>
  );
}
