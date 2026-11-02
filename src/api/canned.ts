import { apiRequest } from "./client";
import type {
  CannedResponseListResponse,
  CannedResponseResponse,
  CategoriaResponseItem,
  CategoriaResponseListResponse,
} from "../types/api";

export interface CannedQuery {
  page: number;
  pageSize: number;
  search?: string;
  categoryId?: number;
  sort?: "updated" | "usage" | "title";
}

export interface CategoriaQuery {
  page: number;
  pageSize: number;
  search?: string;
}

function cannedQueryString(query: CannedQuery): string {
  const params = new URLSearchParams();
  params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize));
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.categoryId != null) params.set("categoryId", String(query.categoryId));
  if (query.sort) params.set("sort", query.sort);
  return params.toString();
}

function categoriaQueryString(query: CategoriaQuery): string {
  const params = new URLSearchParams();
  params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize));
  if (query.search?.trim()) params.set("search", query.search.trim());
  return params.toString();
}

/** Plantillas de correo: cualquiera las usa; edita y borra quien las creó o un administrador. */
export const cannedApi = {
  list: (query: CannedQuery) =>
    apiRequest<CannedResponseListResponse>(`/api/emails/canned?${cannedQueryString(query)}`),

  recordUse: (id: number) =>
    apiRequest<void>(`/api/emails/canned/${id}/use`, { method: "POST" }),

  create: (title: string, body: string, categoryId?: number | null) =>
    apiRequest<CannedResponseResponse>("/api/emails/canned", {
      method: "POST",
      body: JSON.stringify({ title, body, categoryId }),
    }),

  update: (id: number, title: string, body: string, categoryId?: number | null) =>
    apiRequest<CannedResponseResponse>(`/api/emails/canned/${id}`, {
      method: "PUT",
      body: JSON.stringify({ title, body, categoryId }),
    }),

  remove: (id: number) => apiRequest<void>(`/api/emails/canned/${id}`, { method: "DELETE" }),

  bulkDelete: (ids: number[]) =>
    apiRequest<{ deletedCount: number }>("/api/emails/canned/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
};

/** Categorías de plantillas de correo (CRUD dedicado). */
export const cannedCategoriesApi = {
  list: (query: CategoriaQuery) =>
    apiRequest<CategoriaResponseListResponse>(`/api/emails/canned/categories?${categoriaQueryString(query)}`),

  /** Todas las categorías para filtros y selectores (hasta 200). */
  listAll: () =>
    cannedCategoriesApi.list({ page: 1, pageSize: 200 }).then((data) => data.items),

  create: (data: { name: string; description?: string | null; color?: string | null }) =>
    apiRequest<CategoriaResponseItem>("/api/emails/canned/categories", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number, data: { name: string; description?: string | null; color?: string | null }) =>
    apiRequest<CategoriaResponseItem>(`/api/emails/canned/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  remove: (id: number) => apiRequest<void>(`/api/emails/canned/categories/${id}`, { method: "DELETE" }),

  bulkDelete: (ids: number[]) =>
    apiRequest<{ deletedCount: number }>("/api/emails/canned/categories/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
};
