import type { LoginResponse } from "../types/api";
import { tokenStore } from "./tokenStore";

const BASE_URL = import.meta.env.VITE_API_URL as string;

export class ApiError extends Error {
  status: number;
  /** Codigo estable del servidor, para decidir sin depender del texto del mensaje. */
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** Formas de error que devuelve la API: las propias y las ProblemDetails de ASP.NET. */
interface ErrorBody {
  message?: string;
  code?: string;
  title?: string;
  errors?: Record<string, string[]>;
}

async function doRefresh(): Promise<boolean> {
  const refreshToken = tokenStore.getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      // Rechazo definitivo (revocado, vencido, cuenta desactivada): la sesion local ya no vale.
      tokenStore.setTokens(null, null);
      return false;
    }

    const data = (await response.json()) as LoginResponse;
    tokenStore.setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    // Fallo de red: se conserva el refresh token para reintentar mas tarde.
    return false;
  }
}

let refreshPromise: Promise<boolean> | null = null;

/** Rota el refresh token. Llamadas simultaneas comparten una sola peticion. */
export function refreshSession(): Promise<boolean> {
  refreshPromise ??= doRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function readError(response: Response): Promise<ApiError> {
  let body: ErrorBody | null = null;
  try {
    body = (await response.json()) as ErrorBody;
  } catch {
    body = null;
  }

  const message =
    body?.message ??
    Object.values(body?.errors ?? {})[0]?.[0] ??
    body?.title ??
    `Error ${response.status}`;

  return new ApiError(response.status, message, body?.code);
}

/** Arma el query string omitiendo lo vacio, para no enviar filtros sin valor. */
export function toQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  allowRetry = true,
): Promise<T> {
  const headers = new Headers(options.headers);
  // Solo con cuerpo: en un GET este header convierte la peticion en "no simple"
  // y obliga al navegador a un preflight CORS extra por cada consulta.
  if (options.body !== undefined) headers.set("Content-Type", "application/json");

  const accessToken = tokenStore.getAccessToken();
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (response.status === 401 && allowRetry && tokenStore.getRefreshToken()) {
    if (await refreshSession()) return apiRequest<T>(path, options, false);
  }

  if (!response.ok) throw await readError(response);

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
