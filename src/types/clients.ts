// Espejo de api/Dtos/ClientDtos.cs en el backend.

export type ClientType = "Distribuidor" | "Mayorista" | "Detallista" | "Institucional";

export const CLIENT_TYPES: ClientType[] = [
  "Distribuidor",
  "Mayorista",
  "Detallista",
  "Institucional",
];

/** La organizacion que compra a Plastifar. */
export interface Client {
  id: number;
  code: string;
  name: string;
  /** RNC; unico cuando viene informado. */
  taxId: string | null;
  type: ClientType;
  /** Vendedor asignado; null cuando su colaborador se desactivo o nunca se asignó. */
  salesRepStaffId: number | null;
  phone: string | null;
  email: string | null;
  /** Persona de referencia en la ficha (sección Contacto del modal). */
  contactPersonName: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  /** Tickets que ya lo referencian: un cliente con historial no se elimina, se desactiva. */
  ticketCount: number;
  contactCount: number;
}

/** Persona de contacto dentro de un cliente. */
export interface Contact {
  id: number;
  clientId: number;
  firstName: string;
  lastName: string;
  /** Unico dentro del mismo cliente: es la llave de la futura ingesta por correo. */
  email: string | null;
  phone: string | null;
  position: string | null;
  isPrimary: boolean;
  isActive: boolean;
}

export interface ClientCounts {
  all: number;
  active: number;
  inactive: number;
  withoutSalesRep: number;
}

export interface ClientListResponse {
  items: Client[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  counts: ClientCounts;
}

export interface ClientDetailResponse {
  client: Client;
  /**
   * Primera pagina de contactos, no la coleccion completa: el backend la acota
   * para no romper la seccion 4.1. La pestana de Contactos no la lee —pagina
   * contra `GET /api/clients/{id}/contacts`— y el total real es
   * `client.contactCount`, nunca `contacts.length`.
   */
  contacts: Contact[];
}

export interface SaveClientRequest {
  code?: string;
  name: string;
  taxId: string | null;
  type: ClientType;
  salesRepStaffId: number | null;
  phone: string | null;
  email: string | null;
  /** Persona de referencia en la ficha (sección Contacto del modal). */
  contactPersonName: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
}

export interface SaveContactRequest {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  isPrimary: boolean;
  isActive: boolean;
}

export interface BulkReassignSalesRepRequest {
  clientIds: number[];
  salesRepStaffId: number | null;
}

export interface BulkReassignSalesRepResponse {
  updated: number;
}

