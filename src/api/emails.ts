import { apiRequest, toQuery } from "./client";
import type {
  AttachmentLinkResponse,
  EmailDetailResponse,
  EmailListResponse,
  EmailReplyResponse,
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

  // download fuerza la descarga: sin el, los tipos que el navegador sabe mostrar se abren.
  attachmentLink: (emailId: number, attachmentId: number, download = false) =>
    apiRequest<AttachmentLinkResponse>(
      `/api/emails/${emailId}/attachments/${attachmentId}${toQuery({ download: download ? "true" : undefined })}`,
    ),

  reply: (id: number, input: { body: string; cc?: string; files?: File[] }) => {
    const form = new FormData();
    form.append("body", input.body);
    if (input.cc) form.append("cc", input.cc);
    for (const file of input.files ?? []) form.append("attachments", file);

    return apiRequest<EmailReplyResponse>(`/api/emails/${id}/reply`, { method: "POST", body: form });
  },

  createTicket: (id: number) =>
    apiRequest<TicketSummaryResponse>(`/api/emails/${id}/ticket`, { method: "POST" }),

  archive: (id: number) => apiRequest<void>(`/api/emails/${id}/archive`, { method: "POST" }),

  markAsJunk: (id: number) => apiRequest<void>(`/api/emails/${id}/junk`, { method: "POST" }),

  trash: (id: number) => apiRequest<void>(`/api/emails/${id}/trash`, { method: "POST" }),

  restore: (id: number) => apiRequest<void>(`/api/emails/${id}/restore`, { method: "POST" }),
};
