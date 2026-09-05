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
  /** TerritoriesController.List no manda page/pageSize aparte: 100 es su propio tope por defecto. */
  list: (query: TerritoryQuery = {}) =>
    apiRequest<TerritoryListResponse>(`/api/territories${toQuery({ pageSize: 100, ...query })}`),

  create: (data: SaveTerritoryRequest) =>
    apiRequest<Territory>("/api/territories", { method: "POST", body: JSON.stringify(data) }),

  update: (id: number, data: SaveTerritoryRequest) =>
    apiRequest<Territory>(`/api/territories/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  remove: (id: number) => apiRequest<void>(`/api/territories/${id}`, { method: "DELETE" }),
};
