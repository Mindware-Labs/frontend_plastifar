import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authApi } from "../api/auth";
import { apiRequest } from "../api/client";
import { tokenStore } from "../api/tokenStore";
import { decodeAccessToken } from "../lib/jwt";
import type { LoginResponse } from "../types/api";

interface AuthUser {
  staffId: number;
  email: string;
  isAdmin: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function userFromToken(accessToken: string | null): AuthUser | null {
  if (!accessToken) return null;
  const claims = decodeAccessToken(accessToken);
  if (!claims) return null;

  return {
    staffId: Number(claims.sub),
    email: claims.email,
    isAdmin: claims.is_admin === "true",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() =>
    userFromToken(tokenStore.getAccessToken()),
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => tokenStore.subscribe(() => setUser(userFromToken(tokenStore.getAccessToken()))), []);

  useEffect(() => {
    // Al cargar la app, intenta restaurar la sesion con el refresh token guardado.
    const refreshToken = tokenStore.getRefreshToken();
    if (!refreshToken) {
      setIsLoading(false);
      return;
    }

    apiRequest<LoginResponse>(
      "/api/auth/refresh",
      { method: "POST", body: JSON.stringify({ refreshToken }) },
      false,
    )
      .then((response) => tokenStore.setTokens(response.accessToken, response.refreshToken))
      .catch(() => tokenStore.setTokens(null, null))
      .finally(() => setIsLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const response = await authApi.login({ email, password });
    tokenStore.setTokens(response.accessToken, response.refreshToken);
  }

  async function logout() {
    const refreshToken = tokenStore.getRefreshToken();
    tokenStore.setTokens(null, null);
    if (refreshToken) await authApi.logout(refreshToken).catch(() => {});
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
