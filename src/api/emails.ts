import { apiRequest, toQuery } from "./client";
import type {
  AttachmentLinkResponse,
  EmailDetailResponse,
  EmailListResponse,
  TicketSummaryResponse,
} from "../types/api";

export interface EmailQuery {
  page: number;
  pageSize: number;
  /** inbox | archived | junk | trash */
  folder?: string;
  /** todos | sin-ticket | con-ticket */
  filter?: string;
  search?: string;
}

export const emailsApi = {
  list: (query: EmailQuery) => apiRequest<EmailListResponse>(`/api/emails${toQuery({ ...query })}`),

  get: (id: number) => apiRequest<EmailDetailResponse>(`/api/emails/${id}`),

  attachmentLink: (emailId: number, attachmentId: number) =>
    apiRequest<AttachmentLinkResponse>(`/api/emails/${emailId}/attachments/${attachmentId}`),

  createTicket: (id: number) =>
    apiRequest<TicketSummaryResponse>(`/api/emails/${id}/ticket`, { method: "POST" }),

  archive: (id: number) => apiRequest<void>(`/api/emails/${id}/archive`, { method: "POST" }),

  markAsJunk: (id: number) => apiRequest<void>(`/api/emails/${id}/junk`, { method: "POST" }),

  trash: (id: number) => apiRequest<void>(`/api/emails/${id}/trash`, { method: "POST" }),

  restore: (id: number) => apiRequest<void>(`/api/emails/${id}/restore`, { method: "POST" }),
};
