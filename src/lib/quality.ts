// Formato y fechas del modulo de Calidad, sin React dentro. Las reglas de
// negocio (condiciones de cierre, separacion entre quien pide y quien aprueba
// un credito) las resuelve el servidor; este archivo ya no las duplica.
import type { ActionPlanItem, CorrectiveActionSheet } from "../types/quality";

/**
 * República Dominicana es UTC−4 todo el año: no hay horario de verano desde
 * 2000. Espejo de `QualityRules.DominicanOffset` en el servidor.
 */
const DOMINICAN_OFFSET_MS = -4 * 60 * 60 * 1000;

/**
 * Hoy según la operación, no según el reloj de quien mira.
 *
 * La fecha comprometida de una HCA es un día del calendario —sin hora y sin
 * zona—, el día que una persona escribió en la hoja. Compararlo contra un
 * «ahora» en otra zona corre el vencimiento: contra UTC lo adelanta cuatro
 * horas, y entre las 20:00 y la medianoche de aquí el servidor ya contaba una
 * HCA como vencida mientras la pantalla seguía diciendo «Vence hoy». Contra la
 * hora del navegador el desfase es el que tenga esa máquina, que puede ser
 * cualquiera. Por eso las dos partes anclan el día a la zona de la operación.
 *
 * Espejo exacto de `QualityRules.DominicanToday()` en el backend: si una
 * cambia, cambia la otra.
 */
export function today(): string {
  return new Date(Date.now() + DOMINICAN_OFFSET_MS).toISOString().slice(0, 10);
}

/** Dias que faltan para una fecha comprometida. Negativo si ya paso. */
export function daysUntil(dueDate: string, from = today()): number {
  const due = Date.parse(`${dueDate}T00:00:00`);
  const base = Date.parse(`${from}T00:00:00`);
  if (Number.isNaN(due) || Number.isNaN(base)) return 0;
  return Math.round((due - base) / 86_400_000);
}

export function isPlanItemOverdue(item: ActionPlanItem, from = today()): boolean {
  return (
    item.status !== "Cumplida" && item.status !== "Anulada" && daysUntil(item.dueDate, from) < 0
  );
}

/** Una HCA vence si su fecha comprometida ya paso y todavia no se cerro. */
export function isHcaOverdue(
  sheet: Pick<CorrectiveActionSheet, "status" | "dueDate">,
  from = today(),
): boolean {
  return sheet.status !== "Cerrada" && Boolean(sheet.dueDate) && daysUntil(sheet.dueDate, from) < 0;
}

/** Una accion resuelta es la que ya no bloquea: cumplida o anulada con justificacion. */
export function isPlanItemSettled(item: ActionPlanItem): boolean {
  return item.status === "Cumplida" || item.status === "Anulada";
}

