export type TaskPriority = "Emergencia" | "Alta" | "Normal" | "Baja";
export type TaskStatus = "Pendiente" | "EnProgreso" | "Completada" | "Cancelada";
export type TaskOrigin = "Manual" | "Correo";
export type TaskAttachmentKind = "Inicial" | "Seguimiento" | "Evidencia";
export type TaskEventType =
  | "Creacion"
  | "Asignacion"
  | "CambioEstado"
  | "Comentario"
  | "AdjuntoSubido"
  | "Completada"
  | "Reabierta"
  | "Cancelada";

export interface TaskCounts {
  all: number;
  mine: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
}

/** Tarea ligada a un correo en bandeja (cualquier estado). */
export interface EmailLinkedTask {
  id: number;
  number: string;
  title: string;
  status: TaskStatus;
  origin: TaskOrigin;
  createdAt: string;
}

export interface TaskListItem {
  id: number;
  number: string;
  title: string;
  instructionsPreview: string;
  assignedStaffId: number | null;
  assignedStaffName: string | null;
  departmentId: number;
  departmentName: string;
  priority: TaskPriority;
  status: TaskStatus;
  clientId: number | null;
  clientName: string | null;
  contactId: number | null;
  contactName: string | null;
  emailId: number | null;
  origin: TaskOrigin;
  dueDate: string | null;
  slaPolicyId: number | null;
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
  createdByStaffId: number;
  createdByName: string;
}

export interface TaskListResponse {
  items: TaskListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  counts: TaskCounts;
}

export interface TaskAttachment {
  id: number;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  kind: TaskAttachmentKind;
  uploadedByStaffId: number | null;
  uploadedByName: string | null;
  createdAt: string;
}

export interface TaskComment {
  id: number;
  authorStaffId: number;
  authorName: string;
  comment: string;
  createdAt: string;
}

export interface TaskEvent {
  id: number;
  eventType: TaskEventType;
  actorStaffId: number;
  actorName: string;
  details: string;
  createdAt: string;
}

export interface TaskDetail {
  id: number;
  number: string;
  title: string;
  instructions: string;
  assignedStaffId: number | null;
  assignedStaffName: string | null;
  departmentId: number;
  departmentName: string;
  priority: TaskPriority;
  status: TaskStatus;
  clientId: number | null;
  clientName: string | null;
  contactId: number | null;
  contactName: string | null;
  emailId: number | null;
  emailSubject: string | null;
  origin: TaskOrigin;
  dueDate: string | null;
  slaPolicyId: number | null;
  isOverdue: boolean;
  createdByStaffId: number;
  createdByName: string;
  completedAt: string | null;
  completedByStaffId: number | null;
  completedByName: string | null;
  completionComment: string | null;
  cancelledAt: string | null;
  cancelledByStaffId: number | null;
  cancelledByName: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  canComplete: boolean;
  canCancel: boolean;
  canReopen: boolean;
  canComment: boolean;
  attachments: TaskAttachment[];
  comments: TaskComment[];
  events: TaskEvent[];
}

export interface SenderMatch {
  clientId: number | null;
  clientName: string | null;
  contactId: number | null;
  contactName: string | null;
}

export interface UpdateTaskRequest {
  title: string;
  instructions: string;
  departmentId: number;
  assignedStaffId: number | null;
  slaPolicyId: number;
  status: TaskStatus | null;
  clientId: number | null;
  contactId: number | null;
  dueDate: string | null;
}

export interface EmailTaskPrefill {
  emailId: number;
  title: string;
  instructions: string;
  senderEmail: string;
  attachments: { id: number; fileName: string; sizeBytes: number; available: boolean; dangerous: boolean }[];
}

export interface BulkAssignTasksRequest {
  taskIds: number[];
  staffId: number | null;
}

export interface BulkPriorityTasksRequest {
  taskIds: number[];
  priority: TaskPriority;
}

export interface BulkStatusTasksRequest {
  taskIds: number[];
  status: "Pendiente" | "EnProgreso";
}

export interface BulkCompleteTasksRequest {
  taskIds: number[];
  comment?: string;
}

export interface BulkCancelTasksRequest {
  taskIds: number[];
  reason: string;
}

export interface BulkActionResult {
  updatedCount: number;
  totalRequested: number;
}
