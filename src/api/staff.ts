import { apiRequest } from "./client";
import type { CreateStaffRequest, StaffResponse } from "../types/api";

export const staffApi = {
  list: () => apiRequest<StaffResponse[]>("/api/staff"),

  create: (data: CreateStaffRequest) =>
    apiRequest<StaffResponse>("/api/staff", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deactivate: (id: number) =>
    apiRequest<void>(`/api/staff/${id}/deactivate`, { method: "POST" }),

  remove: (id: number) => apiRequest<void>(`/api/staff/${id}`, { method: "DELETE" }),
};
