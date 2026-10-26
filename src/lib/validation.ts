/**
 * Para `z.string().refine(...)`: vacio vale; lo escrito no pasa de `places`
 * decimales. El redondeo a 6 cifras absorbe el error de coma flotante del producto.
 */
export const hasAtMostDecimals = (places: number) => (value: string) =>
  value === "" || Number((Number(value) * 10 ** places).toFixed(6)) % 1 === 0;
