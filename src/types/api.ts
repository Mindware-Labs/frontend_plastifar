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
  /** false = el archivo se purgó por antigüedad o el antivirus lo rechazó; la ficha queda para el historial. */
  available: boolean;
  /** Tipo ejecutable: solo se descarga tras un aviso, nunca se abre en linea. */
  dangerous: boolean;
  /** Pending | Clean | Infected | Skipped. */
  scanStatus: string;
  scanDetail: string | null;
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
  /** Solo en lo nuestro (Enviados): Queued | Sent | Delayed | Delivered | Bounced | Complained | Failed. */
  deliveryStatus: string | null;
  assignedStaffId: number | null;
  assignedStaffName: string | null;
  /** Se la asignaron a quien consulta y todavia no la abrio desde entonces. */
  assignedUnseen: boolean;
  starred: boolean;
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
  bccEmails: string[];
  subject: string;
  bodyHtml: string | null;
  bodyText: string | null;
  createdAt: string;
  ticketId: number | null;
  /** Todos los que ya estaban en la conversacion, para el "responder a todos". */
  otherRecipients: string[];
  attachments: EmailAttachmentResponse[];
  thread: EmailThreadMessageResponse[];
  assignedStaffId: number | null;
  assignedStaffName: string | null;
  starred: boolean;
  /** spf=/dkim=/dmarc= tal como los resumió el proveedor. Null si no llegó la cabecera. */
  authResult: string | null;
  /** true si spf, dkim o dmarc marcaron fail: el remitente podría estar suplantado. */
  authFailed: boolean;
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
  bccEmails: string[];
  subject: string;
  bodyHtml: string | null;
  bodyText: string;
  /** Quien la escribio, si salio de aca. Vacio en lo que manda el cliente. */
  authorName: string;
  createdAt: string;
  /** Queued | Sent | Delayed | Delivered | Bounced | Complained | Failed. */
  deliveryStatus: string | null;
  deliveryDetail: string | null;
  attachments: EmailAttachmentResponse[];
  authResult: string | null;
  authFailed: boolean;
}

/** Respuesta paginada de la bandeja (GET /api/emails). */
export interface EmailListResponse {
  items: EmailSummaryResponse[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  counts: { all: number; unlinked: number; linked: number; unanswered: number; mine: number; unassigned: number };
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
  starred: FolderCount;
  trash: FolderCount;
  sent: FolderCount;
  /** Asignadas a quien consulta y sin abrir desde entonces, en cualquier carpeta. */
  assignedUnseen: number;
}

/** La firma que se agrega al pie de los correos que envia esta persona. */
export interface StaffSignatureResponse {
  signature: string | null;
}

/** Aviso en vivo de un correo recibido: lo justo para sonar y avisar en el escritorio. */
export interface InboxArrival {
  emailId: number;
  fromEmail: string;
  fromName: string | null;
  subject: string;
  folder: EmailFolder;
  hasAttachments: boolean;
}

/** Aviso en vivo de que a esta persona le asignaron una conversacion. */
export interface EmailAssignment {
  emailId: number;
  subject: string;
  fromEmail: string;
  fromName: string | null;
  assignedStaffId: number;
  assignedByName: string;
}

/** Cada id representa a su conversacion entera, como en las acciones sueltas. */
export type EmailBulkAction = "archive" | "star" | "unstar" | "trash" | "restore" | "read" | "unread" | "delete";

export interface EmailBulkResponse {
  /** En delete pueden ser menos que las pedidas: las que tienen ticket se conservan. */
  affected: number;
}

export interface EmptyTrashResponse {
  deleted: number;
  /** Conversaciones con ticket que se conservan como historial del caso. */
  kept: number;
}


export interface StaffOptionResponse {
  id: number;
  name: string;
}

export interface EmailNoteResponse {
  id: number;
  staffId: number;
  authorName: string;
  body: string;
  createdAt: string;
}

/** Direccion conocida, para completar el "Para" mientras se escribe. */
export interface ContactResponse {
  email: string;
  name: string | null;
}

export interface CannedResponseResponse {
  id: number;
  title: string;
  body: string;
  createdByStaffId: number;
  createdByName: string;
  updatedAt: string;
}

/** Quien esta escribiendo en que conversacion; active false = dejo de hacerlo. */
export interface ComposingPresence {
  emailId: number;
  staffId: number;
  name: string;
  active: boolean;
}

export interface TicketListItemResponse {
  id: number;
  number: string;
  subject: string;
  topicId: number;
  topicName: string;
  clientId: number;
  clientName: string;
  clientCode: string;
  contactId: number | null;
  contactName: string | null;
  departmentId: number;
  departmentName: string;
  productLineId: number | null;
  productLineName: string | null;
  priority: string;
  status: string;
  channel: string;
  assignedStaffId: number | null;
  assignedStaffName: string | null;
  firstResponseDueAt: string | null;
  resolutionDueAt: string | null;
  firstResponseAt: string | null;
  pausedAt: string | null;
  pausedMinutes: number;
  closedAt: string | null;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface TicketCounts {
  all: number;
  open: number;
  upcoming: number;
  overdue: number;
  waitingOnClient: number;
  closed: number;
}

export interface TicketListResponse {
  items: TicketListItemResponse[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  counts: TicketCounts;
}

export interface TicketQuery {
  page: number;
  pageSize: number;
  search?: string;
  /** todos | abiertos | por-vencer | vencidos | espera | cerrados */
  status?: string;
  departmentId?: number;
  assignedStaffId?: number;
  priority?: string;
  topicId?: number;
  clientId?: number;
  fromDate?: string;
  toDate?: string;
  /** numero | asunto | cliente | departamento | prioridad | estado | sla | actividad */
  sort?: string;
  dir?: "asc" | "desc";
}

export interface TicketEmailResponse {
  id: number;
  direction: string;
  fromEmail: string;
  fromName: string | null;
  toEmails: string[];
  subject: string;
  bodyHtml: string | null;
  bodyText: string | null;
  createdAt: string;
  attachments: EmailAttachmentResponse[];
}

export interface TicketDetailResponse {
  id: number;
  code: string;
  subject: string;
  status: string;
  priority: string;
  source: string;
  requesterEmail: string;
  requesterName: string | null;
  departmentId: number | null;
  assignedStaffId: number | null;
  createdAt: string;
  updatedAt: string;
  emails: TicketEmailResponse[];
}

