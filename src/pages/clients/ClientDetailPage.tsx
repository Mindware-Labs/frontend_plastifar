import { Pencil, Plus, Power, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
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
import { clientsMock } from "../../mocks/clients";
import { upsertById } from "../../lib/catalog";
import type { Client, Contact, Territory } from "../../types/clients";
import { ClientModal } from "./ClientModal";
import { ContactModal } from "./ContactModal";

interface ClientDetailPageProps {
  section: "datos" | "contactos" | "historial";
}

const typeTone: Record<Client["type"], "red" | "green" | "neutral"> = {
  Distribuidor: "red",
  Mayorista: "neutral",
  Detallista: "neutral",
  Institucional: "green",
};

export function ClientDetailPage({ section }: ClientDetailPageProps) {
  const { id } = useParams();
  const { can } = usePermissions();
  const canWrite = can("clients.write");

  const [client, setClient] = useState<Client | null>(null);
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [editingClient, setEditingClient] = useState(false);
  const [contactModal, setContactModal] = useState<"nuevo" | Contact | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);

  const salesReps = clientsMock.salesReps();
  const clientId = Number(id);
  useDynamicBreadcrumb(client?.name ?? null);

  useEffect(() => {
    Promise.all([clientsMock.clients(), clientsMock.territories(), clientsMock.contacts(clientId)])
      .then(([clients, loadedTerritories, loadedContacts]) => {
        const found = clients.find((candidate) => candidate.id === clientId) ?? null;
        setClient(found);
        setTerritories(loadedTerritories);
        setContacts(loadedContacts);
      })
      .catch(() => setError("No se pudo cargar la ficha del cliente"));
  }, [clientId]);

  function territoryName(territoryId: number) {
    return territories.find((territory) => territory.id === territoryId)?.name ?? "—";
  }

  function repName(staffId: number | null) {
    if (staffId === null) return null;
    return salesReps.find((rep) => rep.id === staffId)?.name ?? null;
  }

  function upsertContact(item: Contact) {
    // Principal exclusivo: marcar uno nuevo como principal desmarca al anterior
    // dentro de la misma operación (sección 7.3).
    setContacts((previous) => {
      const base = previous ?? [];
      const next = item.isPrimary ? base.map((c) => ({ ...c, isPrimary: false })) : base;
      return upsertById(next, item);
    });
  }

  function makePrimary(contact: Contact) {
    setContacts((previous) =>
      (previous ?? []).map((c) => ({ ...c, isPrimary: c.id === contact.id })),
    );
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
      onConfirm: () => upsertContact({ ...contact, isActive: !contact.isActive }),
    });
  }

  const sections = [
    { label: "Datos", to: `/clientes/${id}` },
    { label: "Contactos", to: `/clientes/${id}/contactos` },
    { label: "Historial de tickets", to: `/clientes/${id}/historial` },
  ];

  if (error) {
    return (
      <div>
        <ModuleHeader sections={sections} />
        <Alert variant="error">{error}</Alert>
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
              <span className="font-mono text-[12.5px]">{client.code}</span>
            </DetailRow>
            <DetailRow label="RNC">{client.taxId ?? "—"}</DetailRow>
            <DetailRow label="Tipo">
              <Badge tone={typeTone[client.type]}>{client.type}</Badge>
            </DetailRow>
            <DetailRow label="Territorio">{territoryName(client.territoryId)}</DetailRow>
            <DetailRow label="Vendedor">
              {repName(client.salesRepStaffId) ?? (
                <span className="text-faint">Sin vendedor asignado</span>
              )}
            </DetailRow>
            <DetailRow label="Teléfono">{client.phone ?? "—"}</DetailRow>
            <DetailRow label="Correo">{client.email ?? "—"}</DetailRow>
            <DetailRow label="Dirección">{client.address ?? "—"}</DetailRow>
            <DetailRow label="Notas">
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
                <Row key={contact.id}>
                  <Td className="text-[13px] font-medium text-ink">
                    {contact.firstName} {contact.lastName}
                  </Td>
                  <Td className="text-[12.5px] text-brand-gray">{contact.email ?? "—"}</Td>
                  <Td className="text-[12.5px] text-brand-gray">{contact.phone ?? "—"}</Td>
                  <Td className="text-[12.5px] text-brand-gray">{contact.position ?? "—"}</Td>
                  <Td>
                    {contact.isPrimary ? (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-medium text-ink">
                        <Star aria-hidden className="h-3.5 w-3.5 fill-brand-red text-brand-red" />
                        Principal
                      </span>
                    ) : canWrite && contact.isActive ? (
                      <button
                        type="button"
                        onClick={() => makePrimary(contact)}
                        className="rounded-edge text-[12.5px] text-muted underline-offset-4 transition-colors
                          hover:text-ink hover:underline"
                      >
                        Hacer principal
                      </button>
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
                          disabled={contact.isPrimary && contact.isActive}
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
          existing={[client]}
          territories={territories}
          salesReps={salesReps}
          onClose={() => setEditingClient(false)}
          onSave={setClient}
        />
      )}

      {contactModal !== null && (
        <ContactModal
          clientId={client.id}
          contact={contactModal === "nuevo" ? undefined : contactModal}
          existing={contacts}
          onClose={() => setContactModal(null)}
          onSave={upsertContact}
        />
      )}

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </div>
  );
}

/** Fila de la ficha: etiqueta a la izquierda, valor a la derecha, sin tarjeta. */
function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Row>
      <Td className="w-[220px] py-3 align-middle font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">
        {label}
      </Td>
      <Td className="py-3 text-[13px] text-brand-gray">{children}</Td>
    </Row>
  );
}
