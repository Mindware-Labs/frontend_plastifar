import { queryOptions, useQuery } from "@tanstack/react-query";
import { fetchAllPages } from "../api/paging";
import { productLinesApi } from "../api/productLines";
import { rolesApi } from "../api/roles";
import { settingsApi } from "../api/settings";
import { staffApi } from "../api/staff";
import { territoriesApi } from "../api/territories";
import { ticketTopicsApi } from "../api/ticketTopics";
import type { SlaPolicyType } from "../types/settings";
import { queryClient } from "./queryClient";
import { sortSlaPolicies } from "./slaPolicyUi";

/**
 * Catalogos acotados compartidos por toda la app.
 *
 * ------------------------------------------------------------------
 * EL PROBLEMA QUE RESUELVE
 * ------------------------------------------------------------------
 * Plantas, lineas de producto, territorios, temas… se pedian enteros (todas
 * las paginas) en cada pantalla y otra vez en cada modal que se abria encima:
 * Reclamaciones pedia las plantas al abrir la lista y otra vez al abrir el
 * formulario. Aqui cada catalogo tiene UNA clave: el primero que lo pide lo
 * trae y los demas lo reutilizan.
 *
 * ------------------------------------------------------------------
 * CUANTO DURA
 * ------------------------------------------------------------------
 * `CATALOG_STALE_TIME` (cinco minutos) sin pedirlo de nuevo. No queda viejo
 * despues de editarlo: cualquier escritura aceptada marca toda la cache como
 * vieja (`markAllStale` en queryClient.ts), asi que una planta creada en
 * Configuracion aparece en el siguiente formulario que se abra.
 *
 * Se usan de dos formas:
 * - En componentes: `useQuery(catalogs.plants())` o los hooks de abajo.
 * - En codigo que espera una promesa (cargas combinadas, cargadores de
 *   `useReferenceData`): `fetchCatalog(catalogs.plants())`, misma cache.
 */
export const CATALOG_STALE_TIME = 5 * 60 * 1000;

export const catalogs = {
  plants: () =>
    queryOptions({
      queryKey: ["catalog", "plants"] as const,
      queryFn: () => fetchAllPages((page, pageSize) => settingsApi.plants.list({ page, pageSize })),
      staleTime: CATALOG_STALE_TIME,
    }),

  /** Mismo endpoint que `settingsApi.productLines.list`: una sola entrada. */
  productLines: () =>
    queryOptions({
      queryKey: ["catalog", "product-lines"] as const,
      queryFn: () => fetchAllPages((page, pageSize) => productLinesApi.list({ page, pageSize })),
      staleTime: CATALOG_STALE_TIME,
    }),

  territories: () =>
    queryOptions({
      queryKey: ["catalog", "territories"] as const,
      queryFn: () => fetchAllPages((page, pageSize) => territoriesApi.list({ page, pageSize })),
      staleTime: CATALOG_STALE_TIME,
    }),

  activeTicketTopics: () =>
    queryOptions({
      queryKey: ["catalog", "ticket-topics", "activos"] as const,
      queryFn: () =>
        fetchAllPages((page, pageSize) => ticketTopicsApi.list({ page, pageSize, status: "activos" })),
      staleTime: CATALOG_STALE_TIME,
    }),

  roles: () =>
    queryOptions({
      queryKey: ["catalog", "roles"] as const,
      queryFn: () => fetchAllPages((page, pageSize) => rolesApi.list({ page, pageSize, dir: "asc" })),
      staleTime: CATALOG_STALE_TIME,
    }),

  activeHolidays: () =>
    queryOptions({
      queryKey: ["catalog", "holidays", "activos"] as const,
      queryFn: () =>
        fetchAllPages((page, pageSize) => settingsApi.holidays.list({ page, pageSize, status: "activos" })),
      staleTime: CATALOG_STALE_TIME,
    }),

  /** Personal activo ordenado por nombre: vendedores, responsables, asignables. */
  activeStaff: () =>
    queryOptions({
      queryKey: ["catalog", "staff", "activos"] as const,
      queryFn: () =>
        fetchAllPages((page, pageSize) =>
          staffApi.list({ page, pageSize, status: "activos", sort: "nombre", dir: "asc" }),
        ),
      staleTime: CATALOG_STALE_TIME,
    }),

  activeSlaPolicies: (type: SlaPolicyType) =>
    queryOptions({
      queryKey: ["catalog", "sla-policies", "activas", type] as const,
      queryFn: async () =>
        sortSlaPolicies(
          await fetchAllPages((page, pageSize) =>
            settingsApi.slaPolicies.list({ page, pageSize, status: "activas", type }),
          ),
        ),
      staleTime: CATALOG_STALE_TIME,
    }),
};

/**
 * Lee un catalogo desde codigo que espera una promesa:
 * `fetchCatalog(catalogs.plants())`. Si esta fresco en la cache no pide nada;
 * si no, lo pide UNA vez aunque lo llamen varios a la vez. El tipo del
 * resultado sale de la definicion del catalogo.
 */
export const fetchCatalog = queryClient.fetchQuery.bind(queryClient);

export function usePlantsCatalog() {
  return useQuery(catalogs.plants());
}

export function useProductLinesCatalog() {
  return useQuery(catalogs.productLines());
}

export function useTerritoriesCatalog() {
  return useQuery(catalogs.territories());
}

export function useActiveTicketTopicsCatalog() {
  return useQuery(catalogs.activeTicketTopics());
}
