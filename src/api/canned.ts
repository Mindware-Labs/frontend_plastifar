import { apiRequest } from "./client";
import type { CannedResponseResponse } from "../types/api";

/** Respuestas predefinidas: cualquiera las usa; edita y borra quien las creo o un administrador. */
export const cannedApi = {
  list: () => apiRequest<CannedResponseResponse[]>("/api/emails/canned"),

  create: (title: string, body: string) =>
    apiRequest<CannedResponseResponse>("/api/emails/canned", {
      method: "POST",
      body: JSON.stringify({ title, body }),
    }),

  update: (id: number, title: string, body: string) =>
    apiRequest<CannedResponseResponse>(`/api/emails/canned/${id}`, {
      method: "PUT",
      body: JSON.stringify({ title, body }),
    }),

  remove: (id: number) => apiRequest<void>(`/api/emails/canned/${id}`, { method: "DELETE" }),
};
