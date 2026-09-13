// Adaptadores de busqueda para LookupSelect.
//
// Clientes y personal no son catalogos acotados: crecen sin tope y por eso no
// caben en un desplegable cargado de antemano. Se consultan al servidor con el
// termino que se escribe, y lo que no cabe se dice en la lista en vez de
// desaparecer en silencio.

import { clientsApi } from "../api/clients";
import { staffApi } from "../api/staff";
import type { LookupResult } from "../components/ui/LookupSelect";

/**
 * Veinte caben en el panel sin scroll infinito y bastan para reconocer lo que
 * se busca. Cuando hay mas, el control invita a seguir escribiendo: acotar es
 * mas rapido que pasar paginas dentro de un desplegable.
 */
const LOOKUP_PAGE_SIZE = 20;

/** Busca clientes por nombre, codigo, RNC o datos de sus contactos. */
export async function searchClients(term: string): Promise<LookupResult> {
  const { items, total } = await clientsApi.list({
    page: 1,
    pageSize: LOOKUP_PAGE_SIZE,
    search: term || undefined,
    sort: "nombre",
    dir: "asc",
  });

  return {
    options: items.map((client) => ({
      value: String(client.id),
      label: client.name,
      hint: client.code,
    })),
    hasMore: total > items.length,
  };
}

/**
 * Busca personal. `status` y `sort` se conservan tal cual los pedia cada
 * pantalla: la lista de vendedores ofrece solo activos, y el orden por nombre
 * es el que hace reconocible el resultado.
 */
export function searchStaff(status?: string) {
  return async function search(term: string): Promise<LookupResult> {
    const { items, total } = await staffApi.list({
      page: 1,
      pageSize: LOOKUP_PAGE_SIZE,
      search: term || undefined,
      status,
      sort: "nombre",
      dir: "asc",
    });

    return {
      options: items.map((person) => ({
        value: String(person.id),
        label: `${person.firstName} ${person.lastName}`,
        hint: person.email,
      })),
      hasMore: total > items.length,
    };
  };
}

/** Solo colaboradores activos: es lo que se ofrece para asignar trabajo. */
export const searchActiveStaff = searchStaff("activos");

/** Nombre de un colaborador por id, para pintar lo ya seleccionado. */
export async function resolveStaffLabel(value: string): Promise<string | null> {
  const person = await staffApi.getDepartmentAccess(Number(value));
  return `${person.firstName} ${person.lastName}`;
}

/** Nombre de un cliente por id, para pintar lo ya seleccionado. */
export async function resolveClientLabel(value: string): Promise<string | null> {
  const { client } = await clientsApi.get(Number(value));
  return client.name;
}
