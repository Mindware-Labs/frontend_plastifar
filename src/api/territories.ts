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
  /**
   * El pageSize de 100 es solo el valor por omision para quien pide el catalogo
   * como lista de opciones; el listado de Configuracion manda su propia pagina.
   */
  list: (query: TerritoryQuery = {}) =>
    apiRequest<TerritoryListResponse>(`/api/territories${toQuery({ pageSize: 100, ...query })}`),

  /** Relectura previa a una escritura: el listado ya no tiene el registro en memoria. */
  get: (id: number) => apiRequest<Territory>(`/api/territories/${id}`),

  create: (data: SaveTerritoryRequest) =>
    apiRequest<Territory>("/api/territories", { method: "POST", body: JSON.stringify(data) }),

  update: (id: number, data: SaveTerritoryRequest) =>
    apiRequest<Territory>(`/api/territories/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  remove: (id: number) => apiRequest<void>(`/api/territories/${id}`, { method: "DELETE" }),
};
