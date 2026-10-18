// Espejo de api/Dtos/WithdrawalDtos.cs (docs/plan/04, sección 6).
//
// Estados, motivos y origen del error viajan como texto legible. Cliente,
// ticket y nombres llegan resueltos desde el servidor.

/** Estados de la solicitud, en el orden en que avanzan (8.1). */
export const WITHDRAWAL_STATUSES = ["Solicitado", "Aprobado", "Rechazado", "Retirado", "Cancelado"] as const;
export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];

export const WITHDRAWAL_REASONS = ["Por devolución", "Por cambio"] as const;
export type WithdrawalReason = (typeof WITHDRAWAL_REASONS)[number];

/** [Propuesta] deducida de la hoja SLA (filas 14 y 15); el formulario no lo tiene. */
export const WITHDRAWAL_ERROR_ORIGINS = ["Vendedor", "Almacén"] as const;
export type WithdrawalErrorOrigin = (typeof WITHDRAWAL_ERROR_ORIGINS)[number];

export const WITHDRAWAL_CURRENCIES = ["DOP", "USD"] as const;

export interface WithdrawalLine {
  id: number;
  productId: number;
  productCode: string;
  productName: string;
  /** `CANT.` */
  quantity: number;
  quantityUnit: string;
  /** `UNID`: texto mientras la pregunta 2 siga abierta. */
  packDetail: string | null;
  /** `P. UNIT.`, opcional (pregunta 4). */
  unitPrice: number | null;
  /** `VALOR`; nulo si la línea no lleva precio. */
  lineValue: number | null;
  /** Lo efectivamente recogido; se llena al registrar el retiro (regla 10). */
  withdrawnQuantity: number | null;
  /** Solicitado menos recogido. */
  difference: number | null;
  position: number;
}

export interface MerchandiseWithdrawal {
  id: number;
  number: string;
  ticketId: number;
  ticketNumber: string;
  ticketSubject: string;
  departmentId: number | null;
  departmentName: string | null;
  clientId: number;
  clientName: string;
  clientCode: string | null;
  /** YYYY-MM-DD */
  requestDate: string;
  reason: WithdrawalReason;
  errorOrigin: WithdrawalErrorOrigin | null;
  /** Con origen de error hace falta aprobar antes del retiro (regla 6). */
  requiresApproval: boolean;
  /** Departamento que la hoja SLA señala para aprobar; solo informativo. */
  approvalArea: string | null;
  currency: string | null;
  totalValue: number;
  status: WithdrawalStatus;
  requestedByStaffId: number;
  requestedByName: string;
  decidedByStaffId: number | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  warehouseStaffId: number | null;
  warehouseStaffName: string | null;
  withdrawnAt: string | null;
  customerSignerName: string | null;
  cancelledByStaffId: number | null;
  cancelledByName: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  lines: WithdrawalLine[];
}

/** Lo que la persona puede hacer ahora, ya calculado por el servidor. */
export interface WithdrawalDetail {
  withdrawal: MerchandiseWithdrawal;
  canEdit: boolean;
  canDecide: boolean;
  canComplete: boolean;
  canCancel: boolean;
}

export interface WithdrawalSummary {
  id: number;
  number: string;
  ticketId: number;
  ticketNumber: string;
  clientId: number;
  clientName: string;
  departmentId: number | null;
  departmentName: string | null;
  requestDate: string;
  reason: WithdrawalReason;
  errorOrigin: WithdrawalErrorOrigin | null;
  requiresApproval: boolean;
  lineCount: number;
  currency: string | null;
  totalValue: number;
  status: WithdrawalStatus;
  requestedByStaffId: number;
  requestedByName: string;
}

export interface WithdrawalLineInput {
  productId: number;
  quantity: number;
  quantityUnit: string;
  packDetail: string | null;
  unitPrice: number | null;
}

export interface SaveWithdrawalRequest {
  requestDate: string;
  reason: WithdrawalReason;
  errorOrigin: WithdrawalErrorOrigin | null;
  currency: string | null;
  lines: WithdrawalLineInput[];
}

export interface CompleteWithdrawalRequest {
  customerSignerName: string;
  lines: { lineId: number; withdrawnQuantity: number }[];
}
