// Insercion y reemplazo en una lista de catalogo.
//
// Los cinco catalogos de Configuracion hacen lo mismo al guardar, y el
// identificador de un registro nuevo lo pone la lista, no el dialogo: generarlo
// dentro del formulario obliga a llamar a Date.now() en pleno render.

/** Id de un registro que todavia no existe. El servidor asigna el definitivo. */
export const NEW_ID = 0;

export function upsertById<T extends { id: number }>(list: T[], item: T): T[] {
  if (item.id === NEW_ID) {
    const nextId = list.reduce((highest, entry) => Math.max(highest, entry.id), 0) + 1;
    return [...list, { ...item, id: nextId }];
  }

  return list.map((entry) => (entry.id === item.id ? item : entry));
}
