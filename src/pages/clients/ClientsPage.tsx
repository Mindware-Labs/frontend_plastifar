import { Ban, Pencil, Plus, Power, Trash2, UserCog } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import { Tooltip } from "../../components/ui/Tooltip";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useLocalPage } from "../../hooks/useLocalPage";
import { upsertById } from "../../lib/catalog";
import { usePermissions } from "../../hooks/usePermissions";
import { clientsMock } from "../../mocks/clients";
import type { Client, Contact, Territory } from "../../types/clients";
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

export function ClientsPage() {
  const { can } = usePermissions();
  const canWrite = can("clients.write");

  const [clients, setClients] = useState<Client[] | null>(null);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [territoryId, setTerritoryId] = useState("todos");
  const [salesRepId, setSalesRepId] = useState("todos");
  const [type, setType] = useState("todos");
  const [chip, setChip] = useState<ChipKey>("todos");

  const [modal, setModal] = useState<"nuevo" | Client | null>(null);
  const [reassigning, setReassigning] = useState<Client | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(COLUMNS.map((c) => c.id));
  /** RF-C7 en lote: seleccion sobre el filtro actual, no sobre la pagina. */
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkReassigning, setBulkReassigning] = useState(false);

  const debouncedSearch = useDebouncedValue(search).trim().toLowerCase();
  const salesReps = clientsMock.salesReps();
  const contactsByClient = useMemo(() => clientsMock.contactsByClient(), []);

  function isVisible(id: string) {
    return visibleColumns.includes(id);
  }

  useEffect(() => {
    Promise.all([clientsMock.clients(), clientsMock.territories()])
      .then(([loadedClients, loadedTerritories]) => {
        setClients(loadedClients);
        setTerritories(loadedTerritories);
      })
      .catch(() => setError("No se pudieron cargar los clientes"));
  }, []);

  const all = useMemo(() => clients ?? [], [clients]);
  const activeCount = all.filter((client) => client.isActive).length;
  const noRepCount = all.filter((client) => client.salesRepStaffId === null).length;

  // La seleccion es sobre el filtro actual (RF-C7): cambiar el filtro deja
  // atras ids que ya no se ven, y "reasignar" nunca debe alcanzar a un
  // cliente que el usuario ya no tiene en pantalla. Se ajusta durante el
  // render, como useLocalPage, y no en un efecto aparte.
  const filterCriteria = JSON.stringify([debouncedSearch, territoryId, salesRepId, type, chip]);
  const [lastFilterCriteria, setLastFilterCriteria] = useState(filterCriteria);
  if (filterCriteria !== lastFilterCriteria) {
    setLastFilterCriteria(filterCriteria);
    setSelectedIds([]);
  }

  function territoryName(id: number) {
    return territories.find((territory) => territory.id === id)?.name ?? "—";
  }

  function repName(id: number | null) {
    if (id === null) return null;
    return salesReps.find((rep) => rep.id === id)?.name ?? null;
  }

  const rows = all.filter((client) => {
    const byChip =
      chip === "todos" ||
      (chip === "activos" && client.isActive) ||
      (chip === "inactivos" && !client.isActive) ||
      (chip === "sinVendedor" && client.salesRepStaffId === null);

    const byTerritory = territoryId === "todos" || client.territoryId === Number(territoryId);
    const bySalesRep = salesRepId === "todos" || client.salesRepStaffId === Number(salesRepId);
    const byType = type === "todos" || client.type === type;

    const bySearch =
      debouncedSearch === "" ||
      client.name.toLowerCase().includes(debouncedSearch) ||
      client.code.toLowerCase().includes(debouncedSearch) ||
      (client.taxId?.toLowerCase().includes(debouncedSearch) ?? false);

    return byChip && byTerritory && bySalesRep && byType && bySearch;
  });

  // RF-C1 pide el listado paginado. El corte lo hace la vista solo mientras no
  // exista /api/clients: el endpoint devuelve la pagina ya cortada en SQL, con
  // total, totalPages y counts (anexo 12.1).
  const { page, pageSize, total, totalPages, pageRows, setPage, changePageSize } = useLocalPage(
    rows,
    filterCriteria,
  );

  const selected = all.filter((client) => selectedIds.includes(client.id));
  const allFilteredSelected = rows.length > 0 && rows.every((client) => selectedIds.includes(client.id));

  function toggleSelection(id: number) {
    setSelectedIds((previous) =>
      previous.includes(id) ? previous.filter((entry) => entry !== id) : [...previous, id],
    );
  }

  /** La cabecera marca lo que hay bajo el filtro, no solo lo que se ve: una
   *  reasignacion de cartera alcanza a las cinco paginas, no a la primera. */
  function toggleAllFiltered() {
    setSelectedIds(allFilteredSelected ? [] : rows.map((client) => client.id));
  }

  function upsert(item: Client) {
    setClients((previous) => upsertById(previous ?? [], item));
  }

  function askToggle(client: Client) {
    setConfirmation({
      tone: "warn",
      icon: Power,
      title: client.isActive ? "Desactivar cliente" : "Reactivar cliente",
      description: client.isActive ? (
        <>
          <strong className="font-semibold text-ink">{client.name}</strong> deja de poder recibir
          tickets nuevos. Su historial y sus {client.ticketCount} tickets existentes se conservan.
        </>
      ) : (
        <>
          <strong className="font-semibold text-ink">{client.name}</strong> vuelve a poder recibir
          tickets nuevos.
        </>
      ),
      confirmLabel: client.isActive ? "Desactivar" : "Reactivar",
      onConfirm: () => upsert({ ...client, isActive: !client.isActive }),
    });
  }

  /** RF-C4: un cliente con tickets no se elimina, se desactiva. */
  function askDelete(client: Client) {
    if (client.ticketCount > 0) {
      setConfirmation({
        tone: "warn",
        icon: Ban,
        title: "No se puede eliminar",
        description: (
          <>
            <strong className="font-semibold text-ink">{client.name}</strong> tiene{" "}
            {client.ticketCount} tickets registrados; no se puede eliminar, solo desactivar.
          </>
        ),
        confirmLabel: "Entendido",
        cancelLabel: "Cerrar",
        onConfirm: () => {},
      });
      return;
    }

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
      onConfirm: () => setClients((previous) => (previous ?? []).filter((c) => c.id !== client.id)),
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

        <FilterChip
          label="Todos"
          count={all.length}
          active={chip === "todos"}
          onClick={() => setChip("todos")}
        />
        <FilterChip
          label="Activos"
          count={activeCount}
          active={chip === "activos"}
          onClick={() => setChip("activos")}
        />
        <FilterChip
          label="Inactivos"
          count={all.length - activeCount}
          active={chip === "inactivos"}
          onClick={() => setChip("inactivos")}
        />
        <FilterChip
          label="Sin vendedor"
          count={noRepCount}
          active={chip === "sinVendedor"}
          onClick={() => setChip("sinVendedor")}
        />

        <div className="ml-auto">
          <ColumnPicker
            columns={COLUMNS}
            visible={visibleColumns}
            onChange={setVisibleColumns}
            label="Columnas"
          />
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

      {clients === null ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-14 text-center text-[13.5px] text-faint">
          {all.length === 0
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
                    checked={allFilteredSelected}
                    onChange={toggleAllFiltered}
                    aria-label={
                      allFilteredSelected
                        ? "Quitar la selección de todos los clientes filtrados"
                        : "Seleccionar todos los clientes filtrados"
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
            {pageRows.map((client) => {
              const contacts = contactsByClient[client.id] ?? [];
              const shown = contacts.slice(0, 3);
              const overflow = contacts.length - shown.length;

              return (
              <Row key={client.id}>
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
                    {contacts.length === 0 ? (
                      <span className="text-[12.5px] text-faint">Ninguno</span>
                    ) : (
                      <div className="flex items-center -space-x-1.5">
                        {shown.map((contact) => (
                          <Tooltip
                            key={contact.id}
                            content={<ContactTooltipContent contact={contact} />}
                          >
                            <span className="ring-2 ring-white rounded-full">
                              <Avatar
                                name={`${contact.firstName} ${contact.lastName}`}
                                seed={contact.id}
                                size={24}
                              />
                            </span>
                          </Tooltip>
                        ))}
                        {overflow > 0 && (
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-fill ring-2 ring-white text-[10px] font-semibold text-brand-gray">
                            +{overflow}
                          </span>
                        )}
                      </div>
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
                      />
                      <RowAction
                        label={`Editar ${client.name}`}
                        icon={Pencil}
                        onClick={() => setModal(client)}
                      />
                      <RowAction
                        label={client.isActive ? `Desactivar ${client.name}` : `Reactivar ${client.name}`}
                        icon={Power}
                        onClick={() => askToggle(client)}
                      />
                      <RowAction
                        label={`Eliminar ${client.name}`}
                        icon={Trash2}
                        onClick={() => askDelete(client)}
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
      )}

      {clients !== null && rows.length > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={changePageSize}
          noun="clientes"
        />
      )}

      {modal !== null && (
        <ClientModal
          client={modal === "nuevo" ? undefined : modal}
          existing={all}
          territories={territories}
          salesReps={salesReps}
          onClose={() => setModal(null)}
          onSave={upsert}
        />
      )}

      {reassigning && (
        <ReassignSalesRepModal
          client={reassigning}
          salesReps={salesReps}
          onClose={() => setReassigning(null)}
          onSave={(salesRepStaffId) => upsert({ ...reassigning, salesRepStaffId })}
        />
      )}

      {bulkReassigning && (
        <BulkReassignSalesRepModal
          clients={selected}
          salesReps={salesReps}
          onClose={() => setBulkReassigning(false)}
          onSave={(salesRepStaffId) => {
            setClients((previous) =>
              (previous ?? []).map((client) =>
                selectedIds.includes(client.id) ? { ...client, salesRepStaffId } : client,
              ),
            );
            setSelectedIds([]);
          }}
        />
      )}

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </div>
  );
}

/** Lo que se ve al pasar el mouse sobre un avatar de contacto en el listado. */
function ContactTooltipContent({ contact }: { contact: Contact }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="font-semibold">
        {contact.firstName} {contact.lastName}
        {contact.isPrimary && " · Principal"}
      </span>
      {contact.position && <span className="text-faint">{contact.position}</span>}
      {contact.email && <span className="text-faint">{contact.email}</span>}
    </span>
  );
}
