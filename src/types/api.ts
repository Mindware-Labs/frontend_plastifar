// Espejo de los DTOs del backend (api/api/Dtos/*.cs). Mantener sincronizado a mano.

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface VerifyResetCodeRequest {
  email: string;
  code: string;
}

export interface ResetPasswordRequest {
  email: string;
  code: string;
  newPassword: string;
}

export interface StaffResponse {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  primaryDepartmentId: number;
  isAdmin: boolean;
  isActive: boolean;
}

/** Respuesta paginada del listado de personal (GET /api/staff). */
export interface StaffListResponse {
  items: StaffResponse[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  counts: { all: number; active: number; inactive: number; admins: number };
}

export interface CreateStaffRequest {
  firstName: string;
  lastName: string;
  email: string;
  primaryDepartmentId: number;
  isAdmin: boolean;
}

export interface UpdateStaffRequest {
  firstName: string;
  lastName: string;
  email: string;
  primaryDepartmentId: number;
  isAdmin: boolean;
  isActive: boolean;
}

export interface RoleResponse {
  id: number;
  name: string;
  permissions: string[];
  isSystem: boolean;
  isActive: boolean;
}

/** Respuesta paginada del listado de roles (GET /api/roles). */
export interface RoleListResponse {
  items: RoleResponse[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  counts: { all: number; active: number; system: number; custom: number };
}

export interface CreateRoleRequest {
  name: string;
  permissions: string[];
}

export interface UpdateRoleRequest {
  name: string;
  permissions: string[];
  isActive: boolean;
}

export interface DepartmentResponse {
  id: number;
  name: string;
  isActive: boolean;
}

export interface ApiMessage {
  message: string;
}
