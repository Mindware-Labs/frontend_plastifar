import type { LoginResponse } from "../types/api";
import { tokenStore } from "./tokenStore";

// Sin la barra final: "…app/" + "/api/…" da "//api/…", que no coincide con ninguna ruta.
const BASE_URL = (import.meta.env.VITE_API_URL as string).replace(/\/+$/, "");

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
export function toQuery(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

/** Caracteres que no pueden viajar en el atributo `download` de un ancla. */
// eslint-disable-next-line no-control-regex
const UNSAFE_FILENAME = /[\u0000-\u001f\u007f\\/:*?"<>|]/g;

/**
 * El nombre lo propone el servidor, asi que se limpia antes de usarlo: una
 * barra o dos puntos ahi dentro convierten la descarga en una ruta.
 */
function safeFilename(name: string, fallback: string): string {
  const cleaned = name.replace(UNSAFE_FILENAME, "-").replace(/^\.+/, "").trim();
  return cleaned === "" ? fallback : cleaned;
}

/**
 * Nombre que manda el servidor en Content-Disposition. Se prefiere `filename*`
 * (RFC 5987, porcentaje-codificado en UTF-8) sobre `filename`, que no admite
 * acentos.
 */
function filenameFromDisposition(header: string | null): string | null {
  if (header === null) return null;

  const extended = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header);
  if (extended) {
    try {
      return decodeURIComponent(extended[1].trim());
    } catch {
      // Codificacion rota: se cae al `filename` simple de abajo.
    }
  }

  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(header);
  return plain ? plain[1].trim() : null;
}

/** Dispara la descarga de un blob ya recibido, con el nombre indicado. */
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  // Firefox solo dispara el click sintetico si el ancla esta en el documento.
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Firefox y WebKit resuelven la descarga en un tick posterior: revocar en el
  // mismo tick la cancelaba o dejaba un archivo de 0 bytes.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Descarga un archivo que genera el servidor. Mismo trato que `apiRequest`
 * --cabecera de sesion, refresco silencioso ante un 401 y el `{ message }` del
 * error convertido en ApiError-- pero la respuesta correcta no se interpreta
 * como JSON: se guarda tal cual.
 *
 * El nombre lo decide el servidor por Content-Disposition; `fallbackFilename`
 * solo entra cuando esa cabecera no viaja --por ejemplo si un proxy la
 * recorta-- para que la descarga no acabe llamandose «descarga».
 */
export async function downloadFile(
  path: string,
  fallbackFilename: string,
  options: RequestInit = {},
  allowRetry = true,
): Promise<void> {
  const headers = new Headers(options.headers);
  if (typeof options.body === "string") headers.set("Content-Type", "application/json");

  const accessToken = tokenStore.getAccessToken();
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (response.status === 401 && allowRetry && tokenStore.getRefreshToken()) {
    if (await refreshSession()) return downloadFile(path, fallbackFilename, options, false);
  }

  // El cuerpo de un error si es JSON: se lee con el mismo lector que el resto.
  if (!response.ok) throw await readError(response);

  const blob = await response.blob();
  const name = filenameFromDisposition(response.headers.get("Content-Disposition"));
  saveBlob(blob, safeFilename(name ?? fallbackFilename, fallbackFilename));
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  allowRetry = true,
): Promise<T> {
  const headers = new Headers(options.headers);
  // Solo con cuerpo JSON: en un GET este header convierte la peticion en "no simple"
  // y obliga a un preflight CORS extra, y en un FormData pisa el separador del multipart.
  if (typeof options.body === "string") headers.set("Content-Type", "application/json");

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
