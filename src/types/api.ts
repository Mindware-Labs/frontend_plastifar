// Espejo de los DTOs del backend (api/api/Dtos/*.cs). Mantener sincronizado a mano.

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface VerifyResetCodeRequest {
  email: string;
  code: string;
}

export interface ResetPasswordRequest {
  email: string;
  code: string;
  newPassword: string;
}

export interface VerifyPasswordRequest {
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  /** Sesion actual: se conserva viva mientras las demas se cierran. */
  refreshToken: string | null;
}

export interface StaffResponse {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  primaryDepartmentId: number;
  isAdmin: boolean;
  isActive: boolean;
}

/** Respuesta paginada del listado de personal (GET /api/staff). */
export interface StaffListResponse {
  items: StaffResponse[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  counts: { all: number; active: number; inactive: number; admins: number };
}

export interface CreateStaffRequest {
  firstName: string;
  lastName: string;
  email: string;
  primaryDepartmentId: number;
  isAdmin: boolean;
}

export interface UpdateStaffRequest {
  firstName: string;
  lastName: string;
  email: string;
  primaryDepartmentId: number;
  isAdmin: boolean;
  isActive: boolean;
}

export interface RoleResponse {
  id: number;
  name: string;
  permissions: string[];
  isSystem: boolean;
  isActive: boolean;
}

/** Respuesta paginada del listado de roles (GET /api/roles). */
export interface RoleListResponse {
  items: RoleResponse[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  counts: { all: number; active: number; system: number; custom: number };
}

export interface CreateRoleRequest {
  name: string;
  permissions: string[];
}

export interface UpdateRoleRequest {
  name: string;
  permissions: string[];
  isActive: boolean;
}

export interface DepartmentResponse {
  id: number;
  name: string;
  isActive: boolean;
}

export interface ApiMessage {
  message: string;
}

export interface EmailAttachmentResponse {
  id: number;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

/** Enlace firmado al documento; inline = el navegador lo muestra en vez de descargarlo. */
export interface AttachmentLinkResponse {
  url: string;
  fileName: string;
  contentType: string;
  inline: boolean;
  expiresAt: string;
}

/** Fila de la bandeja (GET /api/emails): lo justo para decidir si vale la pena abrirlo. */
export interface EmailSummaryResponse {
  id: number;
  fromEmail: string;
  fromName: string | null;
  subject: string;
  preview: string;
  createdAt: string;
  ticketId: number | null;
  attachmentCount: number;
  /** Cuantos correos tiene la conversacion, contando los nuestros. */
  messageCount: number;
  /** Sin leer por quien consulta: la marca es de cada persona, no del equipo. */
  unread: boolean;
  /** El ultimo correo de la conversacion salio de aca. */
  answered: boolean;
}

export type EmailFolder = "Inbox" | "Archived" | "Junk" | "Trash";

export interface EmailDetailResponse {
  id: number;
  direction: "Inbound" | "Outbound";
  folder: EmailFolder;
  fromEmail: string;
  fromName: string | null;
  toEmails: string[];
  ccEmails: string[];
  subject: string;
  bodyHtml: string | null;
  bodyText: string | null;
  createdAt: string;
  ticketId: number | null;
  attachments: EmailAttachmentResponse[];
  thread: EmailThreadMessageResponse[];
}

/** Un correo de la conversacion, venga del cliente o de nosotros. */
export interface EmailThreadMessageResponse {
  id: number;
  /** Inbound | Outbound. */
  direction: string;
  fromEmail: string;
  fromName: string | null;
  toEmails: string[];
  ccEmails: string[];
  subject: string;
  bodyHtml: string | null;
  bodyText: string;
  /** Quien la escribio, si salio de aca. Vacio en lo que manda el cliente. */
  authorName: string;
  createdAt: string;
  /** Sent | Delayed | Delivered | Bounced | Complained. */
  deliveryStatus: string | null;
  deliveryDetail: string | null;
  attachments: EmailAttachmentResponse[];
}

/** Respuesta paginada de la bandeja (GET /api/emails). */
export interface EmailListResponse {
  items: EmailSummaryResponse[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  counts: { all: number; unlinked: number; linked: number; unanswered: number };
  folderCounts: EmailFolderCounts;
}

export interface TicketSummaryResponse {
  id: number;
  code: string;
  subject: string;
  status: string;
  priority: string;
  source: string;
  requesterEmail: string;
  requesterName: string | null;
  departmentId: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Total y sin leer de una carpeta, para los contadores del menu. */
export interface FolderCount {
  total: number;
  unread: number;
}

export interface EmailFolderCounts {
  inbox: FolderCount;
  archived: FolderCount;
  junk: FolderCount;
  trash: FolderCount;
}
