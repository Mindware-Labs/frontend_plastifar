import { Pencil, Plus, Power, Trash2, UserCog, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { clientsApi, type ClientQuery } from "../../api/clients";
import { staffApi } from "../../api/staff";
import { territoriesApi } from "../../api/territories";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ColumnPicker, type ColumnOption } from "../../components/ui/ColumnPicker";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { FilterChip } from "../../components/ui/FilterChip";
import { Pagination } from "../../components/ui/Pagination";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { Select } from "../../components/ui/Select";
import { Spinner } from "../../components/ui/Spinner";
import { StatusDot } from "../../components/ui/StatusDot";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import type { Client, ClientListResponse, Territory } from "../../types/clients";
import { BulkReassignSalesRepModal } from "./BulkReassignSalesRepModal";
import { ClientModal } from "./ClientModal";
import { ReassignSalesRepModal } from "./ReassignSalesRepModal";

type ChipKey = "todos" | "activos" | "inactivos" | "sinVendedor";

const COLUMNS: ColumnOption[] = [
  { id: "cliente", label: "Cliente", locked: true },
  { id: "codigo", label: "Código" },
  { id: "tipo", label: "Tipo" },
  { id: "territorio", label: "Territorio" },
  { id: "vendedor", label: "Vendedor" },
  { id: "contactos", label: "Contactos" },
  { id: "estado", label: "Estado" },
];

const typeTone: Record<Client["type"], "red" | "green" | "neutral"> = {
  Distribuidor: "red",
  Mayorista: "neutral",
  Detallista: "neutral",
  Institucional: "green",
};

const chipToStatus: Record<ChipKey, string | undefined> = {
  todos: undefined,
  activos: "activos",
  inactivos: "inactivos",
  sinVendedor: "sinvendedor",
};

export function ClientsPage() {
  const { can } = usePermissions();
  const canWrite = can("clients.write");

  const [territories, setTerritories] = useState<Territory[]>([]);
  const [salesReps, setSalesReps] = useState<{ id: number; name: string }[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [territoryId, setTerritoryId] = useState("todos");
  const [salesRepId, setSalesRepId] = useState("todos");
  const [type, setType] = useState("todos");
  const [chip, setChip] = useState<ChipKey>("todos");
  const [pageSize, setPageSize] = useState(10);

  const [modal, setModal] = useState<"nuevo" | Client | null>(null);
  const [reassigning, setReassigning] = useState<Client | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(COLUMNS.map((c) => c.id));
  /** RF-C7 en lote: seleccion sobre el filtro actual, no sobre la pagina. */
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkReassigning, setBulkReassigning] = useState(false);

  const debouncedSearch = useDebouncedValue(search).trim();

  function isVisible(id: string) {
    return visibleColumns.includes(id);
  }

  useEffect(() => {
    territoriesApi
      .list()
      .then((res) => setTerritories(res.items))
      .catch(() => setTerritories([]));

    staffApi
      .list({ page: 1, pageSize: 100, status: "activos", sort: "nombre", dir: "asc" })
      .then((res) => setSalesReps(res.items.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}` }))))
      .catch(() => setSalesReps([]));
  }, []);

  const { data, isStale, error, setPage, refresh } = usePagedList<ClientQuery, ClientListResponse>({
    fetch: clientsApi.list,
    criteria: {
      pageSize,
      search: debouncedSearch || undefined,
      territoryId: territoryId === "todos" ? undefined : Number(territoryId),
      salesRepId: salesRepId === "todos" ? undefined : Number(salesRepId),
      type: type === "todos" ? undefined : type,
      status: chipToStatus[chip],
    },
    fallbackError: "No se pudieron cargar los clientes",
  });

  const rows = data?.items ?? [];
  const counts = data?.counts;
  const unfiltered =
    chip === "todos" && territoryId === "todos" && salesRepId === "todos" && type === "todos" && !debouncedSearch;

  // La seleccion es sobre el filtro actual (RF-C7): al cambiar de pagina o de
  // filtro se descarta, para que "reasignar" nunca alcance a un cliente que la
  // persona ya no tiene en pantalla.
  const criteriaKey = JSON.stringify([debouncedSearch, territoryId, salesRepId, type, chip, data?.page]);
  const [lastCriteriaKey, setLastCriteriaKey] = useState(criteriaKey);
  if (criteriaKey !== lastCriteriaKey) {
    setLastCriteriaKey(criteriaKey);
    setSelectedIds([]);
  }

  function territoryName(id: number) {
    return territories.find((territory) => territory.id === id)?.name ?? "—";
  }

  function repName(id: number | null) {
    if (id === null) return null;
    return salesReps.find((rep) => rep.id === id)?.name ?? null;
  }

  const selected = rows.filter((client) => selectedIds.includes(client.id));
  const allPageSelected = rows.length > 0 && rows.every((client) => selectedIds.includes(client.id));

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

  async function runOnRow(id: number, action: () => Promise<void>) {
    setBusyId(id);
    try {
      await action();
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  function askToggle(client: Client) {
    setConfirmation({
      tone: "warn",
      icon: Power,
      title: client.isActive ? "Desactivar cliente" : "Reactivar cliente",
      description: client.isActive ? (
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
      confirmLabel: client.isActive ? "Desactivar" : "Reactivar",
      onConfirm: () =>
        runOnRow(client.id, () =>
          client.isActive ? clientsApi.deactivate(client.id) : clientsApi.activate(client.id),
        ),
    });
  }

  /** RF-C4: el servidor rechaza con 409 si tiene contactos (o tickets, cuando exista esa tabla). */
  function askDelete(client: Client) {
    setConfirmation({
      tone: "danger",
      icon: Trash2,
      title: "Eliminar cliente",
      description: (
        <>
          Se eliminará permanentemente a{" "}
          <strong className="font-semibold text-ink">{client.name}</strong>. Esta acción no se puede
          deshacer.
        </>
      ),
      confirmLabel: "Eliminar",
      onConfirm: () => runOnRow(client.id, () => clientsApi.remove(client.id)),
    });
  }

  return (
    <div>
      <ModuleHeader
        action={
          canWrite && (
            <Button size="sm" onClick={() => setModal("nuevo")}>
              <Plus className="h-[15px] w-[15px]" />
              Nuevo cliente
            </Button>
          )
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nombre, código o RNC…"
          className="w-[260px]"
        />

        <Select
          size="sm"
          className="w-[180px]"
          aria-label="Filtrar por territorio"
          value={territoryId}
          onChange={setTerritoryId}
          options={[
            { value: "todos", label: "Todos los territorios" },
            ...territories.map((territory) => ({ value: String(territory.id), label: territory.name })),
          ]}
        />

        <Select
          size="sm"
          className="w-[180px]"
          aria-label="Filtrar por vendedor"
          value={salesRepId}
          onChange={setSalesRepId}
          options={[
            { value: "todos", label: "Todos los vendedores" },
            ...salesReps.map((rep) => ({ value: String(rep.id), label: rep.name })),
          ]}
        />

        <Select
          size="sm"
          className="w-[170px]"
          aria-label="Filtrar por tipo"
          value={type}
          onChange={setType}
          options={[
            { value: "todos", label: "Todos los tipos" },
            { value: "Distribuidor", label: "Distribuidor" },
            { value: "Mayorista", label: "Mayorista" },
            { value: "Detallista", label: "Detallista" },
            { value: "Institucional", label: "Institucional" },
          ]}
        />

        <span aria-hidden className="mx-1 h-5 w-px bg-line" />

        <FilterChip label="Todos" count={counts?.all ?? 0} active={chip === "todos"} onClick={() => setChip("todos")} />
        <FilterChip
          label="Activos"
          count={counts?.active ?? 0}
          active={chip === "activos"}
          onClick={() => setChip("activos")}
        />
        <FilterChip
          label="Inactivos"
          count={counts?.inactive ?? 0}
          active={chip === "inactivos"}
          onClick={() => setChip("inactivos")}
        />
        <FilterChip
          label="Sin vendedor"
          count={counts?.withoutSalesRep ?? 0}
          active={chip === "sinVendedor"}
          onClick={() => setChip("sinVendedor")}
        />

        <div className="ml-auto">
          <ColumnPicker columns={COLUMNS} visible={visibleColumns} onChange={setVisibleColumns} label="Columnas" />
        </div>
      </div>

      {error && (
        <div className="mb-3">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {canWrite && selected.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 border-y border-line bg-canvas px-3 py-2">
          <span className="text-[12.5px] font-medium text-ink">
            {selected.length} {selected.length === 1 ? "cliente seleccionado" : "clientes seleccionados"}
          </span>
          <Button size="sm" variant="secondary" onClick={() => setBulkReassigning(true)}>
            <UserCog className="h-[15px] w-[15px]" />
            Reasignar vendedor
          </Button>
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="rounded-edge text-[12.5px] text-muted underline-offset-4 transition-colors
              hover:text-ink hover:underline"
          >
            Limpiar selección
          </button>
        </div>
      )}

      {data === null ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <div className={`transition-opacity ${isStale ? "opacity-60" : ""}`}>
          {rows.length === 0 ? (
            <p className="py-14 text-center text-[13.5px] text-faint">
              {unfiltered
                ? "Todavía no hay clientes registrados."
                : "Ningún cliente coincide con este filtro o búsqueda."}
            </p>
          ) : (
            <DataTable>
              <thead>
                <HeadRow>
                  {canWrite && (
                    <Th className="w-9">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={toggleAllOnPage}
                        aria-label={
                          allPageSelected
                            ? "Quitar la selección de esta página"
                            : "Seleccionar todos los clientes de esta página"
                        }
                        className="h-4 w-4 rounded-[2px] border-line-strong accent-brand-red"
                      />
                    </Th>
                  )}
                  <Th>Cliente</Th>
                  {isVisible("codigo") && <Th>Código</Th>}
                  {isVisible("tipo") && <Th>Tipo</Th>}
                  {isVisible("territorio") && <Th>Territorio</Th>}
                  {isVisible("vendedor") && <Th>Vendedor</Th>}
                  {isVisible("contactos") && <Th>Contactos</Th>}
                  {isVisible("estado") && <Th>Estado</Th>}
                  {canWrite && <Th className="w-32 text-right">Acciones</Th>}
                </HeadRow>
              </thead>

              <tbody>
                {rows.map((client) => (
                  <Row key={client.id} busy={busyId === client.id}>
                    {canWrite && (
                      <Td>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(client.id)}
                          onChange={() => toggleSelection(client.id)}
                          aria-label={`Seleccionar ${client.name}`}
                          className="h-4 w-4 rounded-[2px] border-line-strong accent-brand-red"
                        />
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
                    {isVisible("codigo") && (
                      <Td>
                        <span className="font-mono text-[12px] text-brand-gray">{client.code}</span>
                      </Td>
                    )}
                    {isVisible("tipo") && (
                      <Td>
                        <Badge tone={typeTone[client.type]}>{client.type}</Badge>
                      </Td>
                    )}
                    {isVisible("territorio") && (
                      <Td className="text-[12.5px] text-brand-gray">{territoryName(client.territoryId)}</Td>
                    )}
                    {isVisible("vendedor") && (
                      <Td className="text-[12.5px] text-brand-gray">
                        {repName(client.salesRepStaffId) ?? <span className="text-faint">Sin vendedor</span>}
                      </Td>
                    )}
                    {isVisible("contactos") && (
                      <Td>
                        {client.contactCount === 0 ? (
                          <span className="text-[12.5px] text-faint">Ninguno</span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-brand-gray">
                            <Users aria-hidden className="h-3.5 w-3.5 text-faint" />
                            {client.contactCount}
                          </span>
                        )}
                      </Td>
                    )}
                    {isVisible("estado") && (
                      <Td>
                        <StatusDot active={client.isActive} />
                      </Td>
                    )}
                    {canWrite && (
                      <Td>
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
                            icon={Power}
                            onClick={() => askToggle(client)}
                            disabled={busyId === client.id}
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
                ))}
              </tbody>
            </DataTable>
          )}

          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            totalPages={data.totalPages}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            noun="clientes"
          />
        </div>
      )}

      {modal !== null && (
        <ClientModal
          client={modal === "nuevo" ? undefined : modal}
          territories={territories}
          salesReps={salesReps}
          onClose={() => setModal(null)}
          onSaved={refresh}
        />
      )}

      {reassigning && (
        <ReassignSalesRepModal
          client={reassigning}
          salesReps={salesReps}
          onClose={() => setReassigning(null)}
          onSaved={refresh}
        />
      )}

      {bulkReassigning && (
        <BulkReassignSalesRepModal
          clients={selected}
          salesReps={salesReps}
          onClose={() => setBulkReassigning(false)}
          onSaved={() => {
            setSelectedIds([]);
            refresh();
          }}
        />
      )}

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </div>
  );
}
