import { apiRequest, toQuery } from "./client";
import type {
  ClaimDetail,
  ClaimSummary,
  ClaimTreatmentRequest,
  SaveClaimRequest,
} from "../types/claims";

export interface ClaimQuery {
  page: number;
  pageSize: number;
  search?: string;
  /** Texto del formulario: Sobrante, Faltante, Contaminación, Cruce, Otros. */
  reason?: string;
  plantId?: number;
  clientId?: number;
  /** ISO corto YYYY-MM-DD */
  from?: string;
  to?: string;
  /** Registrada | En tratamiento | Cerrada */
  status?: string;
  sort?: "fecha" | "cliente" | "total" | "ticket";
  dir?: "asc" | "desc";
}

export interface ClaimCounts {
  all: number;
  registered: number;
  inTreatment: number;
  closed: number;
}

export interface ClaimListResponse {
  items: ClaimSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  counts: ClaimCounts;
}

/** Reclamación de clientes, PF-FOR-034 (docs/plan/03, sección 10). */
export const claimsApi = {
  list: (query: ClaimQuery) =>
    apiRequest<ClaimListResponse>(`/api/claims${toQuery({ ...query })}`),

  get: (id: number) => apiRequest<ClaimDetail>(`/api/claims/${id}`),

  /** 404 cuando el ticket no se ve o todavía no tiene reclamación. */
  getByTicket: (ticketId: number) => apiRequest<ClaimDetail>(`/api/tickets/${ticketId}/claim`),

  create: (ticketId: number, data: SaveClaimRequest) =>
    apiRequest<ClaimDetail>(`/api/tickets/${ticketId}/claim`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number, data: SaveClaimRequest) =>
    apiRequest<ClaimDetail>(`/api/claims/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  updateTreatment: (id: number, data: ClaimTreatmentRequest) =>
    apiRequest<ClaimDetail>(`/api/claims/${id}/treatment`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  close: (id: number, observations: string | null) =>
    apiRequest<ClaimDetail>(`/api/claims/${id}/close`, {
      method: "POST",
      body: JSON.stringify({ observations }),
    }),

  reopen: (id: number, reason: string) =>
    apiRequest<ClaimDetail>(`/api/claims/${id}/reopen`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
};
