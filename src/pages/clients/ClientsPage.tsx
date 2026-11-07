import { Ban, Building2, CheckCircle2, Pencil, Plus, Ticket, Trash2, UserCheck, UserCog, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { clientsApi, type ClientQuery } from "../../api/clients";
import { fetchAllPages } from "../../api/paging";
import { staffApi } from "../../api/staff";
import { HeaderCounts } from "../../components/app/HeaderCounts";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { EmptyResult } from "../../components/ui/EmptyResult";
import { ErrorRetry } from "../../components/ui/ErrorRetry";
import { ClearFiltersButton, FilterDropdown, LookupFilterDropdown } from "../../components/ui/FilterDropdown";
import { HeaderTag } from "../../components/ui/HeaderTag";
import { ListPanel } from "../../components/ui/ListPanel";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { SelectBox } from "../../components/ui/SelectBox";
import { ServerPagination } from "../../components/ui/ServerPagination";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { StatusDot } from "../../components/ui/StatusDot";
import { useCatalogActions } from "../../hooks/useCatalogActions";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { useUrlNumber, useUrlState } from "../../hooks/useUrlState";
import { usePermissions } from "../../hooks/usePermissions";
import { useReceipts } from "../../context/useReceipts";
import { useSort } from "../../hooks/useSort";
import { idParam } from "../../lib/idParam";
import {
  resolveStaffLabel,
  searchSalesRepStaff,
} from "../../lib/lookups";
import type { Client, ClientListResponse } from "../../types/clients";
import { BulkReassignSalesRepModal } from "./BulkReassignSalesRepModal";
import { ClientModal } from "./ClientModal";
import { ClientViewMenu } from "./ClientViewMenu";
import { ReassignSalesRepModal } from "./ReassignSalesRepModal";
import { PAGE_SIZES } from "../../lib/pageSizes";

type ChipKey = "todos" | "activos" | "inactivos" | "sinVendedor";

/** Claves que ClientsController ordena en servidor. */
type SortKey = "nombre" | "codigo" | "estado" | "fecha" | "actividad" | "tickets" | "contactos" | "tipo";

type FocusKey = "todos" | "sintickets" | "contickets" | "abiertos";

const FOCUS_KEYS: FocusKey[] = ["todos", "sintickets", "contickets", "abiertos"];

const clientSortOptions = [
  { value: "actividad:desc", label: "Actividad reciente" },
  { value: "actividad:asc", label: "Sin actividad reciente" },
  { value: "tickets:desc", label: "Más tickets" },
  { value: "tickets:asc", label: "Menos tickets" },
  { value: "contactos:desc", label: "Más contactos" },
  { value: "contactos:asc", label: "Menos contactos" },
  { value: "fecha:desc", label: "Alta reciente" },
  { value: "fecha:asc", label: "Clientes más antiguos" },
  { value: "nombre:asc", label: "Nombre (A–Z)" },
  { value: "nombre:desc", label: "Nombre (Z–A)" },
  { value: "codigo:asc", label: "Código (A–Z)" },
  { value: "estado:desc", label: "Activos primero" },
] as const;

const clientFocusOptions = [
  { value: "todos", label: "Todos los clientes" },
  { value: "contickets", label: "Con tickets" },
  { value: "abiertos", label: "Con tickets abiertos" },
  { value: "sintickets", label: "Sin tickets" },
] as const;

function parseSortValue(value: string): { key: SortKey; dir: "asc" | "desc" } {
  const [rawKey, rawDir] = value.split(":");
  const key = rawKey as SortKey;
  const dir = rawDir === "desc" ? "desc" : "asc";
  return { key, dir };
}

// El tipo de cliente no es ni accion principal, ni estado activo, ni salud: es
// una clasificacion. Por la regla del rojo unico y del verde reservado a lo
// sano, las cuatro variantes van en el mismo tono neutro.

const chipToStatus: Record<ChipKey, string | undefined> = {
  todos: undefined,
  activos: "activos",
  inactivos: "inactivos",
  sinVendedor: "sinvendedor",
};

const CHIP_KEYS = Object.keys(chipToStatus) as ChipKey[];

const TYPE_OPTIONS = [
  { value: "todos", label: "Todos los tipos" },
  { value: "Distribuidor", label: "Distribuidor" },
  { value: "Mayorista", label: "Mayorista" },
  { value: "Detallista", label: "Detallista" },
  { value: "Institucional", label: "Institucional" },
];

const TYPE_KEYS = TYPE_OPTIONS.map((option) => option.value);

export function ClientsPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const receipts = useReceipts();
  const canWrite = can("clients.write");

  const [salesReps, setSalesReps] = useState<{ id: number; name: string }[]>([]);
  // Misma politica que la ficha: los catalogos de apoyo degradan la pantalla,
  // no la tumban, pero su fallo se dice y se puede reintentar.
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const { modal, setModal, busyId, confirm, dialog } = useCatalogActions<Client>();

  // Criterios en la URL: volver desde la ficha deja el listado como estaba.
  const [search, setSearch] = useUrlState<string>("q", "");
  const [salesRepId, setSalesRepId] = useUrlState<string>("vendedor", "todos");
  const [type, setType] = useUrlState<string>("tipo", "todos", TYPE_KEYS);
  const [chip, setChip] = useUrlState<ChipKey>("estado", "todos", CHIP_KEYS);
  const [focus, setFocus] = useUrlState<FocusKey>("enfoque", "todos", FOCUS_KEYS);
  const { sort, sortOf, setSort } = useSort<SortKey>("actividad", "desc");
  const [pageSize, setPageSize] = useUrlNumber("tam", 10, PAGE_SIZES);

  const [reassigning, setReassigning] = useState<Client | null>(null);
  /**
   * RF-C7 en lote: la seleccion es sobre la pagina visible, no sobre todo el
   * filtro. `POST /api/clients/bulk/sales-rep` solo acepta una lista explicita
   * de ids, asi que "todos los filtrados" exigiria traer los ids de todas las
   * paginas — justo la consulta sin tope que la seccion 4.1 prohibe.
   */
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkReassigning, setBulkReassigning] = useState(false);

  const debouncedSearch = useDebouncedValue(search).trim();

  function loadReferenceData() {
    setReferenceError(null);
    return fetchAllPages((page, pageSize) =>
      staffApi.list({ page, pageSize, status: "activos", sort: "nombre", dir: "asc" }),
    )
      .then((items) =>
        setSalesReps(items.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}` }))),
      )
      .catch(() =>
        setReferenceError(
          "No se pudieron cargar los vendedores: la tabla los muestra como «—» y su filtro queda vacío.",
        ),
      );
  }

  useEffect(() => {
    void loadReferenceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data, isStale, error, setPage, refresh } = usePagedList<ClientQuery, ClientListResponse>({
    fetch: clientsApi.list,
    criteria: {
      pageSize,
      search: debouncedSearch || undefined,
      salesRepId: idParam(salesRepId),
      type: type === "todos" ? undefined : type,
      status: chipToStatus[chip],
      focus: focus === "todos" ? undefined : focus,
      sort: sort.key,
      dir: sort.dir,
    },
    fallbackError: "No se pudieron cargar los clientes",
    pageKey: "pagina",
  });

  const listLoading = data === null || isStale;
  const rows = isStale ? [] : (data?.items ?? []);
  const counts = data?.counts;
  const unfiltered =
    chip === "todos" &&
    focus === "todos" &&
    salesRepId === "todos" &&
    type === "todos" &&
    !debouncedSearch;

  /* Los tres criterios que viven detras del boton. */
  const filtrosPuestos =
    (salesRepId !== "todos" ? 1 : 0) +
    (type !== "todos" ? 1 : 0);

  /** Quita solo lo del panel; la busqueda y las pastillas no se tocan. */
  function clearNarrowFilters() {
    setSalesRepId("todos");
    setType("todos");
    setPage(1);
  }

  /** Quita los cinco recortes de una vez: es la salida del estado vacio. */
  function clearFilters() {
    setSearch("");
    setSalesRepId("todos");
    setType("todos");
    setChip("todos");
    setFocus("todos");
    setPage(1);
  }

  const sortMenuValue = `${sort.key}:${sort.dir}`;

  function handleSortMenuChange(value: string) {
    const next = parseSortValue(value);
    setSort(next);
    setPage(1);
  }

  function handleFocusChange(value: string) {
    setFocus(value as FocusKey);
    setPage(1);
  }

  // Se descarta la seleccion en cuanto cambian las filas visibles — otra
  // pagina, otro filtro, o un refresco que movio la lista. Anclarlo a las filas
  // y no a los criterios es lo que garantiza que `selected` nunca contenga un
  // id que la persona ya no tiene delante, que es como una reasignacion en lote
  // podria alcanzar a un cliente que nadie eligio.
  const visibleIdsKey = rows.map((client) => client.id).join(",");
  const [lastVisibleIdsKey, setLastVisibleIdsKey] = useState(visibleIdsKey);
  if (visibleIdsKey !== lastVisibleIdsKey) {
    setLastVisibleIdsKey(visibleIdsKey);
    setSelectedIds([]);
  }

  /**
   * Ascendente significa lo que la persona espera de cada columna: de la A a la
   * Z en nombre, codigo y territorio, y «activos primero» en estado. Esa ultima
   * es la razon de que el servidor invierta la direccion en su rama `estado`:
   * ordenar IsActive de menor a mayor pondria a los inactivos arriba, y nadie
   * abre el listado para ver primero lo que ya no opera.
   */


  function repName(id: number | null) {
    if (id === null) return null;
    return salesReps.find((rep) => rep.id === id)?.name ?? null;
  }

  const selected = rows.filter((client) => selectedIds.includes(client.id));
  const allPageSelected = rows.length > 0 && rows.every((client) => selectedIds.includes(client.id));
  const somePageSelected = rows.some((client) => selectedIds.includes(client.id));
  const pageState: boolean | "mixed" = allPageSelected ? true : somePageSelected ? "mixed" : false;

  const confirming = dialog !== null;

  useEffect(() => {
    if (selected.length === 0) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !bulkReassigning && modal === null && reassigning === null && !confirming) {
        setSelectedIds([]);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selected.length, bulkReassigning, modal, reassigning, confirming]);

  function toggleSelection(id: number) {
    setSelectedIds((previous) =>
      previous.includes(id) ? previous.filter((entry) => entry !== id) : [...previous, id],
    );
  }

  function toggleAllOnPage() {
    setSelectedIds((previous) => {
      if (allPageSelected) return previous.filter((id) => !rows.some((client) => client.id === id));
      const ids = new Set(previous);
      for (const client of rows) ids.add(client.id);
      return [...ids];
    });
  }

  function askToggle(client: Client) {
    const willDeactivate = client.isActive;
    confirm(client.id, {
      tone: "warn",
      icon: willDeactivate ? Ban : CheckCircle2,
      title: willDeactivate ? "Desactivar cliente" : "Reactivar cliente",
      description: willDeactivate ? (
        <>
          <strong className="font-semibold text-ink">{client.name}</strong> deja de poder recibir
          tickets nuevos. Su historial se conserva.
        </>
      ) : (
        <>
          <strong className="font-semibold text-ink">{client.name}</strong> vuelve a poder recibir
          tickets nuevos.
        </>
      ),
      confirmLabel: willDeactivate ? "Desactivar" : "Reactivar",
      onConfirm: async () => {
        try {
          if (client.isActive) {
            await clientsApi.deactivate(client.id);
            receipts.done({
              action: "desactivar-cliente",
              title: "Cliente desactivado",
              detail: `${client.name} ya no recibirá tickets nuevos`,
            });
          } else {
            await clientsApi.activate(client.id);
            receipts.done({
              action: "reactivar-cliente",
              title: "Cliente reactivado",
              detail: `${client.name} habilitado nuevamente`,
            });
          }
        } catch (err) {
          receipts.failed({
            action: "toggle-cliente",
            title: client.isActive ? "No se pudo desactivar el cliente" : "No se pudo reactivar el cliente",
            detail: err instanceof Error ? err.message : undefined,
          });
        }
        refresh();
      },
    });
  }

  /** RF-C4: el servidor rechaza con 409 si tiene contactos (o tickets, cuando exista esa tabla). */
  function askDelete(client: Client) {
    confirm(client.id, {
      tone: "danger",
      icon: Trash2,
      title: "Eliminar cliente",
      description: (
        <>
          Se quitará del directorio a{" "}
          <strong className="font-semibold text-ink">{client.name}</strong>. Tickets e historial
          vinculados se conservan; el código quedará libre para un cliente nuevo.
        </>
      ),
      confirmLabel: "Eliminar",
      onConfirm: async () => {
        try {
          await clientsApi.remove(client.id);
          receipts.done({
            action: "eliminar-cliente",
            title: "Cliente eliminado",
            detail: `${client.name} (${client.code})`,
          });
          refresh();
        } catch (err) {
          receipts.failed({
            action: "eliminar-cliente",
            title: "No se pudo eliminar el cliente",
            detail: err instanceof Error ? err.message : undefined,
          });
        }
      },
    });
  }

  return (
    <div>
      <ModuleHeader
        title="Clientes"
        summary={
          <HeaderCounts counts={counts} loadingLabel="Cargando el directorio de clientes…">
            {(counts) => (
              <>
                <HeaderTag
                  label={counts.all === 1 ? "cliente" : "clientes"}
                  count={counts.all}
                  active={chip === "todos"}
                  onClick={() => { setChip("todos"); setPage(1); }}
                  tone="neutral"
                  title="Mostrar todos los clientes"
                />
                <HeaderTag
                  label={counts.active === 1 ? "activo" : "activos"}
                  count={counts.active}
                  active={chip === "activos"}
                  onClick={() => { setChip("activos"); setPage(1); }}
                  tone="emerald"
                  dot
                  title="Filtrar por clientes activos"
                />
                <HeaderTag
                  label={counts.inactive === 1 ? "inactivo" : "inactivos"}
                  count={counts.inactive}
                  active={chip === "inactivos"}
                  onClick={() => { setChip("inactivos"); setPage(1); }}
                  tone="red"
                  dot
                  title="Filtrar por clientes inactivos"
                />
                <HeaderTag
                  label="sin vendedor"
                  count={counts.withoutSalesRep}
                  active={chip === "sinVendedor"}
                  onClick={() => { setChip("sinVendedor"); setPage(1); }}
                  tone="amber"
                  dot
                  title="Filtrar por clientes sin vendedor asignado"
                />
              </>
            )}
          </HeaderCounts>
        }
        action={
          canWrite && (
            <Button size="sm" onClick={() => setModal("nuevo")}>
              <Plus className="h-[15px] w-[15px]" />
              Nuevo cliente
            </Button>
          )
        }
      />

      {/* El reintento va en linea con su aviso, no debajo: apilados en columna
          eran dos bloques de dos alturas cada uno empujando la tabla. */}
      {referenceError !== null && (
        <ErrorRetry className="mb-3" onRetry={() => void loadReferenceData()}>{referenceError}</ErrorRetry>
      )}

      {error && (
        <ErrorRetry className="mb-3" onRetry={refresh}>{error}</ErrorRetry>
      )}

      {/* Un error de carga no deja el spinner girando debajo: la primera version
          mostraba el aviso y seguia fingiendo que la tabla estaba en camino. */}
      {/* Criterios, tabla y pie en UNA sola superficie. La barra se dibuja
          tambien mientras carga: perder el buscador durante el spinner es
          perder el control justo cuando alguien esta esperando. */}
      <ListPanel
        selection={
          canWrite
            ? {
                count: selected.length,
                pageState,
                onTogglePage: toggleAllOnPage,
                onClear: () => setSelectedIds([]),
                actions: [
                  {
                    key: "reassign",
                    label: "Reasignar vendedor",
                    icon: <UserCog aria-hidden className="h-3.5 w-3.5 text-subtle" />,
                    onClick: () => setBulkReassigning(true),
                  },
                ],
              }
            : undefined
        }
        toolbar={
          <div className="flex w-full flex-wrap items-center gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar por nombre, código, RNC o contacto…"
              className="w-[260px]"
            />

            <LookupFilterDropdown
              title="Seleccionar vendedor"
              aria-label="Filtrar por vendedor"
              placeholder="Todos los vendedores"
              searchPlaceholder="Buscar vendedor…"
              defaultIcon={<UserCheck className="h-3.5 w-3.5 text-subtle" />}
              value={salesRepId === "todos" ? "" : salesRepId}
              selectedLabel={salesRepId === "todos" ? null : repName(Number(salesRepId))}
              resolveSelectedLabel={resolveStaffLabel}
              search={searchSalesRepStaff}
              onChange={(value) => setSalesRepId(value === "" ? "todos" : value)}
            />

            <FilterDropdown
              title="Seleccionar tipo"
              aria-label="Filtrar por tipo"
              value={type}
              onChange={setType}
              defaultIcon={<Building2 className="h-3.5 w-3.5 text-subtle" />}
              options={TYPE_OPTIONS}
            />

            {(search || filtrosPuestos > 0 || focus !== "todos") && (
              <ClearFiltersButton
                onClick={() => {
                  setSearch("");
                  clearNarrowFilters();
                  setFocus("todos");
                }}
              />
            )}

            <div className="ml-auto">
              <ClientViewMenu
                sortValue={sortMenuValue}
                focusValue={focus}
                sortOptions={[...clientSortOptions]}
                focusOptions={[...clientFocusOptions]}
                onSortChange={handleSortMenuChange}
                onFocusChange={handleFocusChange}
              />
            </div>
          </div>
        }
        footer={
          <ServerPagination
            data={data}
            loading={listLoading}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            noun="clientes"
          />
        }
      >
        {listLoading ? (
          error === null && <TableSkeleton rows={pageSize} columns={9} />
        ) : rows.length === 0 ? (
          <EmptyResult
            message={
              unfiltered
                ? "Todavía no hay clientes registrados."
                : "Ningún cliente coincide con este filtro o búsqueda."
            }
            onClear={unfiltered ? undefined : clearFilters}
          />
        ) : (
          <div className="plf-results-in">
            <DataTable>
              <thead>
                <HeadRow>
                  {canWrite && (
                    <Th className="w-10 px-2 text-center">
                      <div className="flex items-center justify-center">
                        <SelectBox
                          checked={pageState}
                          label={
                            pageState === true
                              ? "Quitar la selección de esta página"
                              : "Seleccionar todos los clientes de esta página"
                          }
                          onToggle={toggleAllOnPage}
                        />
                      </div>
                    </Th>
                  )}
                  <Th sort={sortOf("nombre")}>Cliente</Th>
                  <Th sort={sortOf("codigo")}>Código</Th>
                  <Th sort={sortOf("tipo")}>Tipo</Th>
                  <Th>Vendedor</Th>
                  <Th sort={sortOf("tickets")}>Tickets</Th>
                  <Th sort={sortOf("contactos")}>Contactos</Th>
                  <Th sort={sortOf("estado")}>Estado</Th>
                  {canWrite && <Th className="w-24 text-right">Acciones</Th>}
                </HeadRow>
              </thead>

              <tbody>
                {rows.map((client) => {
                  const checked = selectedIds.includes(client.id);
                  return (
                  /* La fila entera lleva al detalle, como en la bandeja de
                     tickets. El resaltado al pasar por encima ya prometia que
                     la fila respondia; sin esto, la promesa obligaba a acertarle
                     al enlace del nombre, que es el 15 % del ancho de la fila.
                     Los controles de dentro paran la propagacion: quien marca
                     una casilla o pulsa una accion no queria viajar. */
                  <Row
                    key={client.id}
                    busy={busyId === client.id}
                    data-checked={checked}
                    onClick={() => navigate(`/clientes/${client.id}`)}
                    className="cursor-pointer"
                  >
                    {canWrite && (
                      <Td className="w-10 px-2 text-center" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center justify-center">
                          <SelectBox
                            checked={checked}
                            label={`Seleccionar ${client.name}`}
                            onToggle={() => toggleSelection(client.id)}
                          />
                        </div>
                      </Td>
                    )}
                    <Td>
                      <Link
                        to={`/clientes/${client.id}`}
                        className="flex items-center gap-2.5 rounded-edge underline-offset-4 outline-none
                          focus-visible:ring-3 focus-visible:ring-brand-red/20"
                      >
                        <Avatar name={client.name} seed={client.id} />
                        <span className="whitespace-nowrap text-[13px] font-medium text-ink hover:underline">
                          {client.name}
                        </span>
                      </Link>
                    </Td>
                    <Td>
                      <span className="text-[12.5px] tabular-nums text-brand-gray">{client.code}</span>
                    </Td>
                    <Td>
                      <Badge tone="neutral">{client.type}</Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-[12.5px] text-brand-gray">
                      <span
                        className="block max-w-[170px] truncate"
                        title={repName(client.salesRepStaffId) ?? undefined}
                      >
                        {repName(client.salesRepStaffId) ?? <span className="text-warn">Sin vendedor</span>}
                      </span>
                    </Td>
                    <Td>
                      {client.ticketCount > 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-[12.5px] tabular-nums text-brand-gray">
                          <Ticket aria-hidden className="h-3.5 w-3.5 text-faint" />
                          {client.ticketCount}
                        </span>
                      ) : (
                        <span className="text-[12.5px] text-faint">0</span>
                      )}
                    </Td>
                    <Td>
                      {client.contactCount > 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-[12.5px] tabular-nums text-brand-gray">
                          <Users aria-hidden className="h-3.5 w-3.5 text-faint" />
                          {client.contactCount}
                        </span>
                      ) : client.contactPersonName || client.phone || client.email ? (
                        <span
                          className="text-[12.5px] text-brand-gray"
                          title="Teléfono, correo o persona en la ficha del cliente"
                        >
                          En ficha
                        </span>
                      ) : (
                        <span className="text-[12.5px] text-faint">Ninguno</span>
                      )}
                    </Td>
                    <Td>
                      <StatusDot active={client.isActive} />
                    </Td>
                    {canWrite && (
                      /* `pl-0`: los iconos van pegados a la derecha, asi que el
                         relleno izquierdo de la celda son 14 px muertos — y eran
                         justo los que empujaban la tabla mas alla del panel y
                         encendian una barra de scroll horizontal por 10 px. */
                      <Td className="pl-0" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <RowAction
                            label={`Reasignar vendedor de ${client.name}`}
                            icon={UserCog}
                            onClick={() => setReassigning(client)}
                            disabled={busyId === client.id}
                          />
                          <RowAction
                            label={`Editar ${client.name}`}
                            icon={Pencil}
                            onClick={() => setModal(client)}
                            disabled={busyId === client.id}
                          />
                          <RowAction
                            label={client.isActive ? `Desactivar ${client.name}` : `Reactivar ${client.name}`}
                            icon={client.isActive ? Ban : CheckCircle2}
                            onClick={() => askToggle(client)}
                            disabled={busyId === client.id}
                            danger={client.isActive}
                          />
                          <RowAction
                            label={`Eliminar ${client.name}`}
                            icon={Trash2}
                            onClick={() => askDelete(client)}
                            disabled={busyId === client.id}
                            danger
                          />
                        </div>
                      </Td>
                    )}
                  </Row>
                  );
                })}
              </tbody>
            </DataTable>
          </div>
        )}
      </ListPanel>

      {modal !== null && (
        <ClientModal
          client={modal === "nuevo" ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={(savedClient) => {
            const isEdit = modal !== "nuevo";
            receipts.done({
              action: isEdit ? "editar-cliente" : "crear-cliente",
              title: isEdit ? "Cliente actualizado" : "Cliente creado exitosamente",
              detail: `${savedClient.name} (${savedClient.code})`,
            });
            refresh();
          }}
        />
      )}

      {reassigning && (
        <ReassignSalesRepModal
          client={reassigning}
          onClose={() => setReassigning(null)}
          onSaved={() => {
            receipts.done({
              action: "reasignar-vendedor",
              title: "Vendedor reasignado",
              detail: `Se actualizó el vendedor de ${reassigning.name}`,
            });
            refresh();
          }}
        />
      )}

      {bulkReassigning && (
        <BulkReassignSalesRepModal
          clients={selected}
          onClose={() => setBulkReassigning(false)}
          onSaved={() => {
            const count = selected.length;
            receipts.done({
              action: "reasignar-vendedor-lote",
              title: "Vendedores reasignados",
              detail: `${count} ${count === 1 ? "cliente actualizado" : "clientes actualizados"}`,
            });
            setSelectedIds([]);
            refresh();
          }}
        />
      )}

      {dialog}
    </div>
  );
}
