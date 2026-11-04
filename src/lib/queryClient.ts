import { QueryClient } from "@tanstack/react-query";
import { tokenStore } from "../api/tokenStore";

/**
 * Cliente de TanStack Query de toda la app.
 *
 * ------------------------------------------------------------------
 * POR QUE ESTOS VALORES POR DEFECTO
 * ------------------------------------------------------------------
 * La migracion a TanStack Query no debia cambiar como se comporta la app,
 * solo quitar peticiones repetidas. Por eso:
 *
 * - `retry: false`. Antes ninguna pantalla reintentaba sola: un error se
 *   mostraba con su toast y el boton «Reintentar». Reintentar en silencio tres
 *   veces triplicaba la espera antes de ver el error.
 * - `refetchOnWindowFocus` y `refetchOnReconnect` apagados. Nada se recargaba
 *   al volver a la pestaña; los datos en vivo llegan por SignalR.
 * - `staleTime: 0` por defecto. Cada pantalla vuelve a pedir sus datos al
 *   montarse, igual que con el `useEffect` de antes. La diferencia es que ahora
 *   pinta lo que ya tenia mientras llega lo nuevo, y que dos componentes que
 *   piden lo mismo a la vez comparten UNA peticion.
 *
 * Los catalogos acotados (plantas, lineas, territorios…) suben su `staleTime`
 * en `catalogQueries.ts`: cambian poco y antes se pedian enteros en cada
 * pantalla y en cada modal.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 0,
    },
  },
});

/**
 * Tras cualquier escritura que el servidor acepto, todo lo cacheado pasa a
 * «viejo» sin pedir nada en ese momento: la pantalla que hizo el cambio ya
 * relee lo suyo, y cualquier otra lo pedira de nuevo al montarse. Asi una
 * planta creada en Configuracion aparece en el siguiente formulario que se
 * abra, exactamente como antes de cachear los catalogos.
 */
export function markAllStale() {
  void queryClient.invalidateQueries({ refetchType: "none" });
}

/*
 * Al cerrar sesion (aqui o en otra pestaña) se vacia la cache entera. Sin esto,
 * quien entre despues en el mismo navegador veria por un instante los datos
 * cacheados de la persona anterior, con permisos que no son los suyos.
 */
let hadSession = tokenStore.getRefreshToken() !== null;
tokenStore.subscribe(() => {
  const hasSession = tokenStore.getRefreshToken() !== null;
  if (hadSession && !hasSession) queryClient.clear();
  hadSession = hasSession;
});
