// Contrato anticipado del modulo de Clientes. Todavia no existe en el backend:
// cuando los endpoints /api/clients/... esten escritos, esto pasa a types/api.ts
// como espejo de los DTOs reales.

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
