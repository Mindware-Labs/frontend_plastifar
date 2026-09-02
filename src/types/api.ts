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

export interface CreateStaffRequest {
  firstName: string;
  lastName: string;
  email: string;
  primaryDepartmentId: number;
  isAdmin: boolean;
}

export interface RoleResponse {
  id: number;
  name: string;
  permissions: string[];
  isSystem: boolean;
  isActive: boolean;
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
