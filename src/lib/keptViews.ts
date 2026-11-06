import { createContext } from "react";
import { tokenStore } from "../api/tokenStore";

// Secciones de Correo y de «Tickets y Tareas» cuyas vistas se mantienen vivas al salir; cada raíz es una entrada del menú.
const KEPT_SECTIONS = [
  "/bandeja",
  "/bandeja/destacados",
  "/bandeja/enviados",
  "/bandeja/archivados",
  "/bandeja/papelera",
  "/bandeja/respuestas",
  "/tickets",
  "/tickets/motivos",
  "/tickets/veredictos",
  "/tareas",
  "/reclamaciones",
  "/discrepancias",
  "/retiros",
  "/calidad/hca",
] as const;

// Más vistas ocultas que esto se descartan empezando por la que lleva más tiempo sin verse.
export const MAX_KEPT_VIEWS = 8;

// Una vista oculta más de este tiempo vuelve a montarse desde cero al regresar.
export const KEPT_VIEW_TTL_MS = 30 * 60 * 1000;

// Dentro de una vista viva los datos se dan por frescos 30 s y la caché los guarda mientras la vista pueda volver.
export const KEPT_VIEW_QUERY = { staleTime: 30 * 1000, gcTime: KEPT_VIEW_TTL_MS } as const;

// Verdadero dentro de una vista que se mantiene viva: usePagedList y useDetail ajustan su caché con él.
export const KeptViewContext = createContext(false);

function sectionOf(pathname: string): string | null {
  let best: string | null = null;
  for (const root of KEPT_SECTIONS) {
    if ((pathname === root || pathname.startsWith(`${root}/`)) && (best === null || root.length > best.length)) {
      best = root;
    }
  }
  return best;
}

/** Clave de la vista viva de esta ruta: el listado de la sección y cada ficha por su id, para no heredar el estado de otra. */
export function keptViewKey(pathname: string): string | null {
  const section = sectionOf(pathname);
  if (section === null) return null;
  const rest = pathname.slice(section.length);
  if (rest === "" || (section === "/tickets" && rest === "/historico")) return section;
  return /^\/\d+$/.test(rest) ? `${section}#${rest.slice(1)}` : null;
}

const LAST_LOCATION_KEY = "plf.kept-views.last";

function readLastLocations(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(LAST_LOCATION_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Guarda dónde se quedó la persona dentro de la sección de esta ruta. */
export function rememberLocation(pathname: string, search: string) {
  if (keptViewKey(pathname) === null) return;
  const section = sectionOf(pathname)!;
  const next = { ...readLastLocations(), [section]: `${pathname}${search}` };
  try {
    sessionStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(next));
  } catch {
    /* modo privado o sin cuota: el menú vuelve a la raíz de la sección */
  }
}

/** Destino de una entrada del menú: donde se quedó la persona en esa sección; si ya está dentro, la raíz. */
export function navTargetFor(to: string, currentPathname: string): string {
  if (!(KEPT_SECTIONS as readonly string[]).includes(to)) return to;
  if (sectionOf(currentPathname) === to) return to;
  return readLastLocations()[to] ?? to;
}

// Al cerrar sesión se olvida dónde estaba cada sección: quien entre después empieza desde las raíces.
tokenStore.subscribe(() => {
  if (tokenStore.getRefreshToken() !== null) return;
  try {
    sessionStorage.removeItem(LAST_LOCATION_KEY);
  } catch {
    /* ignorar */
  }
});
