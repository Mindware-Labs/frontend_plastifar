import { apiRequest, toQuery } from "./client";
import type {
  DiscrepancyDetail,
  DiscrepancySummary,
  SaveDiscrepancyRequest,
} from "../types/discrepancies";

export interface DiscrepancyQuery {
  page: number;
  pageSize: number;
  search?: string;
  clientId?: number;
  dispatcher?: string;
  /** ISO corto YYYY-MM-DD, sobre la fecha de alta */
  from?: string;
  to?: string;
  /** Texto del estado, o «hallazgo» para la pastilla de seguridad */
  status?: string;
  sort?: "fecha" | "numero" | "ticket" | "cliente";
  dir?: "asc" | "desc";
}

export interface DiscrepancyCounts {
  all: number;
  investigating: number;
  completed: number;
  approved: number;
  returned: number;
  withFinding: number;
}

export interface DiscrepancyListResponse {
  items: DiscrepancySummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  counts: DiscrepancyCounts;
}

/** Investigación de discrepancia de carga, PF-FOR-291 (docs/plan/06, sección 10). */
export const discrepanciesApi = {
  list: (query: DiscrepancyQuery) =>
    apiRequest<DiscrepancyListResponse>(`/api/discrepancies${toQuery({ ...query })}`),

  get: (id: number) => apiRequest<DiscrepancyDetail>(`/api/discrepancies/${id}`),

  listByTicket: (ticketId: number) =>
    apiRequest<DiscrepancyDetail[]>(`/api/tickets/${ticketId}/discrepancies`),

  create: (ticketId: number, data: SaveDiscrepancyRequest) =>
    apiRequest<DiscrepancyDetail>(`/api/tickets/${ticketId}/discrepancies`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number, data: SaveDiscrepancyRequest) =>
    apiRequest<DiscrepancyDetail>(`/api/discrepancies/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
