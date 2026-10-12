// Espejo de api/Dtos/ClaimDtos.cs (docs/plan/03, sección 6).
//
// Las enumeraciones viajan como texto legible, tal como las escribe el
// PF-FOR-034. Los nombres de cliente, contacto y departamento llegan resueltos
// desde el ticket: el formulario no los duplica.

export const CLAIM_REASONS = ["Sobrante", "Faltante", "Contaminación", "Cruce", "Otros"] as const;
export type ClaimReason = (typeof CLAIM_REASONS)[number];

export const CLAIM_AREAS = ["Calidad", "Almacén", "Ventas"] as const;
export type ClaimAffectedArea = (typeof CLAIM_AREAS)[number];

export const CLAIM_DEFECT_MOMENTS = ["Recibo", "Uso"] as const;
export type ClaimDefectFoundDuring = (typeof CLAIM_DEFECT_MOMENTS)[number];

/** Estados en el orden en que avanzan (docs/plan/03, 8.1). */
export const CLAIM_STATUSES = ["Registrada", "En tratamiento", "Cerrada"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const CLAIM_CURRENCIES = ["DOP", "USD"] as const;

export interface ClaimLine {
  id: number;
  productId: number;
  /** Copia en el momento de registrar: el catálogo puede cambiar después. */
  productCode: string;
  productName: string;
  unitsPurchased: number | null;
  defectiveQuantity: number | null;
  invoicedQuantity: number | null;
  receivedQuantity: number | null;
  unitPrice: number | null;
  /** Facturados menos recibidos; negativa cuando hay sobrante. Calculada en el servidor. */
  difference: number;
  /** Diferencia por precio. Calculado en el servidor. */
  lineTotal: number;
  position: number;
}

export interface ClaimPlant {
  id: number;
  name: string;
}

export interface CustomerClaim {
  id: number;
  ticketId: number;
  /** El `Código:` del formulario es el número del ticket (pregunta 3). */
  ticketNumber: string;
  ticketSubject: string;
  departmentId: number | null;
  departmentName: string | null;
  clientId: number;
  clientName: string;
  clientCode: string | null;
  clientPhone: string | null;
  contactName: string | null;
  contactPhone: string | null;
  /** ISO corto: es un día, no un instante. */
  claimDate: string;
  country: string | null;
  reason: ClaimReason;
  reasonOther: string | null;
  affectedAreas: ClaimAffectedArea[];
  plants: ClaimPlant[];
  productionLot: string | null;
  invoiceRef: string | null;
  poNumber: string | null;
  unitsToReturn: number | null;
  defectFoundDuring: ClaimDefectFoundDuring | null;
  currency: string | null;
  /** Suma de todas las líneas, calculada en el servidor. */
  totalAmount: number;
  description: string;
  comments: string | null;
  receivedByStaffId: number;
  receivedByName: string;
  receivedAt: string;
  firstCustomerContactAt: string | null;
  status: ClaimStatus;
  // Sección IV: para uso exclusivo del Departamento de Calidad.
  firstResponseCorrection: string | null;
  requiresCorrectiveAction: boolean | null;
  rootCauseAnalysis: string | null;
  correctiveActions: string | null;
  customerSatisfied: boolean | null;
  observations: string | null;
  closedAt: string | null;
  closedByStaffId: number | null;
  closedByName: string | null;
  /** Días entre la fecha de la reclamación y el cierre; null mientras siga abierta. */
  responseDays: number | null;
  /** HCA ligada al mismo ticket, si existe (regla 9). */
  hcaId: number | null;
  hcaNumber: string | null;
  createdAt: string;
  updatedAt: string;
  lines: ClaimLine[];
}

/** Lo que falta para cerrar, resuelto por el servidor. */
export interface ClaimClosureCondition {
  id: string;
  label: string;
  met: boolean;
  missing: string;
}

export interface ClaimDetail {
  claim: CustomerClaim;
  closureConditions: ClaimClosureCondition[];
  canClose: boolean;
}

/** Fila del listado (sección 11). */
export interface ClaimSummary {
  id: number;
  ticketId: number;
  ticketNumber: string;
  clientId: number;
  clientName: string;
  departmentId: number | null;
  departmentName: string | null;
  claimDate: string;
  reason: ClaimReason;
  reasonOther: string | null;
  plants: string[];
  currency: string | null;
  totalAmount: number;
  status: ClaimStatus;
  receivedByName: string;
  closedAt: string | null;
  hasHca: boolean;
}

export interface ClaimLineInput {
  productId: number;
  unitsPurchased: number | null;
  defectiveQuantity: number | null;
  invoicedQuantity: number | null;
  receivedQuantity: number | null;
  unitPrice: number | null;
}

/** Secciones I a III. Diferencia y total no se envían: los calcula el servidor. */
export interface SaveClaimRequest {
  claimDate: string;
  country: string | null;
  reason: ClaimReason;
  reasonOther: string | null;
  affectedAreas: ClaimAffectedArea[];
  plantIds: number[];
  productionLot: string | null;
  invoiceRef: string | null;
  poNumber: string | null;
  unitsToReturn: number | null;
  defectFoundDuring: ClaimDefectFoundDuring | null;
  currency: string | null;
  description: string;
  comments: string | null;
  receivedAt: string | null;
  firstCustomerContactAt: string | null;
  lines: ClaimLineInput[];
}

/** Sección IV. */
export interface ClaimTreatmentRequest {
  firstResponseCorrection: string | null;
  requiresCorrectiveAction: boolean | null;
  rootCauseAnalysis: string | null;
  correctiveActions: string | null;
  customerSatisfied: boolean | null;
  observations: string | null;
}
