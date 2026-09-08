import { apiRequest, toQuery } from "./client";
import type {
  AssignTicketRequest,
  AssignTicketResponse,
  AttachmentLinkResponse,
  TicketDetailResponse,
  TicketListResponse,
  TicketMessageResponse,
  TicketQuery,
  TicketStaffOptionResponse,
  UpdateTicketStatusRequest,
  UpdateTicketStatusResponse,
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

  assign: (id: number, input: AssignTicketRequest) =>
    apiRequest<AssignTicketResponse>(`/api/tickets/${id}/assign`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateStatus: (id: number, input: UpdateTicketStatusRequest) =>
    apiRequest<UpdateTicketStatusResponse>(`/api/tickets/${id}/status`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  getAssignableStaff: (id: number) =>
    apiRequest<TicketStaffOptionResponse[]>(`/api/tickets/${id}/assignable-staff`),
};

