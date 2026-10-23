import {
  ArrowRight,
  Ban,
  Boxes,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  FileText,
  Landmark,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Star,
  Store,
  Ticket,
  Truck,
  UserCheck,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import {
  clientsApi,
  type ContactCounts,
  type ContactListResponse,
  type ContactQuery,
} from "../../api/clients";
import { ticketsApi } from "../../api/tickets";
import { fetchAllPages } from "../../api/paging";
import { territoriesApi } from "../../api/territories";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
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
import { useReceipts } from "../../context/useReceipts";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import { formatDateTime, formatPhoneNumber, formatTicketCode } from "../../lib/format";
import { resolveStaffLabel } from "../../lib/lookups";
import type { TicketListResponse, TicketQuery } from "../../types/api";
import type { Client, Contact, Territory } from "../../types/clients";
import { PriorityCell, StatusCell } from "../tickets/ticketCells";
import { ClientModal } from "./ClientModal";
import { ContactModal } from "./ContactModal";

interface ClientDetailPageProps {
  section: "datos" | "contactos" | "historial";
}

type ContactChipKey = "todos" | "activos" | "inactivos";

const contactChipToStatus: Record<ContactChipKey, string | undefined> = {
  todos: undefined,
  activos: "activos",
  inactivos: "inactivos",
};

const contactChips: { key: ContactChipKey; label: string; countKey: keyof ContactCounts }[] = [
  { key: "todos", label: "Todos", countKey: "all" },
  { key: "activos", label: "Activos", countKey: "active" },
  { key: "inactivos", label: "Inactivos", countKey: "inactive" },
];

const TYPE_ICONS: Record<string, typeof Truck> = {
  Distribuidor: Truck,
  Mayorista: Boxes,
  Detallista: Store,
  Institucional: Landmark,
};

function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

export function ClientDetailPage({ section }: ClientDetailPageProps) {
  const { id } = useParams();
  const { can } = usePermissions();
  const canWrite = can("clients.write");
  const receipts = useReceipts();

  const [client, setClient] = useState<Client | null>(null);
  const [previewContacts, setPreviewContacts] = useState<Contact[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [salesRepName, setSalesRepName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [busyContactId, setBusyContactId] = useState<number | null>(null);

  const [editingClient, setEditingClient] = useState(false);
  const [contactModal, setContactModal] = useState<"nuevo" | Contact | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);

  const [contactSearch, setContactSearch] = useState("");
  const [contactChip, setContactChip] = useState<ContactChipKey>("todos");
  const [contactPageSize, setContactPageSize] = useState(10);

  const [ticketSearch, setTicketSearch] = useState("");
  const [ticketChip, setTicketChip] = useState<"todos" | "abiertos" | "cerrados">("todos");
  const [ticketPageSize, setTicketPageSize] = useState(10);

  const clientId = Number(id);
  useDynamicBreadcrumb(client?.name ?? null);

  const debouncedContactSearch = useDebouncedValue(contactSearch).trim();
  const debouncedTicketSearch = useDebouncedValue(ticketSearch).trim();

  // Pestaña de Contactos
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

  // Pestaña de Historial de Tickets
  const {
    data: ticketPage,
    isStale: ticketsStale,
    error: ticketsError,
    setPage: setTicketPage,
    refresh: refreshTickets,
  } = usePagedList<TicketQuery, TicketListResponse>({
    fetch: (query) => ticketsApi.list(query),
    criteria: {
      clientId,
      pageSize: ticketPageSize,
      search: debouncedTicketSearch || undefined,
      status: ticketChip === "abiertos" ? "abiertos" : ticketChip === "cerrados" ? "cerrados" : undefined,
    },
    fallbackError: "No se pudieron cargar los tickets del cliente",
  });

  const contactRows = contactPage?.items ?? [];
  const contactCounts = contactPage?.counts;
  const contactsUnfiltered = contactChip === "todos" && !debouncedContactSearch;
  const totalContacts = contactCounts?.all ?? client?.contactCount ?? 0;

  const ticketRows = ticketPage?.items ?? [];
  const ticketCounts = ticketPage?.counts;
  const totalTickets = ticketCounts?.all ?? ticketPage?.total ?? client?.ticketCount ?? 0;

  function reload() {
    return clientsApi.get(clientId).then(({ client: loaded, contacts }) => {
      setClient(loaded);
      setPreviewContacts(contacts ?? []);
    });
  }

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
      receipts.done({
        action: "contacto-principal",
        title: "Contacto principal actualizado",
        detail: `${contact.firstName} ${contact.lastName} es ahora el contacto principal`,
      });
      await refreshAfterContactChange();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "No se pudo marcar como principal";
      setError(msg);
      receipts.failed({
        action: "contacto-principal",
        title: "No se pudo cambiar el contacto principal",
        detail: msg,
      });
    } finally {
      setBusyContactId(null);
    }
  }

  function askDeactivateContact(contact: Contact) {
    const willDeactivate = contact.isActive;
    setConfirmation({
      tone: "warn",
      icon: willDeactivate ? Ban : CheckCircle2,
      title: willDeactivate ? "Desactivar contacto" : "Reactivar contacto",
      description: willDeactivate ? (
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
      confirmLabel: willDeactivate ? "Desactivar" : "Reactivar",
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
          receipts.done({
            action: "toggle-contacto",
            title: contact.isActive ? "Contacto desactivado" : "Contacto reactivado",
            detail: `${contact.firstName} ${contact.lastName}`,
          });
          await refreshAfterContactChange();
        } catch (err) {
          receipts.failed({
            action: "toggle-contacto",
            title: contact.isActive ? "No se pudo desactivar el contacto" : "No se pudo reactivar el contacto",
            detail: err instanceof Error ? err.message : undefined,
          });
        } finally {
          setBusyContactId(null);
        }
      },
    });
  }

  const sections = [
    { label: "Datos", to: `/clientes/${id}` },
    { label: `Contactos (${totalContacts})`, to: `/clientes/${id}/contactos` },
    { label: `Historial de tickets (${totalTickets})`, to: `/clientes/${id}/historial` },
  ];

  if (error !== null && client === null) {
    return (
      <div>
        <ModuleHeader backTo="/clientes" backLabel="Volver al directorio de clientes" title="Cliente" sections={sections} />
        <ErrorRetry onRetry={() => void loadRecord()}>{error}</ErrorRetry>
      </div>
    );
  }

  if (client === null) {
    return (
      <PageSpinner />
    );
  }

  const TypeIcon = TYPE_ICONS[client.type] ?? Store;
  const primaryContact =
    contactRows.find((c) => c.isPrimary) ??
    previewContacts.find((c) => c.isPrimary) ??
    null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Cabecera uniforme que se mantiene IDÉNTICA en todos los tabs */}
      <ModuleHeader
        backTo="/clientes"
        backLabel="Volver al directorio de clientes"
        title={client.name}
        badge={
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] font-medium text-zinc-500 bg-zinc-100 border border-zinc-200/80 px-2 py-0.5 rounded-md tabular-nums">
              {client.code}
            </span>
            {client.isActive ? (
              <Badge tone="green">Activo</Badge>
            ) : (
              <Badge tone="neutral">Inactivo</Badge>
            )}
          </div>
        }
        summary={
          <div className="flex items-center gap-1.5 text-[12px] text-zinc-500">
            <span className="font-medium text-zinc-700">{client.type}</span>
            <span aria-hidden className="text-zinc-300">·</span>
            <span>{territoryName(client.territoryId)}</span>
            {client.taxId && (
              <>
                <span aria-hidden className="text-zinc-300">·</span>
                <span>RNC: {client.taxId}</span>
              </>
            )}
          </div>
        }
        sections={sections}
        action={
          canWrite && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => setEditingClient(true)}>
                <Pencil className="h-[15px] w-[15px]" />
                Editar cliente
              </Button>
              <Button size="sm" onClick={() => setContactModal("nuevo")}>
                <Plus className="h-[15px] w-[15px]" />
                Nuevo contacto
              </Button>
            </div>
          )
        }
      />

      {/* Zona de contenido con scroll vertical asegurado */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 pb-8">
        <div className="mx-auto w-full max-w-6xl">
          {error !== null && (
            <ErrorRetry className="mb-3" onRetry={() => void loadRecord()}>{error}</ErrorRetry>
          )}

          {referenceError !== null && (
            <ErrorRetry className="mb-3" onRetry={() => void loadReferenceData()}>{referenceError}</ErrorRetry>
          )}

          {/* Animación de entrada fluida estilo Apple */}
          <div key={section} className="animate-plf-apple-tab">
            {section === "datos" && (
            <div className="space-y-3.5">
              {/* 1. Métrica rápida compacta */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="rounded-card border border-zinc-200/80 bg-white p-3 shadow-2xs">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Estado</span>
                    <span className={`h-2 w-2 rounded-full ${client.isActive ? "bg-emerald-500" : "bg-zinc-300"}`} />
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-heading text-[15px] font-bold text-zinc-900">
                      {client.isActive ? "Activo" : "Inactivo"}
                    </span>
                    <span className="text-[11px] text-zinc-400 truncate">
                      {client.isActive ? "Habilitado" : "Suspendido"}
                    </span>
                  </div>
                </div>

                <div className="rounded-card border border-zinc-200/80 bg-white p-3 shadow-2xs">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Tipo</span>
                    <TypeIcon className="h-3.5 w-3.5 text-zinc-400" />
                  </div>
                  <div className="mt-1">
                    <span className="font-heading text-[15px] font-bold text-zinc-900 truncate block">
                      {client.type}
                    </span>
                  </div>
                </div>

                <div className="rounded-card border border-zinc-200/80 bg-white p-3 shadow-2xs">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Territorio</span>
                    <MapPin className="h-3.5 w-3.5 text-zinc-400" />
                  </div>
                  <div className="mt-1">
                    <span className="font-heading text-[15px] font-bold text-zinc-900 truncate block">
                      {territoryName(client.territoryId)}
                    </span>
                  </div>
                </div>

                <div className="rounded-card border border-zinc-200/80 bg-white p-3 shadow-2xs">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Vendedor</span>
                    <UserCheck className="h-3.5 w-3.5 text-zinc-400" />
                  </div>
                  <div className="mt-1">
                    <span className={`font-heading text-[15px] font-bold truncate block ${salesRepName ? "text-zinc-900" : "text-amber-600"}`}>
                      {salesRepName ?? "Sin asignar"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Grilla de 2 columnas (2/3 + 1/3) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
                {/* Columna Izquierda: Información Principal */}
                <div className="lg:col-span-2 space-y-3.5">
                  {/* Card: Identificación y Clasificación */}
                  <div className="rounded-card border border-line bg-white shadow-card overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 bg-zinc-50/50">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-zinc-500" />
                        <h3 className="font-heading text-[11.5px] font-bold uppercase tracking-wider text-zinc-800">
                          Identificación Comercial
                        </h3>
                      </div>
                      <span className="font-mono text-[11px] font-medium text-zinc-500 bg-white border border-zinc-200/80 px-2 py-0.5 rounded shadow-2xs tabular-nums">
                        {client.code}
                      </span>
                    </div>

                    <div className="px-4 py-1 divide-y divide-zinc-100">
                      <div className="flex items-center justify-between py-2 text-[12.5px]">
                        <span className="text-zinc-500 font-medium">Nombre o Razón Social</span>
                        <span className="font-semibold text-zinc-900 text-right">{client.name}</span>
                      </div>

                      <div className="flex items-center justify-between py-2 text-[12.5px]">
                        <span className="text-zinc-500 font-medium">RNC / Cédula</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-zinc-800 tabular-nums">
                            {client.taxId ?? "—"}
                          </span>
                          {client.taxId && <CopyButton text={client.taxId} label="Copiar RNC" />}
                        </div>
                      </div>

                      <div className="flex items-center justify-between py-2 text-[12.5px]">
                        <span className="text-zinc-500 font-medium">Tipo de cliente</span>
                        <span className="inline-flex items-center gap-1.5 text-zinc-800 font-medium">
                          <TypeIcon className="h-3.5 w-3.5 text-zinc-400" />
                          {client.type}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-2 text-[12.5px]">
                        <span className="text-zinc-500 font-medium">Territorio</span>
                        <span className="text-zinc-800 font-medium">
                          {territoryName(client.territoryId)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-2 text-[12.5px]">
                        <span className="text-zinc-500 font-medium">Vendedor asignado</span>
                        <span className={salesRepName ? "text-zinc-900 font-medium" : "text-amber-600 font-medium"}>
                          {salesRepName ?? "Sin vendedor asignado"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card: Canales de Contacto y Ubicación */}
                  <div className="rounded-card border border-line bg-white shadow-card overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 bg-zinc-50/50">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-zinc-500" />
                        <h3 className="font-heading text-[11.5px] font-bold uppercase tracking-wider text-zinc-800">
                          Canales de Contacto y Ubicación
                        </h3>
                      </div>
                    </div>

                    <div className="px-4 py-1 divide-y divide-zinc-100">
                      <div className="flex items-center justify-between py-2 text-[12.5px]">
                        <div className="flex items-center gap-2 text-zinc-500 font-medium">
                          <Phone className="h-3.5 w-3.5 text-zinc-400" />
                          <span>Teléfono principal</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {client.phone ? (
                            <>
                              <a
                                href={`tel:${client.phone}`}
                                className="font-mono text-zinc-900 font-medium hover:text-brand-red transition-colors"
                              >
                                {formatPhoneNumber(client.phone)}
                              </a>
                              <CopyButton text={client.phone} label="Copiar teléfono" />
                            </>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between py-2 text-[12.5px]">
                        <div className="flex items-center gap-2 text-zinc-500 font-medium">
                          <Mail className="h-3.5 w-3.5 text-zinc-400" />
                          <span>Correo electrónico</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {client.email ? (
                            <>
                              <a
                                href={`mailto:${client.email}`}
                                className="text-zinc-900 font-medium hover:text-brand-red transition-colors truncate max-w-[260px]"
                              >
                                {client.email}
                              </a>
                              <CopyButton text={client.email} label="Copiar correo" />
                            </>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-start justify-between py-2.5 text-[12.5px]">
                        <div className="flex items-center gap-2 text-zinc-500 font-medium shrink-0">
                          <MapPin className="h-3.5 w-3.5 text-zinc-400" />
                          <span>Dirección física</span>
                        </div>
                        <div className="text-right text-zinc-800 font-medium max-w-[340px] leading-relaxed">
                          {client.address || <span className="text-zinc-400 font-normal">Sin dirección física registrada</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card: Observaciones Internas */}
                  <div className="rounded-card border border-line bg-white shadow-card overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 bg-zinc-50/50">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-zinc-500" />
                        <h3 className="font-heading text-[11.5px] font-bold uppercase tracking-wider text-zinc-800">
                          Observaciones Internas
                        </h3>
                      </div>
                      <span className="text-[10.5px] font-medium text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded">
                        Uso interno
                      </span>
                    </div>

                    <div className="p-4">
                      {client.notes ? (
                        <div className="rounded-md border border-zinc-200/80 bg-zinc-50/70 p-3 text-[12.5px] leading-relaxed text-zinc-700 whitespace-pre-wrap font-sans">
                          {client.notes}
                        </div>
                      ) : (
                        <p className="text-[12.5px] text-zinc-400 italic">
                          No hay observaciones internas registradas para este cliente.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Columna Derecha: Tarjeta destacada de contacto y resumen */}
                <div className="space-y-3.5">
                  {/* Card destacada: Contacto Principal */}
                  <div className="rounded-card border border-amber-200/80 bg-gradient-to-b from-amber-50/30 to-white shadow-card overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-amber-100/80 bg-amber-50/60">
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                        <h3 className="font-heading text-[11.5px] font-bold uppercase tracking-wider text-amber-900">
                          Contacto Principal
                        </h3>
                      </div>
                      {primaryContact && (
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded">
                          Designado
                        </span>
                      )}
                    </div>

                    <div className="p-4">
                      {primaryContact ? (
                        <div className="space-y-3">
                          <div>
                            <div className="font-heading text-[14px] font-bold text-zinc-900">
                              {primaryContact.firstName} {primaryContact.lastName}
                            </div>
                            {primaryContact.position && (
                              <div className="text-[12px] text-zinc-500 mt-0.5">
                                {primaryContact.position}
                              </div>
                            )}
                          </div>

                          <div className="space-y-1.5 pt-2 border-t border-amber-100/60 text-[12px]">
                            {primaryContact.phone && (
                              <div className="flex items-center justify-between">
                                <span className="text-zinc-500 flex items-center gap-1.5">
                                  <Phone className="h-3 w-3 text-zinc-400" />
                                  Teléfono
                                </span>
                                <div className="flex items-center gap-1 font-mono text-zinc-800">
                                  <a href={`tel:${primaryContact.phone}`} className="hover:text-brand-red">
                                    {formatPhoneNumber(primaryContact.phone)}
                                  </a>
                                  <CopyButton text={primaryContact.phone} label="Copiar teléfono" />
                                </div>
                              </div>
                            )}

                            {primaryContact.email && (
                              <div className="flex items-center justify-between">
                                <span className="text-zinc-500 flex items-center gap-1.5">
                                  <Mail className="h-3 w-3 text-zinc-400" />
                                  Correo
                                </span>
                                <div className="flex items-center gap-1 text-zinc-800 truncate max-w-[150px]">
                                  <a href={`mailto:${primaryContact.email}`} className="hover:text-brand-red truncate" title={primaryContact.email}>
                                    {primaryContact.email}
                                  </a>
                                  <CopyButton text={primaryContact.email} label="Copiar correo" />
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="pt-2">
                            <Link
                              to={`/clientes/${id}/contactos`}
                              className="flex items-center justify-center gap-1.5 w-full py-1.5 text-[12px] font-semibold text-zinc-700 bg-white border border-zinc-200/90 rounded-md hover:bg-zinc-50 transition-colors shadow-2xs"
                            >
                              Ver todos los contactos ({totalContacts})
                              <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
                            </Link>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-2">
                          <p className="text-[12px] text-zinc-500 mb-3">
                            Este cliente todavía no tiene un contacto principal designado.
                          </p>
                          {canWrite && (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="w-full justify-center"
                              onClick={() => setContactModal("nuevo")}
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Agregar contacto
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card: Resumen de Operación */}
                  <div className="rounded-card border border-line bg-white shadow-card p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Ticket className="h-4 w-4 text-zinc-500" />
                      <h4 className="font-heading text-[11.5px] font-bold uppercase tracking-wider text-zinc-800">
                        Actividad del Cliente
                      </h4>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center mb-3">
                      <Link
                        to={`/clientes/${id}/contactos`}
                        className="p-2.5 rounded-lg bg-zinc-50 hover:bg-zinc-100/80 border border-zinc-100 transition-colors block"
                      >
                        <div className="font-heading text-[18px] font-bold text-zinc-900 tabular-nums">
                          {totalContacts}
                        </div>
                        <div className="text-[11px] font-medium text-zinc-500 mt-0.5">
                          Contactos
                        </div>
                      </Link>

                      <Link
                        to={`/clientes/${id}/historial`}
                        className="p-2.5 rounded-lg bg-zinc-50 hover:bg-zinc-100/80 border border-zinc-100 transition-colors block"
                      >
                        <div className="font-heading text-[18px] font-bold text-zinc-900 tabular-nums">
                          {totalTickets}
                        </div>
                        <div className="text-[11px] font-medium text-zinc-500 mt-0.5">
                          Tickets
                        </div>
                      </Link>
                    </div>

                    <div className="space-y-1 text-[12px]">
                      <Link
                        to="/clientes"
                        className="flex items-center justify-between p-2 rounded-md hover:bg-zinc-50 text-zinc-600 hover:text-zinc-900 font-medium transition-colors border border-transparent hover:border-zinc-200/60"
                      >
                        <span className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-zinc-400" />
                          Directorio de clientes (tabla)
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
                      </Link>

                      <Link
                        to={`/clientes/${id}/contactos`}
                        className="flex items-center justify-between p-2 rounded-md hover:bg-zinc-50 text-zinc-600 hover:text-zinc-900 font-medium transition-colors border border-transparent hover:border-zinc-200/60"
                      >
                        <span className="flex items-center gap-2">
                          <Users className="h-3.5 w-3.5 text-zinc-400" />
                          Directorio de contactos
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
                      </Link>

                      <Link
                        to={`/clientes/${id}/historial`}
                        className="flex items-center justify-between p-2 rounded-md hover:bg-zinc-50 text-zinc-600 hover:text-zinc-900 font-medium transition-colors border border-transparent hover:border-zinc-200/60"
                      >
                        <span className="flex items-center gap-2">
                          <Ticket className="h-3.5 w-3.5 text-zinc-400" />
                          Historial de tickets
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {section === "contactos" && (
            <>
              {contactsError !== null && (
                <div className="mb-3 flex items-start gap-3">
                  <Alert variant="error">{contactsError}</Alert>
                  <Button size="sm" variant="secondary" onClick={refreshContacts}>
                    Reintentar
                  </Button>
                </div>
              )}

              <ListPanel
                toolbar={
                  <div className="flex w-full flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <SearchInput
                        value={contactSearch}
                        onChange={setContactSearch}
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
                            <Td className="text-[12.5px] text-brand-gray">{contact.phone ? formatPhoneNumber(contact.phone) : "—"}</Td>
                            <Td className="text-[12.5px] text-brand-gray">{contact.position ?? "—"}</Td>
                            <Td>
                              {contact.isPrimary ? (
                                <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-medium text-ink">
                                  <Star aria-hidden className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
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
                                    icon={contact.isActive ? Ban : CheckCircle2}
                                    onClick={() => askDeactivateContact(contact)}
                                    disabled={(contact.isPrimary && contact.isActive) || busyContactId === contact.id}
                                    danger={contact.isActive && !contact.isPrimary}
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
            <>
              {ticketsError !== null && (
                <div className="mb-3 flex items-start gap-3">
                  <Alert variant="error">{ticketsError}</Alert>
                  <Button size="sm" variant="secondary" onClick={refreshTickets}>
                    Reintentar
                  </Button>
                </div>
              )}

              <ListPanel
                toolbar={
                  <div className="flex w-full flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <SearchInput
                        value={ticketSearch}
                        onChange={setTicketSearch}
                        placeholder="Buscar por número o asunto…"
                        className="w-[240px]"
                      />
                      {ticketSearch && (
                        <ClearFiltersButton
                          onClick={() => setTicketSearch("")}
                          title="Limpiar búsqueda"
                        />
                      )}
                    </div>

                    <div
                      role="group"
                      aria-label="Filtro de tickets"
                      className="inline-flex h-8 items-center gap-0.5 rounded-lg border border-zinc-200 bg-zinc-50 p-0.5"
                    >
                      {[
                        { key: "todos" as const, label: "Todos", count: ticketCounts?.all ?? totalTickets },
                        { key: "abiertos" as const, label: "Abiertos", count: ticketCounts?.open ?? 0 },
                        { key: "cerrados" as const, label: "Cerrados", count: (ticketCounts?.all ?? totalTickets) - (ticketCounts?.open ?? 0) },
                      ].map(({ key, label, count }) => {
                        const isActive = ticketChip === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setTicketChip(key)}
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
                  </div>
                }
                footer={
                  ticketPage !== null && (
                    <Pagination
                      page={ticketPage.page}
                      pageSize={ticketPage.pageSize}
                      total={ticketPage.total}
                      totalPages={ticketPage.totalPages}
                      onPageChange={setTicketPage}
                      onPageSizeChange={setTicketPageSize}
                      noun="tickets"
                    />
                  )
                }
              >
                {ticketPage === null ? (
                  ticketsError === null && <TableSkeleton rows={ticketPageSize} columns={7} />
                ) : ticketRows.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 mb-2.5">
                      <Ticket className="h-5 w-5" />
                    </div>
                    <p className="text-[13px] font-medium text-zinc-700">
                      {ticketSearch || ticketChip !== "todos"
                        ? "Ningún ticket coincide con este filtro o búsqueda."
                        : "Este cliente todavía no tiene tickets registrados."}
                    </p>
                    <p className="text-[12px] text-zinc-400 mt-0.5">
                      Los tickets registrados para este cliente aparecerán automáticamente aquí.
                    </p>
                  </div>
                ) : (
                  <div className={`transition-opacity ${ticketsStale ? "opacity-60" : ""}`}>
                    <DataTable>
                      <thead>
                        <HeadRow>
                          <Th className="w-28">Número</Th>
                          <Th>Asunto</Th>
                          <Th className="w-28">Prioridad</Th>
                          <Th className="w-32">Estado</Th>
                          <Th>Departamento</Th>
                          <Th>Asignado a</Th>
                          <Th className="w-36 text-right">Creado</Th>
                        </HeadRow>
                      </thead>

                      <tbody>
                        {ticketRows.map((ticket) => (
                          <Row key={ticket.id}>
                            <Td className="font-mono text-[12.5px] font-semibold text-zinc-900 tabular-nums">
                              <Link
                                to={`/tickets/${ticket.id}`}
                                className="text-brand-red hover:underline"
                              >
                                {ticket.number || formatTicketCode(ticket.id)}
                              </Link>
                            </Td>
                            <Td className="text-[13px] text-zinc-900 font-medium">
                              <Link
                                to={`/tickets/${ticket.id}`}
                                className="hover:text-brand-red transition-colors line-clamp-1"
                              >
                                {ticket.subject}
                              </Link>
                              {ticket.topicName && (
                                <span className="text-[11px] text-zinc-400 block font-normal">
                                  {ticket.topicName}
                                </span>
                              )}
                            </Td>
                            <Td>
                              <PriorityCell priority={ticket.priority} />
                            </Td>
                            <Td>
                              <StatusCell status={ticket.status} />
                            </Td>
                            <Td className="text-[12.5px] text-zinc-600">
                              {ticket.departmentName ?? "—"}
                            </Td>
                            <Td className="text-[12.5px] text-zinc-600">
                              {ticket.assignedStaffName ?? (
                                <span className="text-zinc-400">Sin asignar</span>
                              )}
                            </Td>
                            <Td className="text-[12px] text-zinc-500 text-right tabular-nums">
                              {formatDateTime(ticket.createdAt)}
                            </Td>
                          </Row>
                        ))}
                      </tbody>
                    </DataTable>
                  </div>
                )}
              </ListPanel>
            </>
          )}
          </div>
        </div>
      </div>

      {editingClient && (
        <ClientModal
          client={client}
          territories={territories}
          onClose={() => setEditingClient(false)}
          onSaved={(updated) => {
            setClient(updated);
            receipts.done({
              action: "editar-cliente",
              title: "Cliente actualizado",
              detail: `${updated.name} (${updated.code})`,
            });
          }}
        />
      )}

      {contactModal !== null && (
        <ContactModal
          clientId={client.id}
          contact={contactModal === "nuevo" ? undefined : contactModal}
          isFirst={totalContacts === 0}
          onClose={() => setContactModal(null)}
          onSaved={(savedContact) => {
            const isEdit = contactModal !== "nuevo";
            receipts.done({
              action: isEdit ? "editar-contacto" : "crear-contacto",
              title: isEdit ? "Contacto actualizado" : "Contacto agregado exitosamente",
              detail: `${savedContact.firstName} ${savedContact.lastName}`,
            });
            void refreshAfterContactChange();
          }}
        />
      )}

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </div>
  );
}
