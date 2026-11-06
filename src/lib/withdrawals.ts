// Cálculo y texto de la solicitud de retiro de mercancía (PF-FOR-068), espejo de WithdrawalRules.

/** Tope de cantidad solicitada, cantidad retirada y precio unitario por línea. */
export const MAX_LINE_INPUT = 1_000_000_000;

/** La cantidad se escala a centésimas (2 decimales). */
const QUANTITY_SCALE = 100;
/** El precio se escala a diezmilésimas (4 decimales). */
const PRICE_SCALE = 10_000;
/** Producto en millonésimas (100 × 10 000) a céntimos: divide por 10 000. */
const MILLIONTHS_PER_CENT = 10_000n;
/** Media unidad del divisor anterior, para redondear alejándose de cero. */
const HALF_CENT_IN_MILLIONTHS = MILLIONTHS_PER_CENT / 2n;

function lineCents(quantity: number, unitPrice: number): bigint {
  const millionths =
    BigInt(Math.round(quantity * QUANTITY_SCALE)) * BigInt(Math.round(unitPrice * PRICE_SCALE));
  const negative = millionths < 0n;
  const magnitude = negative ? -millionths : millionths;
  const cents = (magnitude + HALF_CENT_IN_MILLIONTHS) / MILLIONTHS_PER_CENT;
  return negative ? -cents : cents;
}

/** Dentro de lo que el formulario admite y el escalado representa sin perder exactitud. */
function isLineInput(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) <= MAX_LINE_INPUT;
}

export function computeLineValue(quantity: number | null, unitPrice: number | null): number | null {
  if (unitPrice === null) return null;
  if (!isLineInput(unitPrice) || !isLineInput(quantity ?? 0)) return null;
  return Number(lineCents(quantity ?? 0, unitPrice)) / 100;
}

/** Suma de valores ya redondeados a céntimos; se suma en céntimos para no acumular error. */
export function computeTotal(values: (number | null)[]): number {
  const cents = values.reduce<number>((sum, value) => sum + (value === null ? 0 : Math.round(value * 100)), 0);
  return cents / 100;
}

/** Parte una fecha ISO YYYY-MM-DD en día, mes y año para la casilla FECHA del PF-FOR-068. */
export function splitIsoDate(isoDateString: string | null | undefined): {
  day: string;
  month: string;
  year: string;
} {
  const [year = "", month = "", day = ""] = (isoDateString ?? "").slice(0, 10).split("-");
  return { day, month, year };
}

/** Control documental del pie del PF-FOR-068, tal como está en la plantilla. */
export const WITHDRAWAL_FORM_CONTROL = {
  code: "PF-FOR-068",
  title: "SOLICITUD RETIRO DE MERCANCIA",
  revision: "00",
  replaces: "N/A",
  lastRevision: "11-Junio-2013",
  issuedOn: "11-Junio-2013",
} as const;
