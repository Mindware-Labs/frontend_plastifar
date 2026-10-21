import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { fetchAllPages } from "../../api/paging";
import { productLinesApi } from "../../api/productLines";
import {
  qualityApi,
  type SheetCounts,
  type SheetListResponse,
  type SheetQuery,
} from "../../api/quality";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { DataTable, HeadRow, Row, Td, Th, type SortDir } from "../../components/ui/DataTable";
import { ControlInput } from "../../components/ui/ControlInput";
import { CriteriaField, CriteriaLookup, CriteriaSelect } from "../../components/ui/CriteriaField";
import { ClearFiltersButton } from "../../components/ui/FilterDropdown";
import { HeaderTag } from "../../components/ui/HeaderTag";
import { EmptyResult } from "../../components/ui/EmptyResult";
import { ListPanel } from "../../components/ui/ListPanel";
import { Pagination } from "../../components/ui/Pagination";
import { SearchInput } from "../../components/ui/SearchInput";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import {
  resolveClientLabel,
  resolveProductLabel,
  resolveStaffLabel,
  searchActiveStaff,
  searchClients,
  searchProducts,
} from "../../lib/lookups";
import { describeDueShort, formatDay, isSheetOverdue } from "../../lib/quality";
import { settingsApi } from "../../api/settings";
import type { Plant, ProductLine } from "../../types/settings";
import { HcaModal } from "./HcaModal";
import { HcaStatusBadge } from "./StatusBadges";
import { TicketLink } from "./TicketLink";
import { FilterPopover } from "../../components/ui/FilterPopover";

type ChipKey = "todas" | "abiertas" | "vencidas" | "cerradas";
/** Solo lo que el servidor sabe ordenar (SheetQuery.sort). */
type SortKey = "compromiso" | "cliente";

const CHIPS: { key: ChipKey; label: string; status?: string; countKey: "all" | "open" | "overdue" | "closed" }[] = [
  { key: "todas", label: "Todas", countKey: "all" },
  { key: "abiertas", label: "Abiertas", status: "abiertas", countKey: "open" },
  { key: "vencidas", label: "Vencidas", status: "vencidas", countKey: "overdue" },
  { key: "cerradas", label: "Cerradas", status: "cerradas", countKey: "closed" },
];

/**
 * Lo que el listado debe, antes de lo que contiene. La ficha ya abria diciendo
 * que bloqueaba el cierre; el listado abria con una tabla muda. Solo se dice lo
 * que el servidor cuenta: vencidas y abiertas, nada inventado.
 */
function listDebt(counts: SheetCounts): string {
  if (counts.overdue === 0) {
    return counts.open === 1
      ? "Queda 1 HCA abierta y ninguna vencida."
      : `Quedan ${counts.open} HCA abiertas y ninguna vencida.`;
  }

  const head =
    counts.overdue === 1 ? "1 HCA pasó su fecha comprometida" : `${counts.overdue} HCA pasaron su fecha comprometida`;
  return `${head}, sobre ${counts.open} ${counts.open === 1 ? "abierta" : "abiertas"}. Ninguna se cierra hasta resolver su plan y verificar la eficacia.`;
}

/** RF-Q1: listado paginado de HCA con pastillas por estado y filtros por linea
 *  de producto, responsable, cliente y rango de fechas. */
export function HcaPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canWrite = can("quality.write");

  const [productLines, setProductLines] = useState<ProductLine[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);

  const [search, setSearch] = useState("");
  const [productLineId, setProductLineId] = useState("todas");
  // RF-H9 (docs/plan/05): planta y producto concreto.
  const [plantId, setPlantId] = useState("todas");
  const [productId, setProductId] = useState("");
  const [responsibleId, setResponsibleId] = useState("todos");
  const [clientId, setClientId] = useState("todos");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // La pastilla inicial puede venir en la URL (`/calidad/hca?estado=vencidas`):
  // es como el Dashboard abre la lista que produjo una de sus cifras. Solo se
  // lee al montar y no se sincroniza de vuelta —cambiar de pastilla no reescribe
  // la barra de direcciones—, para no meterle historial a un filtro.
  const [searchParams] = useSearchParams();
  const [chip, setChip] = useState<ChipKey>(() => {
    const requested = searchParams.get("estado");
    return CHIPS.some((entry) => entry.key === requested) ? (requested as ChipKey) : "todas";
  });
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "compromiso", dir: "asc" });
  const [pageSize, setPageSize] = useState(10);

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
    productLineId: productLineId === "todas" ? undefined : Number(productLineId),
    plantId: plantId === "todas" ? undefined : Number(plantId),
    productId: productId === "" ? undefined : Number(productId),
    responsibleId: responsibleId === "todos" ? undefined : Number(responsibleId),
    clientId: clientId === "todos" ? undefined : Number(clientId),
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

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  return (
    <div>
      <ModuleHeader
        title="HCA"
        summary={
          counts ? (
            <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
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
              <span aria-hidden className="text-zinc-300">·</span>
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
              <span aria-hidden className="text-zinc-300">·</span>
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
              <span aria-hidden className="text-zinc-300">·</span>
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
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-300" />
              Cargando las hojas de corrección y acción…
            </span>
          )
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
          <div className="flex w-full flex-wrap items-center gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Número, cliente o descripción…"
              className="w-[230px]"
            />

        {/* Los cuatro criterios de acotacion, guardados hasta que hacen falta.
            De los siete que tenia esta barra, quien abre la pantalla usa el
            buscador y las pastillas; linea, responsable, cliente y el rango de
            fechas se tocan cuando se busca algo concreto. Tenerlos desplegados
            cobraba 119 px a la tabla, que es lo unico que se vino a leer. */}
        <FilterPopover count={filtrosPuestos} onClear={clearNarrowFilters}>
          <CriteriaSelect
          label="Línea"
          ariaLabel="Filtrar por línea de producto"
          value={productLineId}
          onChange={setProductLineId}
          width="w-[160px]"
          options={[
            { value: "todas", label: "Todas las líneas" },
            ...productLines.map((line) => ({ value: String(line.id), label: line.name })),
          ]}
        />

        <CriteriaSelect
          label="Planta"
          ariaLabel="Filtrar por planta"
          value={plantId}
          onChange={setPlantId}
          width="w-[160px]"
          options={[
            { value: "todas", label: "Todas las plantas" },
            ...plants.map((plant) => ({ value: String(plant.id), label: plant.name })),
          ]}
        />

        <CriteriaLookup
          label="Producto"
          ariaLabel="Filtrar por producto"
          width="w-[200px]"
          placeholder="Todos los productos"
          searchPlaceholder="Código o descripción…"
          clearLabel="Todos los productos"
          value={productId}
          onChange={(value) => setProductId(value)}
          search={searchProducts}
          resolveSelectedLabel={resolveProductLabel}
        />

        <CriteriaLookup
          label="Responsable"
          ariaLabel="Filtrar por responsable"
          width="w-[170px]"
          placeholder="Todos los responsables"
          searchPlaceholder="Buscar responsable…"
          clearLabel="Todos los responsables"
          value={responsibleId === "todos" ? "" : responsibleId}
          onChange={(value) => setResponsibleId(value === "" ? "todos" : value)}
          search={searchActiveStaff}
          resolveSelectedLabel={resolveStaffLabel}
        />

        <CriteriaLookup
          label="Cliente"
          ariaLabel="Filtrar por cliente"
          width="w-[200px]"
          placeholder="Todos los clientes"
          searchPlaceholder="Buscar cliente…"
          clearLabel="Todos los clientes"
          value={clientId === "todos" ? "" : clientId}
          onChange={(value) => setClientId(value === "" ? "todos" : value)}
          search={searchClients}
          resolveSelectedLabel={resolveClientLabel}
        />

        <div className="flex items-end gap-2">
          <CriteriaField label="Detectada desde" htmlFor="hca-desde">
            <ControlInput
              id="hca-desde"
              type="date"
              className="w-[140px]"
              value={from}
              max={to === "" ? undefined : to}
              onChange={(event) => setFrom(event.target.value)}
            />
          </CriteriaField>

          <CriteriaField label="Hasta" htmlFor="hca-hasta">
            <ControlInput
              id="hca-hasta"
              type="date"
              className="w-[140px]"
              value={to}
              min={from === "" ? undefined : from}
              onChange={(event) => setTo(event.target.value)}
            />
          </CriteriaField>
        </div>
            </FilterPopover>

            {(search || filtrosPuestos > 0) && (
              <ClearFiltersButton
                onClick={() => {
                  setSearch("");
                  clearNarrowFilters();
                }}
              />
            )}

            {counts && (counts.overdue > 0 || counts.open > 0) && (
              <p className="ml-auto text-[12.5px] text-brand-gray">{listDebt(counts)}</p>
            )}
          </div>
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
              noun="HCA"
            />
          )
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
                <Th sort={{ dir: sort.key === "cliente" ? sort.dir : null, onToggle: () => toggleSort("cliente") }}>
                  Cliente
                </Th>
                <Th>Línea</Th>
                <Th>Responsable</Th>
                <Th
                  sort={{ dir: sort.key === "compromiso" ? sort.dir : null, onToggle: () => toggleSort("compromiso") }}
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
          onSaved={() => {
            setModalOpen(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}
