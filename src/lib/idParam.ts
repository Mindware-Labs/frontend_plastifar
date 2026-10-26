/**
 * Id de un filtro guardado en la URL. Un valor que no es un entero positivo
 * (un enlace editado a mano, «todos») no filtra: se trata como sin filtro.
 */
export function idParam(value: string): number | undefined {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}
