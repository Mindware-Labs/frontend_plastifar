import { apiRequest, toQuery } from "./client";
import type { WebhookFailureListResponse, WebhookFailureResponse } from "../types/api";

export interface WebhookFailureQuery {
  page: number;
  pageSize: number;
  /** pending (default) | all */
  status?: string;
}

/** Avisos del proveedor que no se pudieron procesar. Solo administradores. */
export const webhookFailuresApi = {
  list: (query: WebhookFailureQuery) =>
    apiRequest<WebhookFailureListResponse>(`/api/emails/webhook-failures${toQuery({ ...query })}`),

  retry: (id: number) =>
    apiRequest<WebhookFailureResponse>(`/api/emails/webhook-failures/${id}/retry`, { method: "POST" }),

  remove: (id: number) => apiRequest<void>(`/api/emails/webhook-failures/${id}`, { method: "DELETE" }),
};
