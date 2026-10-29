import { Building2, Eye, FileSpreadsheet, FileText, Tag, UserCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { withdrawalsApi, type WithdrawalCounts, type WithdrawalListResponse, type WithdrawalQuery } from "../../api/withdrawals";
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
import { useReceipts } from "../../context/useReceipts";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { useSort } from "../../hooks/useSort";
import { useTablePageSelection } from "../../hooks/useTablePageSelection";
import { formatDay } from "../../lib/dates";
import { resolveClientLabel, resolveStaffLabel, searchClients, searchStaff } from "../../lib/lookups";
import { formatAmount } from "../../lib/numbers";
import { exportWithdrawalsListToExcel, exportWithdrawalsListToPdf } from "../../lib/withdrawalListExport";
import { WITHDRAWAL_REASONS, type WithdrawalStatus, type WithdrawalSummary } from "../../types/withdrawals";
import { WithdrawalStatusBadge } from "./WithdrawalStatusBadge";
import { WithdrawalSummaryDrawer } from "./WithdrawalSummaryDrawer";

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

const searchSellers = searchStaff();

/** RF-W6: listado paginado con selección múltiple, exportación y resumen en drawer. */
export function WithdrawalsPage() {
  const receipts = useReceipts();

  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [reason, setReason] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [chip, setChip] = useState<ChipKey>("todas");
  const { sort, sortOf } = useSort<SortKey>("fecha", "desc");
  const [pageSize, setPageSize] = useState(10);
  const [summaryId, setSummaryId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectionCache, setSelectionCache] = useState<Map<number, WithdrawalSummary>>(() => new Map());

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
        .filter((item): item is WithdrawalSummary => item !== undefined),
    [selectedIds, selectionCache],
  );

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

  async function handleBulkExportExcel() {
    if (selectedItems.length === 0) return;
    try {
      setBulkBusy(true);
      await exportWithdrawalsListToExcel(selectedItems);
      const count = selectedItems.length;
      receipts.done({
        action: "exportar-retiros-excel",
        title: "Excel descargado",
        detail: `${count} ${count === 1 ? "solicitud en el archivo" : "solicitudes en el archivo"}`,
      });
    } catch {
      receipts.failed({ action: "exportar-retiros-excel", title: "No se pudo generar el Excel" });
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleBulkExportPdf() {
    if (selectedItems.length === 0) return;
    try {
      setBulkBusy(true);
      await exportWithdrawalsListToPdf(selectedItems);
      const count = selectedItems.length;
      receipts.done({
        action: "exportar-retiros-pdf",
        title: "PDF descargado",
        detail: `${count} ${count === 1 ? "solicitud en el archivo" : "solicitudes en el archivo"}`,
      });
    } catch {
      receipts.failed({ action: "exportar-retiros-pdf", title: "No se pudo generar el PDF" });
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
              noun="solicitudes"
              nounSingular="solicitud"
            />
          )
        }
      >
        {data === null ? (
          error === null && <TableSkeleton rows={pageSize} columns={9} />
        ) : rows.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-[13.5px] text-faint">
              {unfiltered ? "Todavía no hay solicitudes de retiro registradas." : "Ninguna solicitud coincide con este filtro o búsqueda."}
            </p>
            {unfiltered && (
              <p className="mx-auto mt-1.5 max-w-md text-[12.5px] text-faint">
                Se registran desde el ticket: abre el ticket y entra a la pestaña «Retiro de mercancía».
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
                  <Th sort={sortOf("cliente")}>Cliente</Th>
                  <Th sort={sortOf("fecha")}>Fecha</Th>
                  <Th>Motivo</Th>
                  <Th>Vendedor</Th>
                  <Th sort={sortOf("valor")} className="text-right">
                    Valor
                  </Th>
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
                          label={`Seleccionar solicitud ${item.number}`}
                          onToggle={() => toggleSelect(item.id)}
                        />
                      </Td>
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
                        {item.errorOrigin && (
                          <span className="block text-[11.5px] text-faint">Error de {item.errorOrigin.toLowerCase()}</span>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-[12.5px] text-brand-gray">{item.requestedByName}</Td>
                      <Td className="whitespace-nowrap text-right text-[12.5px] tabular-nums text-ink">
                        {item.currency ? formatAmount(item.totalValue, item.currency) : <span className="text-faint">—</span>}
                      </Td>
                      <Td>
                        <WithdrawalStatusBadge status={item.status} />
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
                            onClick={() => window.open(`/retiros/${item.id}/imprimir?mode=pdf`, "_blank")}
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
        <WithdrawalSummaryDrawer withdrawalId={summaryId} onClose={() => setSummaryId(null)} />
      )}
    </div>
  );
}
