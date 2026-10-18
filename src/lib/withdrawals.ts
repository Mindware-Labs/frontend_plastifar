// Cálculo y texto de la solicitud de retiro de mercancía, sin React dentro.
//
// Valor = cantidad × precio; sin precio, sin valor; total = suma de las líneas
// con valor (docs/plan/04, regla 5). La pantalla lo muestra mientras se
// escribe; el valor guardado es el que calcula el servidor. Espejo de
// `WithdrawalRules.Compute` y `WithdrawalRules.Total` en el backend.

import type { WithdrawalStatus } from "../types/withdrawals";
import { formatAmount } from "./quality";

/**
 * Lo más que cabe en el valor de una línea y en el total: numeric(14,2) en
 * la base, `WithdrawalRules.MaxAmount` en el servidor.
 */
export const MAX_WITHDRAWAL_AMOUNT = 999_999_999_999.99;

/**
 * Cantidad (hasta 2 decimales) por precio (hasta 4), redondeado a céntimos
 * alejándose de cero como `MidpointRounding.AwayFromZero` en el servidor.
 *
 * Se calcula en enteros escalados con BigInt: cantidad en centésimas y precio
 * en diezmilésimas dan el producto en millonésimas, exacto. En coma flotante
 * 2.5 × 0.01 es 0.024999…, y redondear eso daría 0.02 donde el servidor
 * guarda 0.03.
 */
function lineCents(quantity: number, unitPrice: number): bigint {
  const millionths = BigInt(Math.round(quantity * 100)) * BigInt(Math.round(unitPrice * 10_000));
  const negative = millionths < 0n;
  const magnitude = negative ? -millionths : millionths;
  const cents = (magnitude + 5_000n) / 10_000n;
  return negative ? -cents : cents;
}

export function computeLineValue(quantity: number | null, unitPrice: number | null): number | null {
  if (unitPrice === null) return null;
  // BigInt no admite NaN ni Infinity; un número así lo rechaza el esquema.
  if (!Number.isFinite(unitPrice) || !Number.isFinite(quantity ?? 0)) return null;
  return Number(lineCents(quantity ?? 0, unitPrice)) / 100;
}

/** Suma de valores ya redondeados a céntimos; se suma en céntimos para no acumular error. */
export function computeTotal(values: (number | null)[]): number {
  const cents = values.reduce<number>((sum, value) => sum + (value === null ? 0 : Math.round(value * 100)), 0);
  return cents / 100;
}

/** Con moneda, como importe; sin moneda elegida, solo el número, sin inventar «DOP». */
const plainAmount = new Intl.NumberFormat("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatWithdrawalAmount(amount: number, currency: string | null | undefined): string {
  return currency ? formatAmount(amount, currency) : plainAmount.format(amount);
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
