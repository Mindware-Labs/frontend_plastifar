import { Pencil, Plus, Power, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { clientsApi } from "../../api/clients";
import { staffApi } from "../../api/staff";
import { territoriesApi } from "../../api/territories";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { RowAction } from "../../components/ui/RowAction";
import { Spinner } from "../../components/ui/Spinner";
import { StatusDot } from "../../components/ui/StatusDot";
import { useDynamicBreadcrumb } from "../../context/useBreadcrumb";
import { usePermissions } from "../../hooks/usePermissions";
import type { Client, Contact, Territory } from "../../types/clients";
import { ClientModal } from "./ClientModal";
import { ContactModal } from "./ContactModal";

interface ClientDetailPageProps {
  section: "datos" | "contactos" | "historial";
}

export function ClientDetailPage({ section }: ClientDetailPageProps) {
  const { id } = useParams();
  const { can } = usePermissions();
  const canWrite = can("clients.write");

  const [client, setClient] = useState<Client | null>(null);
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [salesReps, setSalesReps] = useState<{ id: number; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Los catalogos de apoyo solo alimentan nombres para mostrar: que fallen no
  // justifica borrar una ficha que si cargo, pero tampoco callarse.
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [busyContactId, setBusyContactId] = useState<number | null>(null);

  const [editingClient, setEditingClient] = useState(false);
  const [contactModal, setContactModal] = useState<"nuevo" | Contact | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);

  const clientId = Number(id);
  useDynamicBreadcrumb(client?.name ?? null);

  function reload() {
    return clientsApi.get(clientId).then(({ client: loaded, contacts: loadedContacts }) => {
      setClient(loaded);
      setContacts(loadedContacts);
    });
  }

  /** Refresco tras una mutacion: el fallo se dice, no se pierde en la consola. */
  function reloadOrReport() {
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
      territoriesApi.list().then((res) => setTerritories(res.items)),
      staffApi
        .list({ page: 1, pageSize: 100, status: "activos", sort: "nombre", dir: "asc" })
        .then((res) => setSalesReps(res.items.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}` })))),
    ]).catch(() =>
      setReferenceError(
        "No se pudieron cargar los territorios ni los vendedores: abajo aparecen sin nombre, y el diálogo de edición se abrirá con esas listas vacías.",
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

  function repName(staffId: number | null) {
    if (staffId === null) return null;
    return salesReps.find((rep) => rep.id === staffId)?.name ?? null;
  }

  async function makePrimary(contact: Contact) {
    setBusyContactId(contact.id);
    setError(null);
    try {
      await clientsApi.contacts.makePrimary(contact.id);
      await reload();
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
          await reload();
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
        <ModuleHeader sections={sections} />
        <div className="flex flex-col items-start gap-2">
          <Alert variant="error">{error}</Alert>
          <Button size="sm" variant="secondary" onClick={() => void loadRecord()}>
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  if (client === null || contacts === null) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <ModuleHeader
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
        <div className="mb-3 flex flex-col items-start gap-2">
          <Alert variant="error">{error}</Alert>
          <Button size="sm" variant="secondary" onClick={() => void loadRecord()}>
            Reintentar
          </Button>
        </div>
      )}

      {referenceError !== null && (
        <div className="mb-3 flex flex-col items-start gap-2">
          <Alert variant="error">{referenceError}</Alert>
          <Button size="sm" variant="secondary" onClick={() => void loadReferenceData()}>
            Reintentar
          </Button>
        </div>
      )}

      {section === "datos" && (
        <DataTable>
          <tbody>
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
            <DetailRow label="Tipo">
              <Badge tone="neutral">{client.type}</Badge>
            </DetailRow>
            <DetailRow label="Territorio">{territoryName(client.territoryId)}</DetailRow>
            <DetailRow label="Vendedor">
              {/* Ambar: "sin asignar" es un estado intermedio, no un dato ausente.
                  Mismas palabras que el listado. */}
              {repName(client.salesRepStaffId) ?? <span className="text-warn">Sin vendedor</span>}
            </DetailRow>
            <DetailRow label="Teléfono">{client.phone ?? "—"}</DetailRow>
            <DetailRow label="Correo">{client.email ?? "—"}</DetailRow>
            <DetailRow label="Dirección">{client.address ?? "—"}</DetailRow>
            <DetailRow label="Notas internas">
              {client.notes ?? <span className="text-faint">Sin notas internas</span>}
            </DetailRow>
            <DetailRow label="Estado">
              <StatusDot active={client.isActive} />
            </DetailRow>
          </tbody>
        </DataTable>
      )}

      {section === "contactos" &&
        (contacts.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-[13.5px] text-faint">
              Todavía no tiene contactos registrados.
            </p>
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
              {contacts.map((contact) => (
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
        ))}

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
          salesReps={salesReps}
          onClose={() => setEditingClient(false)}
          onSaved={setClient}
        />
      )}

      {contactModal !== null && (
        <ContactModal
          clientId={client.id}
          contact={contactModal === "nuevo" ? undefined : contactModal}
          isFirst={contacts.length === 0}
          onClose={() => setContactModal(null)}
          onSaved={() => void reloadOrReport()}
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
function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Row>
      <th
        scope="row"
        className="w-[220px] py-3 pl-0 pr-3.5 text-left align-middle font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-faint"
      >
        {label}
      </th>
      <Td className="py-3 text-[13px] text-brand-gray">{children}</Td>
    </Row>
  );
}
