import { useEffect, useState, type ReactNode } from "react";
import { authApi } from "../api/auth";
import { refreshSession } from "../api/client";
import { tokenStore } from "../api/tokenStore";
import { decodeAccessToken } from "../lib/jwt";
import { AuthContext, type AuthUser } from "./useAuth";

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
  // Solo hay algo que restaurar si quedo un refresh token de una visita anterior.
  const [isLoading, setIsLoading] = useState(() => tokenStore.getRefreshToken() !== null);

  useEffect(() => tokenStore.subscribe(() => setUser(userFromToken(tokenStore.getAccessToken()))), []);

  useEffect(() => {
    if (!tokenStore.getRefreshToken()) return;
    // refreshSession comparte una sola peticion: el doble montaje de StrictMode
    // no dispara dos rotaciones del mismo token.
    refreshSession().finally(() => setIsLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const response = await authApi.login({ email, password });
    tokenStore.setTokens(response.accessToken, response.refreshToken);
  }

  async function logout() {
    const refreshToken = tokenStore.getRefreshToken();

    // Se avisa al servidor ANTES de limpiar: al reves, la llamada salia sin
    // credenciales, el 401 se tragaba en silencio y el refresh token seguia
    // vivo hasta vencer. Si la red falla igual se cierra la sesion local.
    if (refreshToken) await authApi.logout(refreshToken).catch(() => {});

    tokenStore.setTokens(null, null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
