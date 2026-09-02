import { apiRequest, toQuery } from "./client";
import type {
  CreateStaffRequest,
  StaffListResponse,
  StaffResponse,
  UpdateStaffRequest,
} from "../types/api";

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

  deactivate: (id: number) =>
    apiRequest<void>(`/api/staff/${id}/deactivate`, { method: "POST" }),

  remove: (id: number) => apiRequest<void>(`/api/staff/${id}`, { method: "DELETE" }),
};
