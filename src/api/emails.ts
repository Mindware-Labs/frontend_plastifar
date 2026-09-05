import { apiRequest, toQuery } from "./client";
import type {
  AttachmentLinkResponse,
  EmailBulkAction,
  EmailBulkResponse,
  EmailDetailResponse,
  EmailFolderCounts,
  EmailListResponse,
  EmailThreadMessageResponse,
  EmptyTrashResponse,
  TicketSummaryResponse,
} from "../types/api";

export interface EmailQuery {
  page: number;
  pageSize: number;
  /** inbox | archived | junk | trash | sent */
  folder?: string;
  /** todos | sin-ticket | con-ticket | sin-responder */
  filter?: string;
  search?: string;
  /** Direccion exacta, como remitente o destinatario de cualquier correo del hilo. */
  from?: string;
  /** ISO con zona; until es exclusivo (la medianoche siguiente al ultimo dia). */
  since?: string;
  until?: string;
  hasAttachments?: string;
}

export const emailsApi = {
  list: (query: EmailQuery) => apiRequest<EmailListResponse>(`/api/emails${toQuery({ ...query })}`),

  counts: () => apiRequest<EmailFolderCounts>("/api/emails/counts"),

  bulk: (ids: number[], action: EmailBulkAction) =>
    apiRequest<EmailBulkResponse>("/api/emails/bulk", {
      method: "POST",
      body: JSON.stringify({ ids, action }),
    }),

  // Solo desde la papelera; un 409 significa que la conversacion tiene ticket y se conserva.
  remove: (id: number) => apiRequest<void>(`/api/emails/${id}`, { method: "DELETE" }),

  emptyTrash: () => apiRequest<EmptyTrashResponse>("/api/emails/trash/empty", { method: "POST" }),

  markRead: (id: number) => apiRequest<void>(`/api/emails/${id}/read`, { method: "POST" }),

  markUnread: (id: number) => apiRequest<void>(`/api/emails/${id}/unread`, { method: "POST" }),

  get: (id: number) => apiRequest<EmailDetailResponse>(`/api/emails/${id}`),

  // download fuerza la descarga: sin el, los tipos que el navegador sabe mostrar se abren.
  attachmentLink: (emailId: number, attachmentId: number, download = false) =>
    apiRequest<AttachmentLinkResponse>(
      `/api/emails/${emailId}/attachments/${attachmentId}${toQuery({ download: download ? "true" : undefined })}`,
    ),

  reply: (
    id: number,
    input: { body: string; bodyHtml?: string; cc?: string; files?: File[]; clientToken?: string },
  ) => {
    const form = new FormData();
    form.append("body", input.body);
    if (input.clientToken) form.append("clientToken", input.clientToken);
    if (input.bodyHtml) form.append("bodyHtml", input.bodyHtml);
    if (input.cc) form.append("cc", input.cc);
    for (const file of input.files ?? []) form.append("attachments", file);

    return apiRequest<EmailThreadMessageResponse>(`/api/emails/${id}/reply`, { method: "POST", body: form });
  },

  compose: (input: {
    to: string;
    cc?: string;
    subject: string;
    body: string;
    bodyHtml?: string;
    files?: File[];
    clientToken?: string;
  }) => {
    const form = new FormData();
    form.append("to", input.to);
    if (input.clientToken) form.append("clientToken", input.clientToken);
    if (input.cc) form.append("cc", input.cc);
    form.append("subject", input.subject);
    form.append("body", input.body);
    if (input.bodyHtml) form.append("bodyHtml", input.bodyHtml);
    for (const file of input.files ?? []) form.append("attachments", file);

    return apiRequest<EmailThreadMessageResponse>("/api/emails/compose", {
      method: "POST",
      body: form,
    });
  },

  createTicket: (id: number) =>
    apiRequest<TicketSummaryResponse>(`/api/emails/${id}/ticket`, { method: "POST" }),

  archive: (id: number) => apiRequest<void>(`/api/emails/${id}/archive`, { method: "POST" }),

  markAsJunk: (id: number) => apiRequest<void>(`/api/emails/${id}/junk`, { method: "POST" }),

  trash: (id: number) => apiRequest<void>(`/api/emails/${id}/trash`, { method: "POST" }),

  restore: (id: number) => apiRequest<void>(`/api/emails/${id}/restore`, { method: "POST" }),
};
