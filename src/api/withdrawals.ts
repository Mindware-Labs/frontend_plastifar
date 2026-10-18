import { apiRequest, toQuery } from "./client";
import type {
  CompleteWithdrawalRequest,
  SaveWithdrawalRequest,
  WithdrawalDetail,
  WithdrawalSummary,
} from "../types/withdrawals";

export interface WithdrawalQuery {
  page: number;
  pageSize: number;
  search?: string;
  clientId?: number;
  /** El vendedor: quien firmó la solicitud */
  requestedByStaffId?: number;
  reason?: string;
  /** ISO corto YYYY-MM-DD, sobre la fecha de la solicitud */
  from?: string;
  to?: string;
  status?: string;
  sort?: "fecha" | "numero" | "cliente" | "valor";
  dir?: "asc" | "desc";
}

export interface WithdrawalCounts {
  all: number;
  requested: number;
  approved: number;
  rejected: number;
  withdrawn: number;
  cancelled: number;
}

export interface WithdrawalListResponse {
  items: WithdrawalSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  counts: WithdrawalCounts;
}

/** Solicitud de retiro de mercancía, PF-FOR-068 (docs/plan/04, sección 10). */
export const withdrawalsApi = {
  list: (query: WithdrawalQuery) =>
    apiRequest<WithdrawalListResponse>(`/api/withdrawals${toQuery({ ...query })}`),

  get: (id: number) => apiRequest<WithdrawalDetail>(`/api/withdrawals/${id}`),

  listByTicket: (ticketId: number) => apiRequest<WithdrawalDetail[]>(`/api/tickets/${ticketId}/withdrawals`),

  create: (ticketId: number, data: SaveWithdrawalRequest) =>
    apiRequest<WithdrawalDetail>(`/api/tickets/${ticketId}/withdrawals`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number, data: SaveWithdrawalRequest) =>
    apiRequest<WithdrawalDetail>(`/api/withdrawals/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  decide: (id: number, approve: boolean, note: string | null) =>
    apiRequest<WithdrawalDetail>(`/api/withdrawals/${id}/decision`, {
      method: "POST",
      body: JSON.stringify({ approve, note }),
    }),

  complete: (id: number, data: CompleteWithdrawalRequest) =>
    apiRequest<WithdrawalDetail>(`/api/withdrawals/${id}/complete`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  cancel: (id: number, reason: string) =>
    apiRequest<WithdrawalDetail>(`/api/withdrawals/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
};
