import { apiRequest, toQuery } from "./client";
import type { ActionPlanItem, CorrectiveActionSheet, CreditRequest } from "../types/quality";

export interface SheetQuery {
  page: number;
  pageSize: number;
  search?: string;
  productLineId?: number;
  responsibleId?: number;
  clientId?: number;
  /** ISO corto YYYY-MM-DD */
  from?: string;
  to?: string;
  /** todas | abiertas | vencidas | cerradas */
  status?: string;
  sort?: "compromiso" | "cliente";
  dir?: "asc" | "desc";
}

export interface SheetCounts {
  all: number;
  open: number;
  overdue: number;
  closed: number;
}

export interface SheetListResponse {
  items: CorrectiveActionSheet[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  counts: SheetCounts;
}

export interface ClosureCondition {
  id: string;
  label: string;
  met: boolean;
  missing: string;
}

export interface SheetDetailResponse {
  sheet: CorrectiveActionSheet;
  planItems: ActionPlanItem[];
  closureConditions: ClosureCondition[];
  canClose: boolean;
}

export interface SaveSheetRequest {
  clientId: number;
  productLineId: number;
  detectedAt: string;
  description: string;
  immediateAction: string | null;
  rootCause: string | null;
  responsibleStaffId: number;
  dueDate: string;
  ticketId: number | null;
}

export interface SavePlanItemRequest {
  description: string;
  responsibleStaffId: number;
  dueDate: string;
}

export interface CreditQuery {
  page: number;
  pageSize: number;
  search?: string;
  clientId?: number;
  minAmount?: number;
  /** Solicitada | Aprobada | Rechazada | Aplicada */
  status?: string;
  dir?: "asc" | "desc";
}

export interface CreditCounts {
  all: number;
  requested: number;
  approved: number;
  rejected: number;
  applied: number;
}

export interface CreditListResponse {
  items: CreditRequest[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  counts: CreditCounts;
}

export interface SaveCreditRequestRequest {
  clientId: number;
  amount: number;
  currency: string;
  reason: string;
  invoiceRef: string | null;
  ticketId: number | null;
}

export const qualityApi = {
  sheets: {
    list: (query: SheetQuery) =>
      apiRequest<SheetListResponse>(`/api/quality/sheets${toQuery({ ...query })}`),

    get: (id: number) => apiRequest<SheetDetailResponse>(`/api/quality/sheets/${id}`),

    create: (data: SaveSheetRequest) =>
      apiRequest<CorrectiveActionSheet>("/api/quality/sheets", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    update: (id: number, data: SaveSheetRequest) =>
      apiRequest<CorrectiveActionSheet>(`/api/quality/sheets/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    advance: (id: number, status: string) =>
      apiRequest<CorrectiveActionSheet>(`/api/quality/sheets/${id}/advance`, {
        method: "POST",
        body: JSON.stringify({ status }),
      }),

    registerEffectiveness: (id: number, checkedOn: string, notes: string) =>
      apiRequest<CorrectiveActionSheet>(`/api/quality/sheets/${id}/effectiveness`, {
        method: "POST",
        body: JSON.stringify({ checkedOn, notes }),
      }),

    close: (id: number, closingNote: string | null) =>
      apiRequest<CorrectiveActionSheet>(`/api/quality/sheets/${id}/close`, {
        method: "POST",
        body: JSON.stringify({ closingNote }),
      }),
  },

  planItems: {
    create: (sheetId: number, data: SavePlanItemRequest) =>
      apiRequest<ActionPlanItem>(`/api/quality/sheets/${sheetId}/plan`, {
        method: "POST",
        body: JSON.stringify(data),
      }),

    update: (id: number, data: SavePlanItemRequest) =>
      apiRequest<ActionPlanItem>(`/api/quality/plan-items/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    complete: (id: number) =>
      apiRequest<ActionPlanItem>(`/api/quality/plan-items/${id}/complete`, { method: "POST" }),

    cancel: (id: number, cancelReason: string) =>
      apiRequest<ActionPlanItem>(`/api/quality/plan-items/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ cancelReason }),
      }),
  },

  creditRequests: {
    list: (query: CreditQuery) =>
      apiRequest<CreditListResponse>(`/api/quality/credit-requests${toQuery({ ...query })}`),

    get: (id: number) => apiRequest<CreditRequest>(`/api/quality/credit-requests/${id}`),

    create: (data: SaveCreditRequestRequest) =>
      apiRequest<CreditRequest>("/api/quality/credit-requests", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    approve: (id: number, decisionNote: string | null) =>
      apiRequest<CreditRequest>(`/api/quality/credit-requests/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({ decisionNote }),
      }),

    reject: (id: number, decisionNote: string | null) =>
      apiRequest<CreditRequest>(`/api/quality/credit-requests/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ decisionNote }),
      }),

    apply: (id: number) =>
      apiRequest<CreditRequest>(`/api/quality/credit-requests/${id}/apply`, { method: "POST" }),
  },
};
