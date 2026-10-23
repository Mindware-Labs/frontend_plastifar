// Cálculo y texto de la solicitud de retiro de mercancía, sin React dentro.
//
// Valor = cantidad × precio; sin precio, sin valor; total = suma de las líneas
// con valor (docs/plan/04, regla 5). La pantalla lo muestra mientras se
// escribe; el valor guardado es el que calcula el servidor. Espejo de
// `WithdrawalRules.Compute` y `WithdrawalRules.Total` en el backend.

import type { WithdrawalStatus } from "../types/withdrawals";

/**
 * Lo más que cabe en el valor de una línea y en el total: numeric(14,2) en
 * la base, `WithdrawalRules.MaxAmount` en el servidor.
 */
export const MAX_WITHDRAWAL_AMOUNT = 999_999_999_999.99;

/**
 * Tope de cantidad solicitada, cantidad retirada y precio unitario por línea.
 * Espejo de `WithdrawalRules.MaxLineInput` en el servidor.
 */
export const MAX_LINE_INPUT = 1_000_000_000;

/** La cantidad se escala a centésimas (2 decimales). */
const QUANTITY_SCALE = 100;
/** El precio se escala a diezmilésimas (4 decimales). */
const PRICE_SCALE = 10_000;
/** Producto en millonésimas (100 × 10 000) a céntimos: divide por 10 000. */
const MILLIONTHS_PER_CENT = 10_000n;
/** Media unidad del divisor anterior, para redondear alejándose de cero. */
const HALF_CENT_IN_MILLIONTHS = MILLIONTHS_PER_CENT / 2n;

/**
 * Cantidad (hasta 2 decimales) por precio (hasta 4), redondeado a céntimos
 * alejándose de cero como `MidpointRounding.AwayFromZero` en el servidor.
 *
 * Se calcula en enteros escalados con BigInt: cantidad en centésimas y precio
 * en diezmilésimas dan el producto en millonésimas, exacto. En coma flotante
 * algunos valores con medio céntimo quedan apenas por debajo: 1.005 es en
 * realidad 1.00499999999999989…, y `Math.round(1.005 * 100) / 100` da 1.00
 * donde el servidor guarda 1.01. (2.5 × 0.01, en cambio, da 0.025000…001 y
 * redondea bien: no sirve de ejemplo.)
 */
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
  // Fuera de rango no se calcula: el esquema ya muestra el error del campo, y
  // escalar un número enorme daría Infinity, que BigInt no admite.
  if (!isLineInput(unitPrice) || !isLineInput(quantity ?? 0)) return null;
  return Number(lineCents(quantity ?? 0, unitPrice)) / 100;
}

/** Suma de valores ya redondeados a céntimos; se suma en céntimos para no acumular error. */
export function computeTotal(values: (number | null)[]): number {
  const cents = values.reduce<number>((sum, value) => sum + (value === null ? 0 : Math.round(value * 100)), 0);
  return cents / 100;
}

/** Lo que cada estado permite, en palabras (8.1). */
export function describeStatus(status: WithdrawalStatus, requiresApproval: boolean): string {
  switch (status) {
    case "Solicitado":
      return requiresApproval
        ? "Solicitada; por indicar un error de origen, necesita aprobación antes del retiro."
        : "Solicitada; Almacén puede registrar el retiro.";
    case "Aprobado":
      return "Aprobada; a la espera de que Almacén registre el retiro.";
    case "Rechazado":
      return "Rechazada. Es un estado final.";
    case "Retirado":
      return "Retirada. Es el estado final y ya no se edita.";
    default:
      return "Cancelada. Es un estado final.";
  }
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
