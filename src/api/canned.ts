import { apiRequest } from "./client";
import type { CannedResponseResponse, CategoriaResponseItem } from "../types/api";

/** Respuestas predefinidas: cualquiera las usa; edita y borra quien las creó o un administrador. */
export const cannedApi = {
  list: () => apiRequest<CannedResponseResponse[]>("/api/emails/canned"),

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

/** Categorías de respuestas predefinidas (CRUD dedicado). */
export const cannedCategoriesApi = {
  list: () => apiRequest<CategoriaResponseItem[]>("/api/emails/canned/categories"),

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
