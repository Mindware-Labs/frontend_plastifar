import { apiRequest, toQuery } from "./client";
import type {
  CreateRoleRequest,
  RoleListResponse,
  RoleResponse,
  UpdateRoleRequest,
} from "../types/api";

export interface RoleQuery {
  page: number;
  pageSize: number;
  search?: string;
  /** todos | activos | sistema | personalizados */
  status?: string;
  dir?: "asc" | "desc";
}

export const rolesApi = {
  list: (query: RoleQuery) => apiRequest<RoleListResponse>(`/api/roles${toQuery({ ...query })}`),

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
