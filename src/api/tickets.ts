import { apiRequest, toQuery } from "./client";
import type {
  TicketDetailResponse,
  TicketListResponse,
  TicketQuery,
} from "../types/api";

export const ticketsApi = {
  list: (query: TicketQuery) =>
    apiRequest<TicketListResponse>(`/api/tickets${toQuery({ ...query })}`),

  getById: (id: number) =>
    apiRequest<TicketDetailResponse>(`/api/tickets/${id}`),
};
