// Cálculo y texto de la reclamación de clientes, sin React dentro.
//
// Las fórmulas son las del PF-FOR-034 (docs/plan/03, sección 8, regla 2):
// diferencia = facturados − recibidos, total = diferencia × precio. La pantalla
// las muestra mientras se escribe; el valor guardado es el que calcula el
// servidor (regla 6). Espejo de `ClaimRules.Compute` en el backend.

import type { ClaimStatus } from "../types/claims";

/** Redondeo a dos decimales sin arrastrar el error binario de `toFixed`. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface LineFigures {
  difference: number;
  lineTotal: number;
}

/** Un dato en blanco cuenta como cero, igual que en la plantilla. */
export function computeLine(
  invoiced: number | null,
  received: number | null,
  unitPrice: number | null,
): LineFigures {
  const difference = round2((invoiced ?? 0) - (received ?? 0));
  return { difference, lineTotal: round2(difference * (unitPrice ?? 0)) };
}

/** Regla 3: la suma de TODAS las líneas. */
export function computeTotal(lines: LineFigures[]): number {
  return round2(lines.reduce((sum, line) => sum + line.lineTotal, 0));
}

/** Un `<input type="number">` vacío es null, no cero: cero es un dato. */
export function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Cantidad sin moneda: las unidades no llevan símbolo. */
const quantityFormat = new Intl.NumberFormat("es-DO", { maximumFractionDigits: 2 });

export function formatQuantity(value: number | null): string {
  return value === null ? "—" : quantityFormat.format(value);
}

const priceFormat = new Intl.NumberFormat("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

export function formatPrice(value: number | null): string {
  return value === null ? "—" : priceFormat.format(value);
}

/** Sí / No / sin responder: la sección IV distingue «no» de «todavía no». */
export function yesNo(value: boolean | null): string {
  if (value === null) return "Sin responder";
  return value ? "Sí" : "No";
}

/** Lo que cada estado permite, en palabras (8.1). */
export function describeStatus(status: ClaimStatus): string {
  switch (status) {
    case "Registrada":
      return "Registrada por quien recibió la reclamación; Calidad todavía no la ha tratado.";
    case "En tratamiento":
      return "Calidad ya guardó la sección IV; se cierra cuando estén las tres respuestas.";
    default:
      return "Cerrada. Para corregirla, Calidad la reabre con un motivo.";
  }
}

/** Control documental del pie del PF-FOR-034, tal como está en la plantilla. */
export const CLAIM_FORM_CONTROL = {
  code: "PF-FOR-034",
  title: "RECLAMACIONES DE CLIENTES",
  revision: "03",
  replaces: "02",
  lastRevision: "16-Oct-2024",
  createdOn: "03-May-2013",
} as const;
