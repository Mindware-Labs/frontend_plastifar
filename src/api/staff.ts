import { apiRequest, toQuery } from "./client";
import type {
  CreateStaffRequest,
  StaffListResponse,
  StaffResponse,
  UpdateStaffRequest,
} from "../types/api";
import type { StaffDetail } from "../types/permissions";

export interface GrantDepartmentAccessRequest {
  departmentId: number;
  roleId: number;
  isPrimary: boolean;
}

export interface UpdateDepartmentAccessRequest {
  roleId: number;
  isPrimary: boolean;
}

export interface StaffQuery {
  page: number;
  pageSize: number;
  search?: string;
  departmentId?: number;
  /** todos | activos | inactivos | administradores */
  status?: string;
  /** nombre | correo | departamento | rol | estado */
  sort?: string;
  dir?: "asc" | "desc";
}

export const staffApi = {
  list: (query: StaffQuery) => apiRequest<StaffListResponse>(`/api/staff${toQuery({ ...query })}`),

  create: (data: CreateStaffRequest) =>
    apiRequest<StaffResponse>("/api/staff", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number, data: UpdateStaffRequest) =>
    apiRequest<StaffResponse>(`/api/staff/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  revokeSessions: (id: number) =>
    apiRequest<void>(`/api/staff/${id}/revoke-sessions`, { method: "POST" }),

  deactivate: (id: number) =>
    apiRequest<void>(`/api/staff/${id}/deactivate`, { method: "POST" }),

  remove: (id: number) => apiRequest<void>(`/api/staff/${id}`, { method: "DELETE" }),

  /** RF-P4: accesos vigentes y permiso efectivo, resuelto por el servidor. */
  getDepartmentAccess: (id: number) =>
    apiRequest<StaffDetail>(`/api/staff/${id}/department-access`),

  grantDepartmentAccess: (id: number, data: GrantDepartmentAccessRequest) =>
    apiRequest<void>(`/api/staff/${id}/department-access`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateDepartmentAccess: (id: number, departmentId: number, data: UpdateDepartmentAccessRequest) =>
    apiRequest<void>(`/api/staff/${id}/department-access/${departmentId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  revokeDepartmentAccess: (id: number, departmentId: number) =>
    apiRequest<void>(`/api/staff/${id}/department-access/${departmentId}`, { method: "DELETE" }),
};
