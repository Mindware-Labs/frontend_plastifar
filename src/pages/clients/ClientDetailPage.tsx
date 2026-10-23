import { Pencil, Plus, Power, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import {
  clientsApi,
  type ContactCounts,
  type ContactListResponse,
  type ContactQuery,
} from "../../api/clients";
import { fetchAllPages } from "../../api/paging";
import { territoriesApi } from "../../api/territories";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { DetailGroup, DetailRow, DetailTable } from "../../components/ui/DetailTable";
import { ErrorRetry } from "../../components/ui/ErrorRetry";
import { ClearFiltersButton } from "../../components/ui/FilterDropdown";
import { ListPanel } from "../../components/ui/ListPanel";
import { PageSpinner } from "../../components/ui/PageSpinner";
import { Pagination } from "../../components/ui/Pagination";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { StatusDot } from "../../components/ui/StatusDot";
import { useDynamicBreadcrumb } from "../../context/useBreadcrumb";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import { resolveStaffLabel } from "../../lib/lookups";
import type { Client, Contact, Territory } from "../../types/clients";
import { ClientModal } from "./ClientModal";
import { ContactModal } from "./ContactModal";

interface ClientDetailPageProps {
  section: "datos" | "contactos" | "historial";
}

/** Las tres que sabe filtrar `ContactsController.List`; el resto no existe. */
type ContactChipKey = "todos" | "activos" | "inactivos";

const contactChipToStatus: Record<ContactChipKey, string | undefined> = {
  todos: undefined,
  activos: "activos",
  inactivos: "inactivos",
};

// Declarativas como en el listado de clientes: una sola fuente para etiqueta y
// contador es lo que evita que los numeros se desalineen al tocar una pastilla.
const contactChips: { key: ContactChipKey; label: string; countKey: keyof ContactCounts }[] = [
  { key: "todos", label: "Todos", countKey: "all" },
  { key: "activos", label: "Activos", countKey: "active" },
  { key: "inactivos", label: "Inactivos", countKey: "inactive" },
];

export function ClientDetailPage({ section }: ClientDetailPageProps) {
  const { id } = useParams();
  const { can } = usePermissions();
  const canWrite = can("clients.write");

  const [client, setClient] = useState<Client | null>(null);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [salesRepName, setSalesRepName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Los catalogos de apoyo solo alimentan nombres para mostrar: que fallen no
  // justifica borrar una ficha que si cargo, pero tampoco callarse.
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [busyContactId, setBusyContactId] = useState<number | null>(null);

  const [editingClient, setEditingClient] = useState(false);
  const [contactModal, setContactModal] = useState<"nuevo" | Contact | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);

  const [contactSearch, setContactSearch] = useState("");
  const [contactChip, setContactChip] = useState<ContactChipKey>("todos");
  const [contactPageSize, setContactPageSize] = useState(10);

  const clientId = Number(id);
  useDynamicBreadcrumb(client?.name ?? null);

  const debouncedContactSearch = useDebouncedValue(contactSearch).trim();

  /**
   * La pestana de Contactos pagina en servidor (seccion 4.1) y no reutiliza el
   * arreglo `contacts` de la ficha: ese viene acotado a la primera pagina, sin
   * total ni contadores, asi que como origen de la tabla mentiria.
   */
  const {
    data: contactPage,
    isStale: contactsStale,
    error: contactsError,
    setPage: setContactPage,
    refresh: refreshContacts,
  } = usePagedList<ContactQuery, ContactListResponse>({
    fetch: (query) => clientsApi.contacts.list(clientId, query),
    criteria: {
      pageSize: contactPageSize,
      search: debouncedContactSearch || undefined,
      status: contactChipToStatus[contactChip],
    },
    fallbackError: "No se pudieron cargar los contactos",
  });

  const contactRows = contactPage?.items ?? [];
  const contactCounts = contactPage?.counts;
  const contactsUnfiltered = contactChip === "todos" && !debouncedContactSearch;
  /** El total del servidor; `contactRows.length` es el largo de una pagina. */
  const totalContacts = contactCounts?.all ?? client?.contactCount ?? 0;

  function reload() {
    return clientsApi.get(clientId).then(({ client: loaded }) => setClient(loaded));
  }

  /**
   * Refresco tras una mutacion de contacto: se relee la pagina —marcar un nuevo
   * principal degrada a otra fila que puede estar en otra pagina, y crear o
   * desactivar mueve los contadores—, y ademas la ficha, porque `contactCount`
   * vive en el registro del cliente. Parchear el arreglo en memoria dejaria la
   * estrella duplicada hasta el proximo viaje al servidor.
   */
  function refreshAfterContactChange() {
    refreshContacts();
    return reload().catch((err) => {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar la ficha del cliente");
    });
  }

  function loadRecord() {
    setError(null);
    return reload().catch((err) => {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar la ficha del cliente");
    });
  }

  function loadReferenceData() {
    setReferenceError(null);
    return Promise.all([
      // Catalogo acotado: se recorre entero, porque el territorio de esta ficha
      // puede estar mas alla de la primera pagina y la ficha lo mostraba como «—».
      fetchAllPages<Territory>((page, pageSize) => territoriesApi.list({ page, pageSize })).then(
        setTerritories,
      ),
    ]).catch(() =>
      setReferenceError(
        "No se pudieron cargar los territorios: abajo aparecen sin nombre, y el diálogo de edición se abrirá con esa lista vacía.",
      ),
    );
  }

  useEffect(() => {
    if (!id) return;
    void loadRecord();
    void loadReferenceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function territoryName(territoryId: number) {
    return territories.find((territory) => territory.id === territoryId)?.name ?? "—";
  }

  /**
   * El nombre del vendedor se resuelve por su id, no buscandolo en un catalogo
   * precargado: el personal no tiene tope y quien no cupiera en las primeras
   * cien filas se pintaba como «Sin vendedor» siendo falso. Aqui solo hace falta
   * uno, asi que se pide uno.
   */
  useEffect(() => {
    const staffId = client?.salesRepStaffId ?? null;
    if (staffId === null) {
      setSalesRepName(null);
      return;
    }

    let cancelled = false;
    resolveStaffLabel(String(staffId))
      .then((name) => {
        if (!cancelled) setSalesRepName(name);
      })
      .catch(() => {
        // Se queda sin nombre; la ficha ya avisa del fallo de referencias.
        if (!cancelled) setSalesRepName(null);
      });

    return () => {
      cancelled = true;
    };
  }, [client?.salesRepStaffId]);

  async function makePrimary(contact: Contact) {
    setBusyContactId(contact.id);
    setError(null);
    try {
      await clientsApi.contacts.makePrimary(contact.id);
      await refreshAfterContactChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo marcar como principal");
    } finally {
      setBusyContactId(null);
    }
  }

  function askDeactivateContact(contact: Contact) {
    setConfirmation({
      tone: "warn",
      icon: Power,
      title: contact.isActive ? "Desactivar contacto" : "Reactivar contacto",
      description: contact.isActive ? (
        <>
          <strong className="font-semibold text-ink">
            {contact.firstName} {contact.lastName}
          </strong>{" "}
          deja de ofrecerse al abrir o asignar un ticket de este cliente.
        </>
      ) : (
        <>
          <strong className="font-semibold text-ink">
            {contact.firstName} {contact.lastName}
          </strong>{" "}
          vuelve a estar disponible para este cliente.
        </>
      ),
      confirmLabel: contact.isActive ? "Desactivar" : "Reactivar",
      onConfirm: async () => {
        setBusyContactId(contact.id);
        try {
          await clientsApi.contacts.update(contact.id, {
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email,
            phone: contact.phone,
            position: contact.position,
            isPrimary: contact.isPrimary,
            isActive: !contact.isActive,
          });
          await refreshAfterContactChange();
        } finally {
          setBusyContactId(null);
        }
      },
    });
  }

  const sections = [
    { label: "Datos", to: `/clientes/${id}` },
    { label: "Contactos", to: `/clientes/${id}/contactos` },
    { label: "Historial de tickets", to: `/clientes/${id}/historial` },
  ];

  // Solo es fatal si no hay ficha que mostrar; con la ficha cargada el fallo de
  // una mutacion se dice sobre la propia pagina.
  if (error !== null && client === null) {
    return (
      <div>
        <ModuleHeader title="Cliente" sections={sections} />
        <ErrorRetry onRetry={() => void loadRecord()}>{error}</ErrorRetry>
      </div>
    );
  }

  // Solo espera al registro: la pestana de Contactos tiene su propio spinner y
  // su propia caida, y no debe retener la ficha entera.
  if (client === null) {
    return (
      <PageSpinner />
    );
  }

  return (
    /* En «Datos» la ficha se acota a la medida de lectura, y la tira de
       secciones con su accion se acota con ella: un boton a 260 px del borde
       derecho del panel que gobierna deja de leerse como suyo. Contactos e
       Historial son tablas y se quedan a todo el ancho. */
    <div className={section === "datos" ? "max-w-[880px]" : undefined}>
      <ModuleHeader
        title={client.name}
        summary={`${client.code} · ${territoryName(client.territoryId)}`}
        sections={sections}
        action={
          canWrite &&
          (section === "datos" ? (
            <Button size="sm" onClick={() => setEditingClient(true)}>
              <Pencil className="h-[15px] w-[15px]" />
              Editar cliente
            </Button>
          ) : section === "contactos" ? (
            <Button size="sm" onClick={() => setContactModal("nuevo")}>
              <Plus className="h-[15px] w-[15px]" />
              Nuevo contacto
            </Button>
          ) : undefined)
        }
      />

      {error !== null && (
        <ErrorRetry className="mb-3" onRetry={() => void loadRecord()}>{error}</ErrorRetry>
      )}

      {referenceError !== null && (
        <ErrorRetry className="mb-3" onRetry={() => void loadReferenceData()}>{referenceError}</ErrorRetry>
      )}

      {section === "datos" && (
        <DetailTable>
          <DetailGroup title="Identificación">
            <DetailRow label="Nombre">
              <span className="flex items-center gap-2.5">
                <Avatar name={client.name} seed={client.id} />
                <span className="text-[13px] font-medium text-ink">{client.name}</span>
              </span>
            </DetailRow>
            <DetailRow label="Código">
              {/* El codigo comercial lo lee la operacion, no una maquina: la mono
                  esta reservada a identificadores de maquina como las claves de permiso. */}
              <span className="tabular-nums">{client.code}</span>
            </DetailRow>
            <DetailRow label="RNC">{client.taxId ?? "—"}</DetailRow>
            <DetailRow label="Estado">
              <StatusDot active={client.isActive} />
            </DetailRow>
          </DetailGroup>

          <DetailGroup title="Clasificación comercial" hint="Quién lo atiende y desde dónde.">
            <DetailRow label="Tipo">
              <Badge tone="neutral">{client.type}</Badge>
            </DetailRow>
            <DetailRow label="Territorio">{territoryName(client.territoryId)}</DetailRow>
            <DetailRow label="Vendedor">
              {/* Ambar: "sin asignar" es un estado intermedio, no un dato ausente.
                  Mismas palabras que el listado. */}
              {salesRepName ?? <span className="text-warn">Sin vendedor</span>}
            </DetailRow>
          </DetailGroup>

          <DetailGroup title="Contacto">
            <DetailRow label="Teléfono">{client.phone ?? "—"}</DetailRow>
            <DetailRow label="Correo">{client.email ?? "—"}</DetailRow>
            <DetailRow label="Dirección">{client.address ?? "—"}</DetailRow>
          </DetailGroup>

          <DetailGroup title="Uso interno" hint="No se comparte con el cliente.">
            <DetailRow label="Notas internas" wide>
              {client.notes ?? <span className="text-faint">Sin notas internas</span>}
            </DetailRow>
          </DetailGroup>
        </DetailTable>
      )}

      {section === "contactos" && (
        <>
          {/* El reintento va en linea con su aviso, y afuera del panel: es un
              error de carga, no un dato de la tabla. */}
          {contactsError !== null && (
            <ErrorRetry className="mb-3" onRetry={refreshContacts}>{contactsError}</ErrorRetry>
          )}

          <ListPanel
            toolbar={
              <div className="flex w-full flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <SearchInput
                    value={contactSearch}
                    onChange={setContactSearch}
                    // Las tres columnas que busca el servidor; nombrarlas evita
                    // intentar por cargo o telefono y creer que no hay resultados.
                    placeholder="Buscar por nombre, apellido o correo…"
                    className="w-[240px]"
                  />
                  {contactSearch && (
                    <ClearFiltersButton
                      onClick={() => setContactSearch("")}
                      title="Limpiar búsqueda"
                    />
                  )}
                </div>

                {/* Antes de la primera respuesta las pastillas van en esqueleto, no
                    en cero: un cero es una afirmacion, y todavia no se sabe nada. */}
                {contactCounts === undefined ? (
                  <div className="inline-flex h-8 items-center gap-0.5 rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
                    {contactChips.map(({ key }) => (
                      <span
                        key={key}
                        aria-hidden
                        className="h-7 w-[88px] animate-pulse rounded-md bg-zinc-200/60"
                      />
                    ))}
                  </div>
                ) : (
                  <div
                    role="group"
                    aria-label="Vista de estado"
                    className="inline-flex h-8 items-center gap-0.5 rounded-lg border border-zinc-200 bg-zinc-50 p-0.5"
                  >
                    {contactChips.map(({ key, label, countKey }) => {
                      const isActive = contactChip === key;
                      const count = contactCounts[countKey];
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setContactChip(key)}
                          aria-pressed={isActive}
                          className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] transition-colors duration-150 outline-none select-none cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-red/25 ${
                            isActive
                              ? "border-zinc-200 bg-white font-semibold text-zinc-900 shadow-2xs"
                              : "border-transparent font-medium text-zinc-500 hover:bg-white/60 hover:text-zinc-800"
                          }`}
                        >
                          <span>{label}</span>
                          <span
                            className={`font-heading text-[10px] font-bold leading-none tabular-nums transition-colors ${
                              isActive ? "text-zinc-900" : "text-zinc-400"
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            }
            footer={
              contactPage !== null && (
                <Pagination
                  page={contactPage.page}
                  pageSize={contactPage.pageSize}
                  total={contactPage.total}
                  totalPages={contactPage.totalPages}
                  onPageChange={setContactPage}
                  onPageSizeChange={setContactPageSize}
                  noun="contactos"
                />
              )
            }
          >
            {contactPage === null ? (
              contactsError === null && <TableSkeleton rows={contactPageSize} columns={7} />
            ) : contactRows.length === 0 ? (
              contactsUnfiltered ? (
                <div className="py-12 text-center">
                  <p className="text-[13.5px] text-faint">Todavía no tiene contactos registrados.</p>
                  {canWrite && (
                    <div className="mt-3 flex justify-center">
                      <Button size="sm" onClick={() => setContactModal("nuevo")}>
                        <Plus className="h-[15px] w-[15px]" />
                        Agregar el primero
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="py-14 text-center text-[13.5px] text-faint">
                  Ningún contacto coincide con este filtro o búsqueda.
                </p>
              )
            ) : (
              <div className={`transition-opacity ${contactsStale ? "opacity-60" : ""}`}>
                <DataTable>
                  <thead>
                    <HeadRow>
                      <Th>Nombre</Th>
                      <Th>Correo</Th>
                      <Th>Teléfono</Th>
                      <Th>Cargo</Th>
                      <Th>Principal</Th>
                      <Th>Estado</Th>
                      {canWrite && <Th className="w-24 text-right">Acciones</Th>}
                    </HeadRow>
                  </thead>

                  <tbody>
                    {contactRows.map((contact) => (
                      <Row key={contact.id} busy={busyContactId === contact.id}>
                        <Td className="text-[13px] font-medium text-ink">
                          {contact.firstName} {contact.lastName}
                        </Td>
                        <Td className="text-[12.5px] text-brand-gray">{contact.email ?? "—"}</Td>
                        <Td className="text-[12.5px] text-brand-gray">{contact.phone ?? "—"}</Td>
                        <Td className="text-[12.5px] text-brand-gray">{contact.position ?? "—"}</Td>
                        <Td>
                          {contact.isPrimary ? (
                            // Gris, no rojo: marcar el registro designado no es ni la accion
                            // primaria ni el estado activo, los dos unicos usos del 185 C.
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-medium text-ink">
                              <Star aria-hidden className="h-3.5 w-3.5 fill-brand-gray text-brand-gray" />
                              Principal
                            </span>
                          ) : canWrite && contact.isActive ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="-mx-3.5"
                              onClick={() => makePrimary(contact)}
                              disabled={busyContactId === contact.id}
                            >
                              Hacer principal
                            </Button>
                          ) : (
                            <span className="text-[12.5px] text-faint">—</span>
                          )}
                        </Td>
                        <Td>
                          <StatusDot active={contact.isActive} />
                        </Td>
                        {canWrite && (
                          <Td>
                            <div className="flex items-center justify-end gap-1">
                              <RowAction
                                label={`Editar a ${contact.firstName} ${contact.lastName}`}
                                icon={Pencil}
                                onClick={() => setContactModal(contact)}
                                disabled={busyContactId === contact.id}
                              />
                              <RowAction
                                label={
                                  contact.isPrimary && contact.isActive
                                    ? "El contacto principal no se desactiva: marca otro como principal primero"
                                    : contact.isActive
                                      ? `Desactivar a ${contact.firstName}`
                                      : `Reactivar a ${contact.firstName}`
                                }
                                icon={Power}
                                onClick={() => askDeactivateContact(contact)}
                                disabled={(contact.isPrimary && contact.isActive) || busyContactId === contact.id}
                              />
                            </div>
                          </Td>
                        )}
                      </Row>
                    ))}
                  </tbody>
                </DataTable>
              </div>
            )}
          </ListPanel>
        </>
      )}

      {section === "historial" && (
        <p className="py-14 text-center text-[13.5px] text-faint">
          El módulo de Bandeja de tickets todavía no existe: aquí aparecerán los últimos tickets de
          este cliente en cuanto se construya.
        </p>
      )}

      {editingClient && (
        <ClientModal
          client={client}
          territories={territories}
          onClose={() => setEditingClient(false)}
          onSaved={setClient}
        />
      )}

      {contactModal !== null && (
        <ContactModal
          clientId={client.id}
          contact={contactModal === "nuevo" ? undefined : contactModal}
          isFirst={totalContacts === 0}
          onClose={() => setContactModal(null)}
          onSaved={() => void refreshAfterContactChange()}
        />
      )}

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </div>
  );
}

/**
 * Fila de la ficha: etiqueta a la izquierda, valor a la derecha, sin tarjeta.
 * La etiqueta es la cabecera de su fila, no una celda mas: sin `th scope="row"`
 * un lector de pantalla recita once valores sin decir de que son.
 */
