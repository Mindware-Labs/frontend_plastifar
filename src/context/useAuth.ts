import { createContext, useContext } from "react";
import type { DepartmentAccessClaim } from "../lib/permissions";

export interface AuthUser {
  staffId: number;
  email: string;
  isAdmin: boolean;
  /** Accesos por departamento con sus permisos, leidos del token. */
  departmentAccess: DepartmentAccessClaim[];
}

export interface AuthContextValue {
  user: AuthUser | null;
  /** true mientras se intenta restaurar la sesion guardada al cargar la app. */
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
