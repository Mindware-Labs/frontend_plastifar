import { apiRequest, toQuery } from "./client";
import type { EmailSuppressionListResponse, EmailSuppressionResponse } from "../types/api";

export interface SuppressionQuery {
  page: number;
  pageSize: number;
  search?: string;
}

/** Direcciones bloqueadas para envios. Consultar es de todos; agregar y quitar, de administradores. */
export const suppressionsApi = {
  list: (query: SuppressionQuery) =>
    apiRequest<EmailSuppressionListResponse>(`/api/emails/suppressions${toQuery({ ...query })}`),

  create: (address: string, detail?: string) =>
    apiRequest<EmailSuppressionResponse>("/api/emails/suppressions", {
      method: "POST",
      body: JSON.stringify({ address, detail: detail || undefined }),
    }),

  remove: (id: number) => apiRequest<void>(`/api/emails/suppressions/${id}`, { method: "DELETE" }),
};
