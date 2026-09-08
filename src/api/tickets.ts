import { apiRequest, toQuery } from "./client";
import type {
  AttachmentLinkResponse,
  TicketDetailResponse,
  TicketListResponse,
  TicketMessageResponse,
  TicketQuery,
} from "../types/api";

export const ticketsApi = {
  list: (query: TicketQuery) =>
    apiRequest<TicketListResponse>(`/api/tickets${toQuery({ ...query })}`),

  getById: (id: number) =>
    apiRequest<TicketDetailResponse>(`/api/tickets/${id}`),

  createMessage: (id: number, form: FormData) =>
    apiRequest<TicketMessageResponse>(`/api/tickets/${id}/messages`, {
      method: "POST",
      body: form,
    }),

  attachmentLink: (ticketId: number, attachmentId: number, download = false) =>
    apiRequest<AttachmentLinkResponse>(
      `/api/tickets/${ticketId}/attachments/${attachmentId}${toQuery({
        download: download ? "true" : undefined,
      })}`,
    ),
};
