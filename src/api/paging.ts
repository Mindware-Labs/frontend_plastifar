// Recorrido exhaustivo de un listado paginado, para los catalogos acotados.
//
// Vive aparte de client.ts porque no es transporte: client.ts sabe hablar HTTP,
// esto sabe que un catalogo se pide pagina a pagina hasta agotarlo.

/** Lo minimo que necesita esta funcion de una respuesta paginada del API. */
export interface PagedEnvelope<T> {
  items: T[];
  page: number;
  totalPages: number;
}

/** Tope que impone el servidor a `pageSize` en todos los listados (seccion 4.1). */
export const MAX_PAGE_SIZE = 100;

/**
 * Cien paginas de cien es diez mil registros: mas que eso ya no es un catalogo
 * acotado y no debe alimentar un desplegable. El tope existe para no quedarse
 * girando contra un servidor que devuelva siempre `totalPages` mayor que `page`.
 */
const DEFAULT_MAX_PAGES = 100;

/**
 * El catalogo no cabia entero dentro del tope de paginas. Es un error de verdad
 * y no una lista corta: devolver lo que se alcanzo a leer seria exactamente el
 * truncamiento silencioso que este modulo existe para evitar.
 */
export class TruncatedListError extends Error {
  /** Cuantas paginas se llegaron a leer antes de rendirse. */
  pagesRead: number;

  constructor(pagesRead: number) {
    super(
      `El catálogo no cabe en ${pagesRead} páginas: la lista sería incompleta. ` +
        "Acota la consulta o revisa el listado completo en Catálogos y configuración.",
    );
    this.name = "TruncatedListError";
    this.pagesRead = pagesRead;
  }
}

/**
 * Pide todas las paginas de un listado y devuelve los registros concatenados.
 *
 * `fetchPage` recibe la pagina y el tamano; quien llama decide el resto de los
 * filtros. Se para cuando el servidor dice que ya no quedan paginas, cuando una
 * pagina vuelve vacia --un `totalPages` que no baja nunca no debe volverse un
 * bucle-- o cuando se agota el tope, y en ese ultimo caso lanza.
 */
export async function fetchAllPages<T>(
  fetchPage: (page: number, pageSize: number) => Promise<PagedEnvelope<T>>,
  options: { pageSize?: number; maxPages?: number } = {},
): Promise<T[]> {
  const pageSize = Math.min(options.pageSize ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE);
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;

  const all: T[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const response = await fetchPage(page, pageSize);
    all.push(...response.items);

    // `totalPages` es 0 cuando no hay nada; cualquiera de las dos condiciones
    // cierra el recorrido sin depender de que la otra sea coherente.
    if (response.totalPages <= page || response.items.length === 0) return all;
  }

  throw new TruncatedListError(maxPages);
}
