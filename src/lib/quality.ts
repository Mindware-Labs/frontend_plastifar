// Formato y fechas del modulo de Calidad, sin React dentro. Las reglas de
// negocio (condiciones de cierre, separacion entre quien pide y quien aprueba
// un credito) las resuelve el servidor; este archivo ya no las duplica.
import type { ActionPlanItem, CorrectiveActionSheet, HcaStatus } from "../types/quality";

const dateFormat = new Intl.DateTimeFormat("es-DO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTimeFormat = new Intl.DateTimeFormat("es-DO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Fecha de dia (ISO corto). La conversion a hora local ocurre solo al mostrar. */
export function formatDay(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? "—" : dateFormat.format(parsed);
}

/** Instante UTC con hora. */
export function formatInstant(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : dateTimeFormat.format(parsed);
}

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

/**
 * Cerrada nunca está vencida: el vencimiento es del compromiso, no del
 * registro. El «hoy» por defecto es el día de la operación, el mismo con el que
 * el servidor arma la pastilla «Vencidas»: si fueran dos días distintos, el
 * contador y la fila se contradirían durante las últimas horas de cada día.
 */
export function isSheetOverdue(sheet: CorrectiveActionSheet, from = today()): boolean {
  return sheet.status !== "Cerrada" && daysUntil(sheet.dueDate, from) < 0;
}

export function isPlanItemOverdue(item: ActionPlanItem, from = today()): boolean {
  return (
    item.status !== "Cumplida" && item.status !== "Anulada" && daysUntil(item.dueDate, from) < 0
  );
}

/** «Vence en 4 días», «Venció hace 2 días», «Vence hoy». */
export function describeDue(dueDate: string, from = today()): string {
  const days = daysUntil(dueDate, from);
  if (days === 0) return "Vence hoy";
  if (days > 0) return days === 1 ? "Vence mañana" : `Vence en ${days} días`;
  const late = Math.abs(days);
  return late === 1 ? "Venció ayer" : `Venció hace ${late} días`;
}

/** Una accion resuelta es la que ya no bloquea: cumplida o anulada con justificacion. */
export function isPlanItemSettled(item: ActionPlanItem): boolean {
  return item.status === "Cumplida" || item.status === "Anulada";
}

/**
 * Siguiente estado al que puede avanzar la HCA, y que se lo impide.
 * `Cerrada` no sale de aqui: el cierre tiene su propio dialogo y sus tres
 * condiciones.
 */
export function nextStatus(sheet: CorrectiveActionSheet): {
  status: HcaStatus | null;
  blockedBy: string | null;
} {
  switch (sheet.status) {
    case "Abierta":
      return { status: "En análisis", blockedBy: null };
    case "En análisis":
      return (sheet.rootCause ?? "").trim() === ""
        ? { status: "En ejecución", blockedBy: "Escribe la causa raíz antes de pasar a ejecución." }
        : { status: "En ejecución", blockedBy: null };
    case "En ejecución":
      return { status: "En verificación", blockedBy: null };
    default:
      return { status: null, blockedBy: null };
  }
}

const currencyFormats: Record<string, Intl.NumberFormat> = {
  DOP: new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }),
  USD: new Intl.NumberFormat("es-DO", { style: "currency", currency: "USD" }),
};

export function formatAmount(amount: number, currency: string): string {
  const format = currencyFormats[currency] ?? currencyFormats.DOP;
  return format.format(amount);
}
