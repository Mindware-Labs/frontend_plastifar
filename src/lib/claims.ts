// Cálculo y texto de la reclamación de clientes (PF-FOR-034), espejo de ClaimRules.Compute.

import type { ClaimStatus } from "../types/claims";
import type { ClaimQualitySectionStatus } from "./claimQualitySection";

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

/** Sí / No / sin responder: la sección IV distingue «no» de «todavía no». */
export function yesNo(value: boolean | null): string {
  if (value === null) return "Sin responder";
  return value ? "Sí" : "No";
}

/** Lo que cada estado permite, en palabras (8.1). */
export function describeStatus(
  status: ClaimStatus,
  qualitySectionStatus?: ClaimQualitySectionStatus,
): string {
  switch (status) {
    case "Registrada":
      if (qualitySectionStatus === "complete") {
        return "Registrada; apartado de Calidad completo. Puede cerrarse cuando corresponda.";
      }
      if (qualitySectionStatus === "waived") {
        return "Registrada; Calidad no se completó en el registro inicial.";
      }
      return "Registrada por quien recibió la reclamación; Calidad todavía no la ha tratado.";
    case "En tratamiento":
      return "Registrada; el avance de Calidad se ve en la sección IV del formulario.";
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
