import { apiRequest } from "./client";
import type { CreateRoleRequest, RoleResponse, UpdateRoleRequest } from "../types/api";

export const rolesApi = {
  list: () => apiRequest<RoleResponse[]>("/api/roles"),

  create: (data: CreateRoleRequest) =>
    apiRequest<RoleResponse>("/api/roles", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number, data: UpdateRoleRequest) =>
    apiRequest<void>(`/api/roles/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  remove: (id: number) => apiRequest<void>(`/api/roles/${id}`, { method: "DELETE" }),
};
