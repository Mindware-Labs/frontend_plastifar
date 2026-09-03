import { apiRequest, toQuery } from "./client";
import type { EmailDetailResponse, EmailListResponse, TicketSummaryResponse } from "../types/api";

export interface EmailQuery {
  page: number;
  pageSize: number;
  /** todos | sin-ticket | con-ticket */
  filter?: string;
  search?: string;
}

export const emailsApi = {
  list: (query: EmailQuery) => apiRequest<EmailListResponse>(`/api/emails${toQuery({ ...query })}`),

  get: (id: number) => apiRequest<EmailDetailResponse>(`/api/emails/${id}`),

  createTicket: (id: number) =>
    apiRequest<TicketSummaryResponse>(`/api/emails/${id}/ticket`, { method: "POST" }),
};
