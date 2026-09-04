import { apiRequest, toQuery } from "./client";
import type {
  BulkReassignSalesRepRequest,
  BulkReassignSalesRepResponse,
  Client,
  ClientDetailResponse,
  ClientListResponse,
  Contact,
  SaveClientRequest,
  SaveContactRequest,
} from "../types/clients";

export interface ClientQuery {
  page: number;
  pageSize: number;
  search?: string;
  territoryId?: number;
  salesRepId?: number;
  type?: string;
  /** todos | activos | inactivos | sinvendedor */
  status?: string;
  sort?: string;
  dir?: "asc" | "desc";
}

export const clientsApi = {
  list: (query: ClientQuery) => apiRequest<ClientListResponse>(`/api/clients${toQuery({ ...query })}`),

  get: (id: number) => apiRequest<ClientDetailResponse>(`/api/clients/${id}`),

  create: (data: SaveClientRequest) =>
    apiRequest<Client>("/api/clients", { method: "POST", body: JSON.stringify(data) }),

  update: (id: number, data: SaveClientRequest) =>
    apiRequest<Client>(`/api/clients/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deactivate: (id: number) => apiRequest<void>(`/api/clients/${id}/deactivate`, { method: "POST" }),

  activate: (id: number) => apiRequest<void>(`/api/clients/${id}/activate`, { method: "POST" }),

  remove: (id: number) => apiRequest<void>(`/api/clients/${id}`, { method: "DELETE" }),

  bulkReassignSalesRep: (data: BulkReassignSalesRepRequest) =>
    apiRequest<BulkReassignSalesRepResponse>("/api/clients/bulk/sales-rep", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  contacts: {
    list: (clientId: number) => apiRequest<Contact[]>(`/api/clients/${clientId}/contacts`),

    create: (clientId: number, data: SaveContactRequest) =>
      apiRequest<Contact>(`/api/clients/${clientId}/contacts`, {
        method: "POST",
        body: JSON.stringify(data),
      }),

    update: (id: number, data: SaveContactRequest) =>
      apiRequest<Contact>(`/api/contacts/${id}`, { method: "PUT", body: JSON.stringify(data) }),

    makePrimary: (id: number) => apiRequest<void>(`/api/contacts/${id}/make-primary`, { method: "POST" }),

    remove: (id: number) => apiRequest<void>(`/api/contacts/${id}`, { method: "DELETE" }),
  },
};
