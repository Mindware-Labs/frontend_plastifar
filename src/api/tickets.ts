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

  updateStatus: (id: number, input: UpdateTicketStatusRequest | FormData) => {
    let body: FormData;
    if (input instanceof FormData) {
      body = input;
    } else {
      body = new FormData();
      body.append("Status", input.status);
      if (input.reason) body.append("Reason", input.reason);
      if (input.verdictId != null) body.append("VerdictId", String(input.verdictId));
      if (input.notifyClient !== undefined) body.append("NotifyClient", input.notifyClient ? "true" : "false");
      if (input.attachments) {
        input.attachments.forEach((file) => body.append("Attachments", file));
      }
    }
    return apiRequest<UpdateTicketStatusResponse>(`/api/tickets/${id}/status`, {
      method: "POST",
      body,
    });
  },

  getAssignableStaff: (id: number) =>
    apiRequest<TicketStaffOptionResponse[]>(`/api/tickets/${id}/assignable-staff`),

  createOptions: () =>
    apiRequest<import("../types/api").TicketCreateOptionsResponse>("/api/tickets/create-options"),

  create: (input: import("../types/api").CreateManualTicketRequest) =>
    apiRequest<import("../types/api").TicketSummaryResponse>("/api/tickets", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  update: (id: number, input: import("../types/api").UpdateTicketDetailsRequest) =>
    apiRequest<unknown>(`/api/tickets/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),

  bulkAssign: (input: import("../types/api").BulkAssignTicketsRequest) =>
    apiRequest<import("../types/api").BulkActionResult>("/api/tickets/bulk/assign", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  bulkPriority: (input: import("../types/api").BulkPriorityTicketsRequest) =>
    apiRequest<import("../types/api").BulkActionResult>("/api/tickets/bulk/priority", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  // Tareas del ticket
  getTasks: (ticketId: number) =>
    apiRequest<import("../types/api").TicketTaskResponse[]>(`/api/tickets/${ticketId}/tasks`),

  createTask: (ticketId: number, data: import("../types/api").CreateTicketTaskRequest) =>
    apiRequest<import("../types/api").TicketTaskResponse>(`/api/tickets/${ticketId}/tasks`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  completeTask: (ticketId: number, taskId: number, form: FormData) =>
    apiRequest<import("../types/api").TicketTaskResponse>(`/api/tickets/${ticketId}/tasks/${taskId}/complete`, {
      method: "POST",
      body: form,
    }),

  reopenTask: (ticketId: number, taskId: number) =>
    apiRequest<import("../types/api").TicketTaskResponse>(`/api/tickets/${ticketId}/tasks/${taskId}/reopen`, {
      method: "POST",
    }),

  addTaskComment: (ticketId: number, taskId: number, data: import("../types/api").CreateTicketTaskCommentRequest) =>
    apiRequest<import("../types/api").TicketTaskCommentResponse>(`/api/tickets/${ticketId}/tasks/${taskId}/comments`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  taskAttachmentLink: (ticketId: number, taskId: number, attachmentId: number, download = false) =>
    apiRequest<AttachmentLinkResponse>(
      `/api/tickets/${ticketId}/tasks/${taskId}/attachments/${attachmentId}${toQuery({
        download: download ? "true" : undefined,
      })}`,
    ),

  deleteTask: (ticketId: number, taskId: number) =>
    apiRequest<void>(`/api/tickets/${ticketId}/tasks/${taskId}`, {
      method: "DELETE",
    }),
};


