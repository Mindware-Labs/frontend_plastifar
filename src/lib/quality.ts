// Reglas de negocio del modulo de Calidad, sin React dentro.
//
// Espejo de la seccion 10.3 del plan de construccion. Se escriben aqui, y no
// dentro de las pantallas, porque son exactamente las mismas que el servidor
// tendra que validar: cuando exista /api/quality/..., este archivo es la lista
// de lo que hay que replicar en C#, uno por uno.
import type {
  ActionPlanItem,
  CorrectiveActionSheet,
  CreditRequest,
  HcaStatus,
} from "../types/quality";

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

/** Hoy en ISO corto, en hora local: la fecha comprometida es un dia de calendario. */
export function today(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

/** Dias que faltan para una fecha comprometida. Negativo si ya paso. */
export function daysUntil(dueDate: string, from = today()): number {
  const due = Date.parse(`${dueDate}T00:00:00`);
  const base = Date.parse(`${from}T00:00:00`);
  if (Number.isNaN(due) || Number.isNaN(base)) return 0;
  return Math.round((due - base) / 86_400_000);
}

/** Cerrada nunca esta vencida: el vencimiento es del compromiso, no del registro. */
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

export interface ClosureCondition {
  id: "rootCause" | "planItems" | "effectiveness";
  label: string;
  /** Que falta, en el idioma de la operacion. Vacio cuando ya se cumple. */
  missing: string;
  met: boolean;
}

/**
 * Las tres condiciones que el plan exige para cerrar una HCA (10.3, reglas 2 y
 * 3). Se devuelven siempre las tres, cumplidas o no: la pantalla de cierre las
 * muestra como lista viva, para que nadie descubra lo que falta despues de
 * haber escrito la verificacion de eficacia.
 */
export function closureConditions(
  sheet: CorrectiveActionSheet,
  items: ActionPlanItem[],
): ClosureCondition[] {
  const pending = items.filter((item) => !isPlanItemSettled(item));

  return [
    {
      id: "rootCause",
      label: "Causa raíz escrita",
      met: (sheet.rootCause ?? "").trim().length > 0,
      missing: "Falta la causa raíz: sin ella la hoja no explica por qué ocurrió.",
    },
    {
      id: "planItems",
      label: "Acciones del plan resueltas",
      met: pending.length === 0,
      missing:
        pending.length === 1
          ? "Queda 1 acción sin resolver: o se cumple, o se anula con justificación."
          : `Quedan ${pending.length} acciones sin resolver: o se cumplen, o se anulan con justificación.`,
    },
    {
      id: "effectiveness",
      label: "Verificación de eficacia registrada",
      met: sheet.effectivenessCheckAt !== null && (sheet.effectivenessNotes ?? "").trim() !== "",
      missing: "Falta la verificación de eficacia: sin ella no consta que la acción funcionara.",
    },
  ];
}

export function canCloseSheet(sheet: CorrectiveActionSheet, items: ActionPlanItem[]): boolean {
  return closureConditions(sheet, items).every((condition) => condition.met);
}

/**
 * Siguiente estado al que puede avanzar la hoja, y que se lo impide.
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

/**
 * Separacion entre quien pide y quien aprueba (10.3, regla 5). Es el control
 * que da sentido al proceso: tener el permiso no basta, hay que no ser el
 * solicitante. Devuelve el motivo del rechazo, o null cuando si puede.
 */
export function creditDecisionBlock(
  request: CreditRequest,
  viewerStaffId: number | null,
  hasApprovePermission: boolean,
): string | null {
  if (request.status !== "Solicitada") {
    return `Esta solicitud ya está ${request.status.toLowerCase()}; no admite otra decisión.`;
  }
  if (!hasApprovePermission) {
    return "No tienes el permiso para aprobar o rechazar solicitudes de crédito.";
  }
  if (viewerStaffId !== null && request.requestedByStaffId === viewerStaffId) {
    return "No puedes aprobar una solicitud que tú mismo hiciste: quien pide y quien aprueba deben ser personas distintas.";
  }
  return null;
}
