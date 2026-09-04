// Espejo de api/Dtos/ClientDtos.cs en el backend.

export type ClientType = "Distribuidor" | "Mayorista" | "Detallista" | "Institucional";

export const CLIENT_TYPES: ClientType[] = [
  "Distribuidor",
  "Mayorista",
  "Detallista",
  "Institucional",
];

/** Catalogo de zonas; administrable desde Configuración (RF-C8). */
export interface Territory {
  id: number;
  name: string;
  code: string;
  isActive: boolean;
  /** Clientes que la referencian: alimenta el ranking comercial y la guarda de RF-C1. */
  clientCount: number;
}

/** La organizacion que compra a Plastifar. */
export interface Client {
  id: number;
  code: string;
  name: string;
  /** RNC; unico cuando viene informado. */
  taxId: string | null;
  type: ClientType;
  territoryId: number;
  /** Vendedor asignado; null cuando su colaborador se desactivo o nunca se asignó. */
  salesRepStaffId: number | null;
  phone: string | null;
  email: string | null;
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
  contacts: Contact[];
}

export interface SaveClientRequest {
  code: string;
  name: string;
  taxId: string | null;
  type: ClientType;
  territoryId: number;
  salesRepStaffId: number | null;
  phone: string | null;
  email: string | null;
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

export interface SaveTerritoryRequest {
  name: string;
  code: string;
  isActive: boolean;
}
