import { apiRequest, toQuery } from "./client";
import type { SaveTerritoryRequest, Territory } from "../types/clients";

export interface TerritoryQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  /** todos | activos | inactivos */
  status?: string;
}

export interface TerritoryCounts {
  all: number;
  active: number;
  inactive: number;
}

export interface TerritoryListResponse {
  items: Territory[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  /** Contadores del filtro base, como todo listado (seccion 12.1 del plan). */
  counts: TerritoryCounts;
}

export const territoriesApi = {
  // Sin `pageSize` por omision, igual que clientsApi.contacts: el tamano lo
  // decide quien llama. Los 100 de oficio hacian que un catalogo mas largo
  // desapareciera del desplegable sin decirlo; quien necesita el catalogo entero
  // lo recorre con `fetchAllPages`.
  list: (query: TerritoryQuery = {}) =>
    apiRequest<TerritoryListResponse>(`/api/territories${toQuery({ ...query })}`),

  /** Relectura previa a una escritura: el listado ya no tiene el registro en memoria. */
  get: (id: number) => apiRequest<Territory>(`/api/territories/${id}`),

  create: (data: SaveTerritoryRequest) =>
    apiRequest<Territory>("/api/territories", { method: "POST", body: JSON.stringify(data) }),

  update: (id: number, data: SaveTerritoryRequest) =>
    apiRequest<Territory>(`/api/territories/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  remove: (id: number) => apiRequest<void>(`/api/territories/${id}`, { method: "DELETE" }),
};
