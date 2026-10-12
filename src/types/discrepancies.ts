// Espejo de api/Dtos/DiscrepancyDtos.cs (docs/plan/06, sección 6).
//
// Estados y resultados viajan como texto legible. Cliente, ticket y nombres
// llegan resueltos desde el servidor.

/** Estados de la investigación, en el orden en que avanzan (8.1). */
export const DISCREPANCY_STATUSES = ["En investigación", "Completada", "Aprobada", "Devuelta"] as const;
export type DiscrepancyStatus = (typeof DISCREPANCY_STATUSES)[number];

export const CHECK_RESULTS = ["Positivo", "Negativo"] as const;
export type SecurityCheckResult = (typeof CHECK_RESULTS)[number];

export interface DiscrepancyLine {
  id: number;
  /** `# Reclamo`; por defecto, el número del ticket. */
  claimRef: string | null;
  invoiceRef: string;
  clientId: number;
  clientName: string;
  productId: number;
  productCode: string;
  productName: string;
  /** Sobrante o faltante, no ambos (regla 6). */
  surplusQuantity: number;
  shortageQuantity: number;
  /** `Cumple Para Nota de Credito?` Nulo hasta que se decide. */
  qualifiesForCreditNote: boolean | null;
  /** `# N C`: la nota emitida fuera del sistema. */
  creditNoteNumber: string | null;
  /** Solicitud de crédito del panel creada desde esta línea. */
  creditRequestId: number | null;
  creditRequestNumber: string | null;
  dispatcherName: string;
  dispatcherStaffId: number | null;
  supervisorName: string | null;
  supervisorStaffId: number | null;
  position: number;
}

export interface SecurityCheck {
  itemNumber: number;
  text: string;
  result: SecurityCheckResult | null;
}

export interface SecurityItem {
  number: number;
  text: string;
}

export interface LoadDiscrepancy {
  id: number;
  number: string;
  ticketId: number;
  ticketNumber: string;
  ticketSubject: string;
  departmentId: number | null;
  departmentName: string | null;
  clientId: number | null;
  clientName: string | null;
  note: string | null;
  status: DiscrepancyStatus;
  /** Algún punto del 1 al 8 positivo; se calcula al completar (regla 4). */
  hasSecurityFinding: boolean;
  performedByStaffId: number | null;
  performedByName: string | null;
  performedAt: string | null;
  approvedByStaffId: number | null;
  approvedByName: string | null;
  approvedAt: string | null;
  approvalNote: string | null;
  /** Constancia del aviso automático a Seguridad y Logística (regla 9). */
  securityNotifiedAt: string | null;
  createdByStaffId: number | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  lines: DiscrepancyLine[];
  /** Siempre los nueve, respondidos o no. */
  checks: SecurityCheck[];
}

export interface DiscrepancyCompletionCondition {
  id: string;
  label: string;
  met: boolean;
  missing: string;
}

export interface DiscrepancyDetail {
  discrepancy: LoadDiscrepancy;
  completionConditions: DiscrepancyCompletionCondition[];
  canComplete: boolean;
}

export interface DiscrepancySummary {
  id: number;
  number: string;
  ticketId: number;
  ticketNumber: string;
  clientId: number | null;
  clientName: string | null;
  departmentId: number | null;
  departmentName: string | null;
  createdAt: string;
  lineCount: number;
  dispatchers: string[];
  hasSecurityFinding: boolean;
  status: DiscrepancyStatus;
  performedByName: string | null;
  performedAt: string | null;
}

export interface DiscrepancyLineInput {
  productId: number;
  invoiceRef: string;
  claimRef: string | null;
  clientId: number | null;
  surplusQuantity: number;
  shortageQuantity: number;
  qualifiesForCreditNote: boolean | null;
  creditNoteNumber: string | null;
  dispatcherName: string;
  dispatcherStaffId: number | null;
  supervisorName: string | null;
  supervisorStaffId: number | null;
}

export interface SecurityCheckInput {
  itemNumber: number;
  result: SecurityCheckResult | null;
}

/** `lines` y `checks` en null dejan lo que hay. */
export interface SaveDiscrepancyRequest {
  note: string | null;
  lines: DiscrepancyLineInput[] | null;
  checks: SecurityCheckInput[] | null;
}
