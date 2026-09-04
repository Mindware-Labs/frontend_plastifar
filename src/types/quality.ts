// Contrato anticipado del modulo de Calidad (seccion 10 del plan de
// construccion). Todavia no existe en el backend: cuando los endpoints
// /api/quality/... esten escritos, esto pasa a types/api.ts como espejo de los
// DTOs reales.

/** Estados de una HCA, en el orden en que avanzan. Se guardan como texto. */
export const HCA_STATUSES = [
  "Abierta",
  "En análisis",
  "En ejecución",
  "En verificación",
  "Cerrada",
] as const;

export type HcaStatus = (typeof HCA_STATUSES)[number];

/** Hoja de Corrección de Acción: documenta una no conformidad y su plan. */
export interface CorrectiveActionSheet {
  id: number;
  /** Numero visible, secuencial y unico; nunca se reutiliza. */
  number: string;
  /** Ticket que la origino, si lo hubo. La Bandeja todavia no existe. */
  ticketId: number | null;
  ticketNumber: string | null;
  clientId: number;
  /** Obligatoria: es el eje del seguimiento por linea de producto. */
  productLineId: number;
  /** Instante UTC en que se detecto la no conformidad. */
  detectedAt: string;
  /** Que ocurrio; obligatorio desde el alta. */
  description: string;
  /** Contencion aplicada de inmediato. */
  immediateAction: string | null;
  /** Obligatoria para pasar a ejecucion. */
  rootCause: string | null;
  /** Dueño de la hoja. */
  responsibleStaffId: number;
  /** Fecha comprometida de cierre, en ISO corto: es un dia, no un instante. */
  dueDate: string;
  status: HcaStatus;
  /** Verificacion de eficacia; obligatoria para cerrar. */
  effectivenessCheckAt: string | null;
  effectivenessNotes: string | null;
  closedAt: string | null;
  closedByStaffId: number | null;
  /** Nota de cierre: una hoja abierta por error se cierra explicandolo, no se borra. */
  closingNote: string | null;
  createdAt: string;
}

/** Estados de una accion del plan. `Vencida` la deriva la vista, no el dato. */
export const PLAN_ITEM_STATUSES = ["Pendiente", "En curso", "Cumplida", "Anulada"] as const;

export type PlanItemStatus = (typeof PLAN_ITEM_STATUSES)[number];

/** Cada accion del plan de una HCA. */
export interface ActionPlanItem {
  id: number;
  sheetId: number;
  description: string;
  responsibleStaffId: number;
  /** Fecha comprometida, ISO corto. */
  dueDate: string;
  /** Fecha de cumplimiento, ISO corto; null mientras no se cumpla. */
  completedAt: string | null;
  status: PlanItemStatus;
  /** Obligatoria al anular: una accion no se borra, se anula justificando. */
  cancelReason: string | null;
}

export const CREDIT_STATUSES = ["Solicitada", "Aprobada", "Rechazada", "Aplicada"] as const;

export type CreditStatus = (typeof CREDIT_STATUSES)[number];

export const CURRENCIES = ["DOP", "USD"] as const;

export type Currency = (typeof CURRENCIES)[number];

/** Solicitud de nota de credito al cliente. */
export interface CreditRequest {
  id: number;
  number: string;
  ticketId: number | null;
  ticketNumber: string | null;
  clientId: number;
  /** Obligatorio y positivo; no se modifica una vez aprobado. */
  amount: number;
  currency: Currency;
  reason: string;
  /** Referencia de factura sobre la que se emite el credito. */
  invoiceRef: string | null;
  status: CreditStatus;
  requestedByStaffId: number;
  requestedAt: string;
  /** Quien aprobo o rechazo; nunca puede ser el solicitante. */
  decidedByStaffId: number | null;
  decidedAt: string | null;
  decisionNote: string | null;
  /** Por qué quien mira no puede decidir esta solicitud; null cuando sí puede. */
  decisionBlockedReason: string | null;
}

/** Personal referenciado por las hojas y las solicitudes. */
export interface QualityStaff {
  id: number;
  name: string;
}
