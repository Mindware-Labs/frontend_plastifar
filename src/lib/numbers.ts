// Números de los formularios (cantidades, precios e importes), sin React
// dentro. Un solo lugar para el formato y la lectura de un campo numérico: cada
// módulo tenía su copia y ya habían empezado a importarse unos a otros.

const quantityFormat = new Intl.NumberFormat("es-DO", { maximumFractionDigits: 2 });
const priceFormat = new Intl.NumberFormat("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const plainAmountFormat = new Intl.NumberFormat("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const currencyFormats: Record<string, Intl.NumberFormat> = {
  DOP: new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }),
  USD: new Intl.NumberFormat("es-DO", { style: "currency", currency: "USD" }),
};

/** Cantidad sin moneda: las unidades no llevan símbolo. Sin dato, una raya. */
export function formatQuantity(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : quantityFormat.format(value);
}

/** Precio unitario: hasta cuatro decimales, como lo guarda el servidor. */
export function formatPrice(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : priceFormat.format(value);
}

/** Importe con su moneda. Una moneda desconocida se muestra como pesos. */
export function formatAmount(amount: number, currency: string): string {
  return (currencyFormats[currency] ?? currencyFormats.DOP).format(amount);
}

/** Con moneda, como importe; sin moneda elegida, solo el número, sin inventar «DOP». */
export function formatAmountOrPlain(amount: number, currency: string | null | undefined): string {
  return currency ? formatAmount(amount, currency) : plainAmountFormat.format(amount);
}

/** Un `<input type="number">` vacío es null, no cero: cero es un dato. */
export function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Para los campos donde vacío sí significa cero. */
export function toNumber(value: string): number {
  return toNumberOrNull(value) ?? 0;
}
