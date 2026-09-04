import { apiRequest, toQuery } from "./client";
import type {
  EmailTemplate,
  Holiday,
  Mailbox,
  ProductLine,
  SlaPolicy,
  TicketTopic,
} from "../types/settings";

interface Counts {
  all: number;
  active: number;
  inactive: number;
}

interface ListResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  counts: Counts;
}

export interface CatalogQuery {
  page: number;
  pageSize: number;
  search?: string;
  /** todos | activos | inactivos, salvo topics: usa 1er/2do valor propio abajo */
  status?: string;
  sort?: string;
  dir?: "asc" | "desc";
}

export interface TopicQuery extends CatalogQuery {
  departmentId?: number;
}

export interface SlaQuery extends CatalogQuery {
  priority?: string;
}

export const settingsApi = {
  topics: {
    list: (query: TopicQuery) =>
      apiRequest<ListResponse<TicketTopic>>(`/api/settings/topics${toQuery({ ...query })}`),
    create: (data: Omit<TicketTopic, "id" | "ticketCount">) =>
      apiRequest<TicketTopic>("/api/settings/topics", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: Omit<TicketTopic, "id" | "ticketCount">) =>
      apiRequest<TicketTopic>(`/api/settings/topics/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => apiRequest<void>(`/api/settings/topics/${id}`, { method: "DELETE" }),
  },

  slaPolicies: {
    list: (query: SlaQuery) =>
      apiRequest<ListResponse<SlaPolicy>>(`/api/settings/sla-policies${toQuery({ ...query })}`),
    create: (data: Omit<SlaPolicy, "id">) =>
      apiRequest<SlaPolicy>("/api/settings/sla-policies", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: Omit<SlaPolicy, "id">) =>
      apiRequest<SlaPolicy>(`/api/settings/sla-policies/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => apiRequest<void>(`/api/settings/sla-policies/${id}`, { method: "DELETE" }),
  },

  holidays: {
    list: (query: CatalogQuery) =>
      apiRequest<ListResponse<Holiday>>(`/api/settings/holidays${toQuery({ ...query })}`),
    create: (data: Omit<Holiday, "id">) =>
      apiRequest<Holiday>("/api/settings/holidays", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: Omit<Holiday, "id">) =>
      apiRequest<Holiday>(`/api/settings/holidays/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => apiRequest<void>(`/api/settings/holidays/${id}`, { method: "DELETE" }),
  },

  productLines: {
    list: (query: CatalogQuery) =>
      apiRequest<ListResponse<ProductLine>>(`/api/settings/product-lines${toQuery({ ...query })}`),
    create: (data: Omit<ProductLine, "id" | "usedByTopics">) =>
      apiRequest<ProductLine>("/api/settings/product-lines", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: Omit<ProductLine, "id" | "usedByTopics">) =>
      apiRequest<ProductLine>(`/api/settings/product-lines/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => apiRequest<void>(`/api/settings/product-lines/${id}`, { method: "DELETE" }),
  },

  templates: {
    list: (query: CatalogQuery) =>
      apiRequest<ListResponse<EmailTemplate>>(`/api/settings/templates${toQuery({ ...query })}`),
    create: (data: Omit<EmailTemplate, "id">) =>
      apiRequest<EmailTemplate>("/api/settings/templates", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: Omit<EmailTemplate, "id">) =>
      apiRequest<EmailTemplate>(`/api/settings/templates/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => apiRequest<void>(`/api/settings/templates/${id}`, { method: "DELETE" }),
  },

  mailboxes: {
    list: (query: CatalogQuery) =>
      apiRequest<ListResponse<Mailbox>>(`/api/settings/mailboxes${toQuery({ ...query })}`),
    create: (data: Omit<Mailbox, "id" | "lastSyncedAt">) =>
      apiRequest<Mailbox>("/api/settings/mailboxes", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: Omit<Mailbox, "id" | "lastSyncedAt">) =>
      apiRequest<Mailbox>(`/api/settings/mailboxes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => apiRequest<void>(`/api/settings/mailboxes/${id}`, { method: "DELETE" }),
    test: (id: number) =>
      apiRequest<{ ok: boolean; message: string }>(`/api/settings/mailboxes/${id}/test`, { method: "POST" }),
  },
};
