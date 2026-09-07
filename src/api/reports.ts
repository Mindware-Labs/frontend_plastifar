import { apiRequest, toQuery } from "./client";

export interface QualityReport {
  range: { from: string; to: string };
  openedInRange: number;
  closedInRange: number;
  openNow: number;
  overdueNow: number;
  /**
   * Decimal con un digito, o null cuando no se cerro ninguna HCA en el rango.
   * Era un entero, y una media real de medio dia llegaba como `0`; «cero dias»
   * y «no hay dato» son hechos distintos y la pantalla los pintaba igual.
   */
  averageClosureDays: number | null;
  byMonth: { month: string; opened: number; closed: number }[];
  credits: {
    count: number;
    byCurrency: { currency: string; count: number; total: number }[];
    /**
     * `false` cuando hay un filtro activo que este bloque no puede honrar. Una
     * solicitud de credito se emite contra un cliente, no contra una linea de
     * producto ni contra el responsable de una HCA, asi que con esos dos filtros
     * las notas siguen contando todo el periodo. El numero es cierto; lo que
     * cambia es a que pregunta responde, y la pantalla tiene que decirlo.
     */
    scoped: boolean;
  };
}

/** Lo que acota un reporte de Calidad ademas del rango de fechas. */
export interface QualityFilters {
  clientId?: number;
  productLineId?: number;
  responsibleStaffId?: number;
}

/** Lo que acota el reporte de Clientes. Es una foto: no lleva rango. */
export interface ClientsFilters {
  territoryId?: number;
  salesRepStaffId?: number;
  type?: string;
  activeOnly?: boolean;
}

export interface ClientsReport {
  total: number;
  active: number;
  withoutSalesRep: number;
  byTerritory: { territory: string; total: number; active: number }[];
  bySalesRep: { salesRep: string; clients: number }[];
}

export interface AuditLogRow {
  id: number;
  /** Identificador del actor: dos personas pueden llamarse igual. */
  actorId: number;
  actor: string;
  entity: string;
  /**
   * Texto, no numero: AuditLog.EntityId es una columna de texto y
   * AuditExtensions la escribe con entityId.ToString(). Hay identificadores
   * compuestos ("12:3" para un acceso departamental) que no son un numero.
   */
  entityId: string;
  action: string;
  createdAt: string;
}

/** Contadores del contrato de la seccion 12.1: «all» mas una casilla por accion. */
export type AuditCounts = Record<string, number>;

/**
 * `GET /api/reports/audit`: la bitacora completa del periodo. Su `byActor`
 * cuenta acciones de cualquier tipo, no accesos —responde «quien hizo mas
 * cosas»—; el reporte «Accesos por usuario» de la seccion 11.2 es
 * `/api/reports/audit/logins`.
 */
export interface AuditReport {
  range: { from: string; to: string };
  byActor: { actorId: number; actor: string; actions: number }[];
  byAction: { action: string; count: number }[];
  items: AuditLogRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  counts: AuditCounts;
}

/**
 * Fila de uno de los tres reportes de auditoria que miran una accion concreta.
 * `ipAddress` y `userAgent` solo los escribe el acceso: en una desactivacion o
 * en una revocacion llegan nulos, y eso no es un dato que falte.
 */
export interface AuditSliceRow extends AuditLogRow {
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * Forma comun de `/audit/logins`, `/audit/deactivations` y
 * `/audit/revoked-sessions`. `count` y `lastAt` en lugar de `actions`: aqui
 * todas las filas son la misma accion, asi que lo que interesa es cuantas veces
 * y cuando fue la ultima.
 */
export interface AuditSliceReport {
  range: { from: string; to: string };
  byActor: { actorId: number; actor: string; count: number; lastAt: string }[];
  byAction: { action: string; count: number }[];
  items: AuditSliceRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  counts: AuditCounts;
}

function auditSlice(path: string) {
  return (from: string, to: string, page: number, pageSize: number) =>
    apiRequest<AuditSliceReport>(`/api/reports/${path}${toQuery({ from, to, page, pageSize })}`);
}

export const reportsApi = {
  quality: (from: string, to: string, filters: QualityFilters = {}) =>
    apiRequest<QualityReport>(`/api/reports/quality${toQuery({ from, to, ...filters })}`),

  clients: (filters: ClientsFilters = {}) =>
    apiRequest<ClientsReport>(`/api/reports/clients${toQuery({ ...filters })}`),

  audit: (from: string, to: string, page: number, pageSize: number) =>
    apiRequest<AuditReport>(`/api/reports/audit${toQuery({ from, to, page, pageSize })}`),

  /** «Accesos por usuario» (seccion 11.2): quien entro, cuando y desde donde. */
  auditLogins: auditSlice("audit/logins"),

  /** «Bajas y desactivaciones» (seccion 11.2). */
  auditDeactivations: auditSlice("audit/deactivations"),

  /** «Sesiones revocadas» (seccion 11.2). */
  auditRevokedSessions: auditSlice("audit/revoked-sessions"),
};
