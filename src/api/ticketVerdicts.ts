import { apiRequest, toQuery } from "./client";
import type {
  SaveTicketVerdictRequest,
  TicketVerdictListResponse,
  TicketVerdictResponse,
} from "../types/api";

export interface TicketVerdictQuery {
  page: number;
  pageSize: number;
  search?: string;
  /** todos | activos | inactivos */
  status?: string;
}

/** Catálogo de veredictos: cualquiera lo consulta, solo un administrador lo edita. */
export const ticketVerdictsApi = {
  list: (query: TicketVerdictQuery) =>
    apiRequest<TicketVerdictListResponse>(`/api/ticket-verdicts${toQuery({ ...query })}`),

  create: (input: SaveTicketVerdictRequest) =>
    apiRequest<TicketVerdictResponse>("/api/ticket-verdicts", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  update: (id: number, input: SaveTicketVerdictRequest) =>
    apiRequest<TicketVerdictResponse>(`/api/ticket-verdicts/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),

  setActive: (id: number, isActive: boolean) =>
    apiRequest<TicketVerdictResponse>(`/api/ticket-verdicts/${id}/active`, {
      method: "POST",
      body: JSON.stringify({ isActive }),
    }),

  remove: (id: number) => apiRequest<void>(`/api/ticket-verdicts/${id}`, { method: "DELETE" }),
};
