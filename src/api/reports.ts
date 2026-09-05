import { apiRequest, toQuery } from "./client";

export interface QualityReport {
  range: { from: string; to: string };
  openedInRange: number;
  closedInRange: number;
  openNow: number;
  overdueNow: number;
  averageClosureDays: number;
  byMonth: { month: string; opened: number; closed: number }[];
  credits: { count: number; byCurrency: { currency: string; count: number; total: number }[] };
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

export interface AuditReport {
  range: { from: string; to: string };
  byActor: { actor: string; actions: number }[];
  byAction: { action: string; count: number }[];
  items: AuditLogRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const reportsApi = {
  quality: (from: string, to: string) =>
    apiRequest<QualityReport>(`/api/reports/quality${toQuery({ from, to })}`),

  clients: () => apiRequest<ClientsReport>("/api/reports/clients"),

  audit: (from: string, to: string, page: number, pageSize: number) =>
    apiRequest<AuditReport>(`/api/reports/audit${toQuery({ from, to, page, pageSize })}`),
};
