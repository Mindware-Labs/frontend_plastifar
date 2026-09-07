import { apiBlob, apiRequest, toQuery } from "./client";
import type {
  AttachmentLinkResponse,
  ContactResponse,
  EmailNoteResponse,
  StaffOptionResponse,
  EmailBulkAction,
  EmailBulkResponse,
  EmailDetailResponse,
  EmailFolderCounts,
  EmailListResponse,
  EmailThreadMessageResponse,
  EmptyTrashResponse,
  TicketSummaryResponse,
} from "../types/api";

export interface EmailQuery {
  page: number;
  pageSize: number;
  /** inbox | archived | starred | trash | sent */
  folder?: string;
  /** todos | sin-ticket | con-ticket | sin-responder */
  filter?: string;
  search?: string;
  /** Direccion exacta, como remitente o destinatario de cualquier correo del hilo. */
  from?: string;
  /** ISO con zona; until es exclusivo (la medianoche siguiente al ultimo dia). */
  since?: string;
  until?: string;
  hasAttachments?: string;
  /** Etiqueta exacta de la conversacion. */
  tag?: string;
}

/** Lo que comparten respuesta, correo nuevo y reenvio. */
export interface OutboundInput {
  body: string;
  bodyHtml?: string;
  cc?: string;
  bcc?: string;
  files?: File[];
  clientToken?: string;
}

function buildForm(input: OutboundInput) {
  const form = new FormData();
  form.append("body", input.body);
  if (input.clientToken) form.append("clientToken", input.clientToken);
  if (input.bodyHtml) form.append("bodyHtml", input.bodyHtml);
  if (input.cc) form.append("cc", input.cc);
  if (input.bcc) form.append("bcc", input.bcc);
  for (const file of input.files ?? []) form.append("attachments", file);
  return form;
}

export const emailsApi = {
  list: (query: EmailQuery) => apiRequest<EmailListResponse>(`/api/emails${toQuery({ ...query })}`),

  counts: () => apiRequest<EmailFolderCounts>("/api/emails/counts"),

  bulk: (ids: number[], action: EmailBulkAction) =>
    apiRequest<EmailBulkResponse>("/api/emails/bulk", {
      method: "POST",
      body: JSON.stringify({ ids, action }),
    }),

  // Solo desde la papelera; un 409 significa que la conversacion tiene ticket y se conserva.
  remove: (id: number) => apiRequest<void>(`/api/emails/${id}`, { method: "DELETE" }),

  emptyTrash: () => apiRequest<EmptyTrashResponse>("/api/emails/trash/empty", { method: "POST" }),

  markRead: (id: number) => apiRequest<void>(`/api/emails/${id}/read`, { method: "POST" }),

  markUnread: (id: number) => apiRequest<void>(`/api/emails/${id}/unread`, { method: "POST" }),

  // Limpia el "recien asignada" de quien la abre; a nadie mas le toca verla desaparecer.
  markAssignmentSeen: (id: number) => apiRequest<void>(`/api/emails/${id}/assign/seen`, { method: "POST" }),

  get: (id: number) => apiRequest<EmailDetailResponse>(`/api/emails/${id}`),

  // download fuerza la descarga: sin el, los tipos que el navegador sabe mostrar se abren.
  attachmentLink: (emailId: number, attachmentId: number, download = false) =>
    apiRequest<AttachmentLinkResponse>(
      `/api/emails/${emailId}/attachments/${attachmentId}${toQuery({ download: download ? "true" : undefined })}`,
    ),

  reply: (id: number, input: OutboundInput) =>
    apiRequest<EmailThreadMessageResponse>(`/api/emails/${id}/reply`, {
      method: "POST",
      body: buildForm(input),
    }),

  compose: (input: OutboundInput & { to: string; subject: string }) => {
    const form = buildForm(input);
    form.append("to", input.to);
    form.append("subject", input.subject);

    return apiRequest<EmailThreadMessageResponse>("/api/emails/compose", {
      method: "POST",
      body: form,
    });
  },

  // El comentario puede ir vacio; el original viaja debajo, con sus adjuntos salvo que se pida lo contrario.
  forward: (id: number, input: OutboundInput & { to: string; includeAttachments: boolean }) => {
    const form = buildForm(input);
    form.append("to", input.to);
    form.append("includeAttachments", input.includeAttachments ? "true" : "false");

    return apiRequest<EmailThreadMessageResponse>(`/api/emails/${id}/forward`, {
      method: "POST",
      body: form,
    });
  },

  // Vuelve a poner en la cola de salida un correo que agoto sus reintentos.
  retry: (id: number) =>
    apiRequest<EmailThreadMessageResponse>(`/api/emails/${id}/retry`, { method: "POST" }),

  // ---- Conversacion: quien la atiende, notas, exportar ----

  assign: (id: number, staffId: number | null) =>
    apiRequest<{ assignedStaffId: number | null; assignedStaffName: string | null }>(`/api/emails/${id}/assign`, {
      method: "POST",
      body: JSON.stringify({ staffId }),
    }),

  notes: (id: number) => apiRequest<EmailNoteResponse[]>(`/api/emails/${id}/notes`),

  addNote: (id: number, body: string) =>
    apiRequest<EmailNoteResponse>(`/api/emails/${id}/notes`, { method: "POST", body: JSON.stringify({ body }) }),

  removeNote: (noteId: number) => apiRequest<void>(`/api/emails/notes/${noteId}`, { method: "DELETE" }),

  contacts: (q: string) => apiRequest<ContactResponse[]>(`/api/emails/contacts${toQuery({ q })}`),

  // El archivo llega con la sesion: se baja como blob y se entrega al navegador.
  exportConversation: (id: number) => apiBlob(`/api/emails/${id}/export`),

  staffOptions: () => apiRequest<StaffOptionResponse[]>("/api/staff/options"),

  createTicket: (id: number) =>
    apiRequest<TicketSummaryResponse>(`/api/emails/${id}/ticket`, { method: "POST" }),

  archive: (id: number) => apiRequest<void>(`/api/emails/${id}/archive`, { method: "POST" }),

  toggleStar: (id: number, starred?: boolean) =>
    apiRequest<{ starred: boolean }>(`/api/emails/${id}/star`, {
      method: "POST",
      body: JSON.stringify({ starred }),
    }),

  trash: (id: number) => apiRequest<void>(`/api/emails/${id}/trash`, { method: "POST" }),

  restore: (id: number) => apiRequest<void>(`/api/emails/${id}/restore`, { method: "POST" }),
};
