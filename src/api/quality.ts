import { apiRequest, toQuery } from "./client";
import type { AttachmentLinkResponse } from "../types/api";
import type {
  ActionPlanItem,
  CorrectiveActionSheet,
  HcaCause,
  HcaParticipant,
  HcaQuery,
  SheetListResponse,
} from "../types/quality";

export interface SheetDetailResponse {
  sheet: CorrectiveActionSheet;
  planItems: ActionPlanItem[];
}

export interface SaveSheetRequest {
  clientId: number;
  productLineId: number;
  detectedAt: string;
  description: string;
  immediateAction: string | null;
  responsibleStaffId: number | null;
  responsibleManualName: string | null;
  dueDate: string;
  ticketId: number | null;
  productId: number | null;
  plantId: number | null;
  comments: string | null;
  /** Reemplaza la lista entera, en orden; null la deja como está. */
  causes: string[] | null;
}

export interface SavePlanItemRequest {
  description: string;
  responsibleStaffId: number | null;
  responsibleManualName: string | null;
  dueDate: string;
  evidenceNotes: string | null;
}

export interface SaveParticipantRequest {
  staffId: number | null;
  name: string | null;
}

export interface PlanItemQuery {
  page?: number;
  pageSize?: number;
  /** todas | pendientes | encurso | cumplidas | anuladas */
  status?: string;
}

/**
 * Espejo de `PlanItemCounts` en QualityDtos.cs. «En curso» tiene casilla
 * propia: el servidor conserva ese estado, y sin contarlo una accion ya
 * empezada no caeria en ninguna pastilla.
 */
export interface PlanItemCounts {
  all: number;
  pending: number;
  inProgress: number;
  done: number;
  cancelled: number;
}

/** ActionPlanController.List pagina en servidor desde la seccion 4.1 del plan. */
export interface ActionPlanListResponse {
  items: ActionPlanItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  counts: PlanItemCounts;
}

export const qualityApi = {
  sheets: {
    list: (query?: HcaQuery) =>
      apiRequest<SheetListResponse>(`/api/quality/sheets${toQuery(query ?? {})}`),

    listByTicket: (ticketId: number) =>
      apiRequest<CorrectiveActionSheet[]>(`/api/tickets/${ticketId}/sheets`),

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
    /**
     * El plan de la HCA por si solo, paginado, sin volver a pedir la ficha
     * entera. Sin `pageSize` por omision: el tamano lo decide la tabla.
     */
    list: (sheetId: number, query: PlanItemQuery = {}) =>
      apiRequest<ActionPlanListResponse>(
        `/api/quality/sheets/${sheetId}/plan${toQuery({ ...query })}`,
      ),

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

    /**
     * Marca la accion como empezada. Sin esta transicion «En curso» era un
     * estado inalcanzable: lo que nadie ha tocado y lo que ya se esta haciendo
     * se veian igual.
     */
    start: (id: number) =>
      apiRequest<ActionPlanItem>(`/api/quality/plan-items/${id}/start`, { method: "POST" }),

    complete: (id: number) =>
      apiRequest<ActionPlanItem>(`/api/quality/plan-items/${id}/complete`, { method: "POST" }),

    cancel: (id: number, cancelReason: string) =>
      apiRequest<ActionPlanItem>(`/api/quality/plan-items/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ cancelReason }),
      }),

    /** RF-H4: evidencias de implementación, como multipart. El servidor devuelve la acción con sus archivos. */
    uploadEvidence: (id: number, files: File[]) => {
      const form = new FormData();
      files.forEach((file) => form.append("Files", file));
      return apiRequest<ActionPlanItem>(`/api/quality/plan-items/${id}/attachments`, {
        method: "POST",
        body: form,
      });
    },

    evidenceLink: (id: number, attachmentId: number, download = false) =>
      apiRequest<AttachmentLinkResponse>(
        `/api/quality/plan-items/${id}/attachments/${attachmentId}${toQuery({
          download: download ? "true" : undefined,
        })}`,
      ),

    removeEvidence: (id: number, attachmentId: number) =>
      apiRequest<void>(`/api/quality/plan-items/${id}/attachments/${attachmentId}`, { method: "DELETE" }),
  },

  /** RF-H3: causas de la hoja; la lista completa también viaja en la ficha. */
  causes: {
    add: (sheetId: number, description: string) =>
      apiRequest<HcaCause>(`/api/quality/sheets/${sheetId}/causes`, {
        method: "POST",
        body: JSON.stringify({ description }),
      }),
    update: (id: number, description: string) =>
      apiRequest<HcaCause>(`/api/quality/causes/${id}`, {
        method: "PUT",
        body: JSON.stringify({ description }),
      }),
    remove: (id: number) => apiRequest<void>(`/api/quality/causes/${id}`, { method: "DELETE" }),
  },

  /** RF-H5: participantes del análisis. */
  participants: {
    add: (sheetId: number, data: SaveParticipantRequest) =>
      apiRequest<HcaParticipant>(`/api/quality/sheets/${sheetId}/participants`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    remove: (id: number) => apiRequest<void>(`/api/quality/participants/${id}`, { method: "DELETE" }),
    acknowledge: (id: number) =>
      apiRequest<HcaParticipant>(`/api/quality/participants/${id}/acknowledge`, { method: "POST" }),
  },
};
