import { apiRequest, toQuery } from "./client";
import type {
  SenderMatch,
  TaskComment,
  TaskDetail,
  TaskListResponse,
  UpdateTaskRequest,
} from "../types/tasks";
import type { AttachmentLinkResponse } from "../types/api";

export interface TaskQuery {
  page: number;
  pageSize: number;
  search?: string;
  /** todas | mias | pendientes | enprogreso | completadas | vencidas */
  chip?: string;
  departmentId?: number;
  priority?: string;
  status?: string;
  sort?: string;
  dir?: "asc" | "desc";
}

export const tasksApi = {
  list: (query: TaskQuery) => apiRequest<TaskListResponse>(`/api/tasks${toQuery({ ...query })}`),

  get: (id: number) => apiRequest<TaskDetail>(`/api/tasks/${id}`),

  senderMatch: (email: string) =>
    apiRequest<SenderMatch>(`/api/tasks/sender-match${toQuery({ email })}`),

  create: (form: FormData) =>
    apiRequest<TaskDetail>("/api/tasks", { method: "POST", body: form }),

  update: (id: number, data: UpdateTaskRequest) =>
    apiRequest<TaskDetail>(`/api/tasks/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  comment: (id: number, comment: string) =>
    apiRequest<TaskComment>(`/api/tasks/${id}/comments`, {
      method: "POST",
      body: JSON.stringify({ comment }),
    }),

  addAttachments: (id: number, form: FormData) =>
    apiRequest<TaskDetail>(`/api/tasks/${id}/attachments`, { method: "POST", body: form }),

  complete: (id: number, form: FormData) =>
    apiRequest<TaskDetail>(`/api/tasks/${id}/complete`, { method: "POST", body: form }),

  cancel: (id: number, reason: string) =>
    apiRequest<TaskDetail>(`/api/tasks/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  reopen: (id: number, reason: string) =>
    apiRequest<TaskDetail>(`/api/tasks/${id}/reopen`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  attachmentLink: (id: number, attachmentId: number, download = false) =>
    apiRequest<AttachmentLinkResponse>(
      `/api/tasks/${id}/attachments/${attachmentId}${toQuery({ download: download || undefined })}`,
    ),
};
