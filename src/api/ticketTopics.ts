import { apiRequest, toQuery } from "./client";
import type { SaveTicketTopicRequest, TicketTopicResponse } from "../types/api";

/** Catálogo de motivos: cualquiera lo consulta, solo un administrador lo edita. */
export const ticketTopicsApi = {
  list: (query: { search?: string; status?: string } = {}) =>
    apiRequest<TicketTopicResponse[]>(`/api/ticket-topics${toQuery({ ...query })}`),

  create: (input: SaveTicketTopicRequest) =>
    apiRequest<TicketTopicResponse>("/api/ticket-topics", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  update: (id: number, input: SaveTicketTopicRequest) =>
    apiRequest<TicketTopicResponse>(`/api/ticket-topics/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),

  setActive: (id: number, isActive: boolean) =>
    apiRequest<TicketTopicResponse>(`/api/ticket-topics/${id}/active`, {
      method: "POST",
      body: JSON.stringify({ isActive }),
    }),

  remove: (id: number) => apiRequest<void>(`/api/ticket-topics/${id}`, { method: "DELETE" }),
};
