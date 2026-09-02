import { apiRequest } from "./client";
import type { DepartmentResponse } from "../types/api";

export const departmentsApi = {
  list: () => apiRequest<DepartmentResponse[]>("/api/departments"),
};
