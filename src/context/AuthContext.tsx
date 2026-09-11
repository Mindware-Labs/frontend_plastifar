import { useEffect, useState, type ReactNode } from "react";
import { authApi } from "../api/auth";
import { refreshSession } from "../api/client";
import { staffApi } from "../api/staff";
import { tokenStore } from "../api/tokenStore";
import { decodeAccessToken } from "../lib/jwt";
import { parseDepartmentAccess } from "../lib/permissions";
import { AuthContext, type AuthUser } from "./useAuth";

function userFromToken(accessToken: string | null): AuthUser | null {
  if (!accessToken) return null;
  const claims = decodeAccessToken(accessToken);
  if (!claims) return null;

  const staffId = Number(claims.sub);
  let firstName = claims.first_name || claims.given_name;
  let lastName = claims.last_name || claims.family_name;

  if (!firstName || !lastName) {
    try {
      const cached = sessionStorage.getItem(`pf_staff_name_${staffId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        firstName ??= parsed.firstName;
        lastName ??= parsed.lastName;
      }
    } catch {
      // Ignorar fallo de almacenamiento
    }
  }

  return {
    staffId,
    email: claims.email,
    isAdmin: claims.is_admin === "true",
    departmentAccess: parseDepartmentAccess(claims.dept_access),
    firstName,
    lastName,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() =>
    userFromToken(tokenStore.getAccessToken()),
  );
  // Solo hay algo que restaurar si quedo un refresh token de una visita anterior.
  const [isLoading, setIsLoading] = useState(() => tokenStore.getRefreshToken() !== null);

  useEffect(
    () =>
      tokenStore.subscribe(() => {
        const next = userFromToken(tokenStore.getAccessToken());
        setUser((prev) => {
          if (!next) return null;
          return {
            ...next,
            firstName: next.firstName ?? prev?.firstName,
            lastName: next.lastName ?? prev?.lastName,
          };
        });
      }),
    [],
  );

  const staffId = user?.staffId;
  const hasName = Boolean(user?.firstName && user?.lastName);

  useEffect(() => {
    if (!staffId || hasName) return;

    let cancelled = false;
    const cacheKey = `pf_staff_name_${staffId}`;

    staffApi
      .getById(staffId)
      .then((data) => {
        if (cancelled) return;
        try {
          sessionStorage.setItem(
            cacheKey,
            JSON.stringify({ firstName: data.firstName, lastName: data.lastName }),
          );
        } catch {
          // Ignorar fallo de almacenamiento
        }
        setUser((prev) =>
          prev && prev.staffId === staffId
            ? { ...prev, firstName: data.firstName, lastName: data.lastName }
            : prev,
        );
      })
      .catch(() => {
        // Si falla la red, el fallback preserva el estado actual
      });

    return () => {
      cancelled = true;
    };
  }, [staffId, hasName]);

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
