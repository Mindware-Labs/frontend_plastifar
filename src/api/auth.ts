import { apiRequest } from "./client";
import type {
  ApiMessage,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  ResetPasswordRequest,
  VerifyResetCodeRequest,
} from "../types/api";

export const authApi = {
  login: (data: LoginRequest) =>
    apiRequest<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  forgotPassword: (data: ForgotPasswordRequest) =>
    apiRequest<ApiMessage>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  verifyResetCode: (data: VerifyResetCodeRequest) =>
    apiRequest<ApiMessage>("/api/auth/verify-reset-code", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  resetPassword: (data: ResetPasswordRequest) =>
    apiRequest<ApiMessage>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  changePassword: (data: ChangePasswordRequest) =>
    apiRequest<ApiMessage>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  logout: (refreshToken: string) =>
    apiRequest<void>("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),
};
