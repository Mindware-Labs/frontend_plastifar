import { apiRequest, toQuery } from "./client";
import type { SaveSedeRequest, Sede, SedeListResponse, SedeQuery } from "../types/sedes";

export const sedesApi = {
  list: (query: SedeQuery = {}) =>
    apiRequest<SedeListResponse>(`/api/sedes${toQuery({ ...query })}`),

  get: (id: number) => apiRequest<Sede>(`/api/sedes/${id}`),

  create: (data: SaveSedeRequest) =>
    apiRequest<Sede>("/api/sedes", { method: "POST", body: JSON.stringify(data) }),

  update: (id: number, data: SaveSedeRequest) =>
    apiRequest<Sede>(`/api/sedes/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  remove: (id: number) => apiRequest<void>(`/api/sedes/${id}`, { method: "DELETE" }),

  bulk: (input: { ids: number[]; action: "activate" | "deactivate" | "delete" }) =>
    apiRequest<import("../types/api").BulkActionResult>("/api/sedes/bulk", {
      method: "POST",
      body: JSON.stringify({ ids: input.ids, action: input.action }),
    }),
};
