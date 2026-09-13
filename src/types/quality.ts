// Espejo de api/Dtos/QualityDtos.cs (seccion 10 del plan de construccion).
//
// Los nombres visibles —cliente, linea de producto, responsable, solicitante—
// viajan ya resueltos desde el servidor. Reconstruirlos aqui contra un catalogo
// propio obligaba a traerse la tabla entera al navegador, que es justo lo que
// prohibe la seccion 4.1: con mas registros de los que ese catalogo alcanzaba a
// traer, la columna se quedaba en «—».

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
  /** Nombre del cliente, resuelto por el servidor. */
  clientName: string;
  /** Obligatoria: es el eje del seguimiento por linea de producto. */
  productLineId: number;
  productLineName: string;
  /** Instante UTC en que se detecto la no conformidad. */
  detectedAt: string;
  /** Que ocurrio; obligatorio desde el alta. */
  description: string;
  /** Contencion aplicada de inmediato. */
  immediateAction: string | null;
  /** Obligatoria para pasar a ejecucion. */
  rootCause: string | null;
  /** Dueño de la HCA. */
  responsibleStaffId: number;
  responsibleName: string;
  /** Fecha comprometida de cierre, en ISO corto: es un dia, no un instante. */
  dueDate: string;
  status: HcaStatus;
  /** Verificacion de eficacia; obligatoria para cerrar. */
  effectivenessCheckAt: string | null;
  effectivenessNotes: string | null;
  closedAt: string | null;
  closedByStaffId: number | null;
  /** Resuelto en SQL: buscarlo en la lista de personal activo dejaba un
   *  guion cuando quien cerro la hoja se desactivo despues. */
  closedByName: string | null;
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
  /** Resuelto por el servidor: la tabla ya no lo busca contra una lista topada. */
  responsibleName: string;
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
  clientName: string;
  /** Obligatorio y positivo; no se modifica una vez aprobado. */
  amount: number;
  currency: Currency;
  reason: string;
  /** Referencia de factura sobre la que se emite el credito. */
  invoiceRef: string | null;
  status: CreditStatus;
  requestedByStaffId: number;
  requestedByName: string;
  requestedAt: string;
  /** Quien aprobo o rechazo; nunca puede ser el solicitante. */
  decidedByStaffId: number | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  /** Por qué quien mira no puede decidir esta solicitud; null cuando sí puede. */
  decisionBlockedReason: string | null;
}

/**
 * Personal disponible para los desplegables de Calidad. Los nombres que se
 * muestran ya vienen resueltos en cada respuesta; esto solo alimenta los
 * `<select>` de filtro y de formulario, y el responsable de cada accion del
 * plan, que es el unico nombre que el servidor todavia no resuelve.
 */
export interface QualityStaff {
  id: number;
  name: string;
}
