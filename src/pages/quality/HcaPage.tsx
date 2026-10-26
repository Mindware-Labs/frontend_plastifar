import { Factory, Layers, Package, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchAllPages } from "../../api/paging";
import { productLinesApi } from "../../api/productLines";
import {
  qualityApi,
  type SheetCounts,
  type SheetListResponse,
  type SheetQuery,
} from "../../api/quality";
import { settingsApi } from "../../api/settings";
import { HeaderCounts } from "../../components/app/HeaderCounts";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Button } from "../../components/ui/Button";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { EmptyResult } from "../../components/ui/EmptyResult";
import { ErrorRetry } from "../../components/ui/ErrorRetry";
import {
  ClearFiltersButton,
  FilterDropdown,
  LookupFilterDropdown,
} from "../../components/ui/FilterDropdown";
import { HeaderTag } from "../../components/ui/HeaderTag";
import { ListPanel } from "../../components/ui/ListPanel";
import { SearchInput } from "../../components/ui/SearchInput";
import { ServerPagination } from "../../components/ui/ServerPagination";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { useReceipts } from "../../context/useReceipts";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import { useSort } from "../../hooks/useSort";
import { useUrlNumber, useUrlState } from "../../hooks/useUrlState";
import { idParam } from "../../lib/idParam";
import { formatDay } from "../../lib/dates";
import { resolveProductLabel, searchProducts } from "../../lib/lookups";
import { describeDueShort, isSheetOverdue } from "../../lib/quality";
import type { Plant, ProductLine } from "../../types/settings";
import { HcaFilterPopover } from "./HcaFilterPopover";
import { HcaModal } from "./HcaModal";
import { HcaStatusBadge } from "./StatusBadges";
import { TicketLink } from "./TicketLink";
import { PAGE_SIZES } from "../../lib/pageSizes";

type ChipKey = "todas" | "abiertas" | "vencidas" | "cerradas";
/** Solo lo que el servidor sabe ordenar (SheetQuery.sort). */
type SortKey = "compromiso" | "cliente";

const CHIPS: { key: ChipKey; label: string; status?: string; countKey: "all" | "open" | "overdue" | "closed" }[] = [
  { key: "todas", label: "Todas", countKey: "all" },
  { key: "abiertas", label: "Abiertas", status: "abiertas", countKey: "open" },
  { key: "vencidas", label: "Vencidas", status: "vencidas", countKey: "overdue" },
  { key: "cerradas", label: "Cerradas", status: "cerradas", countKey: "closed" },
];

const CHIP_KEYS = CHIPS.map((c) => c.key);

/**
 * Lo que el listado debe, antes de lo que contiene. La ficha ya abria diciendo
 * que bloqueaba el cierre; el listado abria con una tabla muda. Solo se dice lo
 * que el servidor cuenta: vencidas y abiertas, nada inventado.
 */
function listDebt(counts: SheetCounts): string {
  if (counts.overdue === 0) {
    return `${counts.open} ${counts.open === 1 ? "abierta" : "abiertas"}`;
  }
  return `${counts.overdue} ${counts.overdue === 1 ? "vencida" : "vencidas"} sobre ${counts.open} abiertas`;
}

/** RF-Q1: listado paginado de HCA con pastillas por estado y filtros por linea
 *  de producto, responsable, cliente y rango de fechas. */
export function HcaPage() {
  const navigate = useNavigate();
  const receipts = useReceipts();
  const { can } = usePermissions();
  const canWrite = can("quality.write");

  const [productLines, setProductLines] = useState<ProductLine[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);

  // Filtros, busqueda y pagina viven en la URL: volver desde el detalle deja el
  // listado como estaba. `?estado=vencidas` es tambien como el Dashboard abre
  // la lista que produjo una de sus cifras.
  const [search, setSearch] = useUrlState<string>("q", "");
  const [productLineId, setProductLineId] = useUrlState<string>("linea", "todas");
  // RF-H9 (docs/plan/05): planta y producto concreto.
  const [plantId, setPlantId] = useUrlState<string>("planta", "todas");
  const [productId, setProductId] = useUrlState<string>("producto", "");
  const [responsibleId, setResponsibleId] = useUrlState<string>("responsable", "todos");
  const [clientId, setClientId] = useUrlState<string>("cliente", "todos");
  const [from, setFrom] = useUrlState<string>("desde", "");
  const [to, setTo] = useUrlState<string>("hasta", "");
  const [chip, setChip] = useUrlState<ChipKey>("estado", "todas", CHIP_KEYS);
  const { sort, sortOf } = useSort<SortKey>("compromiso", "asc");
  const [pageSize, setPageSize] = useUrlNumber("tam", 10, PAGE_SIZES);

  const [modalOpen, setModalOpen] = useState(false);

  const debouncedSearch = useDebouncedValue(search).trim();

  // Las lineas de producto son catalogo acotado: se recorren enteras. Clientes
  // y personal no lo son, y por eso sus dos filtros y el formulario de alta
  // buscan en el servidor en vez de comer de una lista precargada: el corte
  // fijo de cien hacia que el cliente 101 no existiera para quien filtraba.
  useEffect(() => {
    fetchAllPages<ProductLine>((page, pageSize) => productLinesApi.list({ page, pageSize }))
      .then(setProductLines)
      .catch(() => setProductLines([]));
    // Las plantas tambien son catalogo acotado.
    fetchAllPages<Plant>((page, pageSize) => settingsApi.plants.list({ page, pageSize }))
      .then(setPlants)
      .catch(() => setPlants([]));
  }, []);

  const criteria: Omit<SheetQuery, "page"> = {
    pageSize,
    search: debouncedSearch || undefined,
    productLineId: productLineId === "todas" ? undefined : idParam(productLineId),
    plantId: plantId === "todas" ? undefined : idParam(plantId),
    productId: productId === "" ? undefined : idParam(productId),
    responsibleId: responsibleId === "todos" ? undefined : idParam(responsibleId),
    clientId: clientId === "todos" ? undefined : idParam(clientId),
    from: from || undefined,
    to: to || undefined,
    status: CHIPS.find((c) => c.key === chip)?.status,
    sort: sort.key,
    dir: sort.dir,
  };

  const { data, isStale, error, setPage, refresh } = usePagedList<SheetQuery, SheetListResponse>({
    fetch: qualityApi.sheets.list,
    criteria,
    fallbackError: "No se pudieron cargar las HCA. Vuelve a intentarlo.",
    pageKey: "pagina",
  });

  const rows = data?.items ?? [];
  const counts = data?.counts;
  const unfiltered =
    chip === "todas" &&
    productLineId === "todas" &&
    plantId === "todas" &&
    productId === "" &&
    responsibleId === "todos" &&
    clientId === "todos" &&
    from === "" &&
    to === "" &&
    !debouncedSearch;

  /* Cuantos criterios del panel estan puestos. El numero viaja al disparador:
     un filtro aplicado que no se ve es la peor averia de un listado, porque se
     lee una tabla recortada creyendo que es la tabla entera. */
  const filtrosPuestos =
    (productLineId !== "todas" ? 1 : 0) +
    (plantId !== "todas" ? 1 : 0) +
    (productId !== "" ? 1 : 0) +
    (responsibleId !== "todos" ? 1 : 0) +
    (clientId !== "todos" ? 1 : 0) +
    (from !== "" || to !== "" ? 1 : 0);

  /** Quita solo lo del panel; la busqueda y las pastillas siguen donde estaban. */
  function clearNarrowFilters() {
    setProductLineId("todas");
    setPlantId("todas");
    setProductId("");
    setResponsibleId("todos");
    setClientId("todos");
    setFrom("");
    setTo("");
    setPage(1);
  }

  /** Quita los siete recortes de una vez: es la salida del estado vacio. */
  function clearFilters() {
    setSearch("");
    setProductLineId("todas");
    setPlantId("todas");
    setProductId("");
    setResponsibleId("todos");
    setClientId("todos");
    setFrom("");
    setTo("");
    setChip("todas");
    setPage(1);
  }

  return (
    <div>
      <ModuleHeader
        title="HCA"
        summary={
          <HeaderCounts counts={counts} loadingLabel="Cargando las hojas de corrección y acción…">
            {(counts) => (
              <>
                <HeaderTag
                  label={counts.all === 1 ? "hoja" : "hojas"}
                  count={counts.all}
                  active={chip === "todas"}
                  onClick={() => {
                    setChip("todas");
                    setPage(1);
                  }}
                  tone="neutral"
                  title="Mostrar todas las hojas de corrección y acción"
                />
                <HeaderTag
                  label={counts.open === 1 ? "abierta" : "abiertas"}
                  count={counts.open}
                  active={chip === "abiertas"}
                  onClick={() => {
                    setChip("abiertas");
                    setPage(1);
                  }}
                  tone="emerald"
                  dot
                  title="Filtrar por HCA abiertas"
                />
                <HeaderTag
                  label={counts.overdue === 1 ? "vencida" : "vencidas"}
                  count={counts.overdue}
                  active={chip === "vencidas"}
                  onClick={() => {
                    setChip("vencidas");
                    setPage(1);
                  }}
                  tone="red"
                  dot
                  dotPulse
                  title="Filtrar por HCA vencidas"
                />
                <HeaderTag
                  label={counts.closed === 1 ? "cerrada" : "cerradas"}
                  count={counts.closed}
                  active={chip === "cerradas"}
                  onClick={() => {
                    setChip("cerradas");
                    setPage(1);
                  }}
                  tone="blue"
                  dot
                  title="Filtrar por HCA cerradas"
                />
              </>
            )}
          </HeaderCounts>
        }
        action={
          canWrite && (
            <Button size="sm" onClick={() => setModalOpen(true)}>
              <Plus className="h-[15px] w-[15px]" />
              Nueva HCA
            </Button>
          )
        }
      />

      {error && (
        <ErrorRetry className="mb-3" onRetry={refresh}>{error}</ErrorRetry>
      )}

      <ListPanel
        toolbar={
          <div className="flex w-full items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Número, cliente o descripción…"
                className="w-[210px]"
              />

              <FilterDropdown
                title="Seleccionar línea"
                aria-label="Filtrar por línea de producto"
                value={productLineId}
                onChange={setProductLineId}
                defaultIcon={<Layers className="h-3.5 w-3.5 text-zinc-500" />}
                searchable
                searchPlaceholder="Buscar línea…"
                options={[
                  { value: "todas", label: "Todas las líneas" },
                  ...productLines.map((line) => ({ value: String(line.id), label: line.name })),
                ]}
              />

              <FilterDropdown
                title="Seleccionar planta"
                aria-label="Filtrar por planta"
                value={plantId}
                onChange={setPlantId}
                defaultIcon={<Factory className="h-3.5 w-3.5 text-zinc-500" />}
                searchable
                searchPlaceholder="Buscar planta…"
                options={[
                  { value: "todas", label: "Todas las plantas" },
                  ...plants.map((plant) => ({ value: String(plant.id), label: plant.name })),
                ]}
              />

              <LookupFilterDropdown
                title="Seleccionar producto"
                aria-label="Filtrar por producto"
                placeholder="Todos los productos"
                searchPlaceholder="Código o descripción…"
                defaultIcon={<Package className="h-3.5 w-3.5 text-zinc-500" />}
                value={productId}
                onChange={(value) => setProductId(value)}
                search={searchProducts}
                resolveSelectedLabel={resolveProductLabel}
              />

              <HcaFilterPopover
                responsibleId={responsibleId}
                onResponsibleChange={setResponsibleId}
                clientId={clientId}
                onClientChange={setClientId}
                from={from}
                to={to}
                onDateChange={(since, until) => {
                  setFrom(since);
                  setTo(until);
                }}
                onClear={() => {
                  setResponsibleId("todos");
                  setClientId("todos");
                  setFrom("");
                  setTo("");
                }}
              />

              {(search || filtrosPuestos > 0) && (
                <ClearFiltersButton
                  onClick={() => {
                    setSearch("");
                    clearNarrowFilters();
                  }}
                />
              )}
            </div>

            {counts && (counts.overdue > 0 || counts.open > 0) && (
              <span className="hidden xl:inline-flex shrink-0 items-center text-[12px] font-medium text-brand-gray whitespace-nowrap tabular-nums">
                {listDebt(counts)}
              </span>
            )}
          </div>
        }
        footer={
          <ServerPagination
            data={data}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            noun="HCA"
          />
        }
      >
        {data === null ? (
          // Con un error de carga no hay nada que esperar: el aviso ya trae el
          // reintento, y una rueda eterna debajo del aviso mentia.
          error === null && <TableSkeleton rows={pageSize} columns={7} />
        ) : rows.length === 0 ? (
          <EmptyResult
            message={
              unfiltered
                ? "Todavía no hay HCA registradas."
                : "Ninguna HCA coincide con este filtro o búsqueda."
            }
            onClear={unfiltered ? undefined : clearFilters}
          />
        ) : (
          <div className={`plf-results-in transition-opacity ${isStale ? "opacity-60" : ""}`}>
            <DataTable>
            <thead>
              <HeadRow>
                {/* Sin flecha: el servidor no ordena por número (SheetQuery.sort
                    solo admite compromiso y cliente), y un control que gira el
                    cursor sin cambiar el orden es peor que no tenerlo. */}
                <Th>Número</Th>
                <Th sort={sortOf("cliente")}>
                  Cliente
                </Th>
                <Th>Línea</Th>
                <Th>Responsable</Th>
                <Th
                  sort={sortOf("compromiso")}
                >
                  Vence
                </Th>
                <Th>Estado</Th>
                <Th>Ticket</Th>
              </HeadRow>
            </thead>

            <tbody>
              {rows.map((sheet) => {
                const overdue = isSheetOverdue(sheet);

                return (
                  /* La fila entera lleva al detalle, como en la bandeja de
                     tickets. El resaltado al pasar por encima ya prometia que
                     la fila respondia; sin esto, la promesa obligaba a acertarle
                     al enlace del nombre, que es el 15 % del ancho de la fila.
                     Los controles de dentro paran la propagacion: quien marca
                     una casilla o pulsa una accion no queria viajar. */
                  <Row
                    key={sheet.id}
                    onClick={() => navigate(`/calidad/hca/${sheet.id}`)}
                    className="cursor-pointer"
                  >
                    <Td>
                      <Link
                        to={`/calidad/hca/${sheet.id}`}
                        className="rounded-edge whitespace-nowrap font-mono text-[12px] font-medium text-ink underline-offset-4
                          outline-none hover:underline focus-visible:ring-3 focus-visible:ring-brand-red/20"
                      >
                        {sheet.number}
                      </Link>
                    </Td>
                    <Td className="text-[12.5px] text-brand-gray">
                      <span className="block max-w-[172px] truncate" title={sheet.clientName}>
                        {sheet.clientName}
                      </span>
                    </Td>
                    <Td className="text-[12.5px] text-brand-gray">{sheet.productLineName}</Td>
                    <Td className="whitespace-nowrap text-[12.5px] text-brand-gray">
                      {sheet.responsibleName}
                    </Td>
                    {/* Fecha y cuenta atras EN LA MISMA LINEA. Apiladas, la fila
                        de una HCA abierta medía 57 px y la de una cerrada 43: el
                        listado perdía su ritmo y la altura pasaba a señalar el
                        estado, que ya lo dice la pastilla de al lado. */}
                    <Td className="whitespace-nowrap">
                      <span className="text-[12.5px] tabular-nums text-brand-gray">
                        {formatDay(sheet.dueDate)}
                      </span>
                      {sheet.status !== "Cerrada" && (
                        <>
                          <span aria-hidden className="px-1.5 text-faint">·</span>
                          <span
                            className={`text-[11.5px] ${
                              overdue ? "font-medium text-brand-red-dark" : "text-faint"
                            }`}
                          >
                            {describeDueShort(sheet.dueDate)}
                          </span>
                        </>
                      )}
                    </Td>
                    <Td>
                      <HcaStatusBadge status={sheet.status} overdue={overdue} />
                    </Td>
                    <Td className="whitespace-nowrap">
                      <TicketLink number={sheet.ticketNumber} />
                    </Td>
                  </Row>
                );
              })}
            </tbody>
          </DataTable>
          </div>
        )}
      </ListPanel>

      {modalOpen && (
        <HcaModal
          productLines={productLines}
          onClose={() => setModalOpen(false)}
          onSaved={(savedSheet) => {
            setModalOpen(false);
            receipts.done({
              action: "crear-hca",
              title: "HCA creada exitosamente",
              detail: `${savedSheet.number} registrada`,
            });
            refresh();
          }}
        />
      )}
    </div>
  );
}
