// Espejo de los DTOs de /api/settings/... (api/Dtos/SettingsDtos.cs).

/** Se guardan como texto legible, nunca como numeros. */
export type Priority = "Emergencia" | "Alta" | "Normal" | "Baja";

export const PRIORITIES: Priority[] = ["Emergencia", "Alta", "Normal", "Baja"];

/** Dias laborables por inicial, en el orden de la semana. */
export type Weekday = "L" | "M" | "X" | "J" | "V" | "S" | "D";

export const WEEKDAYS: { key: Weekday; label: string; jsDay: number }[] = [
  { key: "L", label: "Lunes", jsDay: 1 },
  { key: "M", label: "Martes", jsDay: 2 },
  { key: "X", label: "Miércoles", jsDay: 3 },
  { key: "J", label: "Jueves", jsDay: 4 },
  { key: "V", label: "Viernes", jsDay: 5 },
  { key: "S", label: "Sábado", jsDay: 6 },
  { key: "D", label: "Domingo", jsDay: 0 },
];

export interface SlaPolicy {
  id: number;
  name: string;
  priority: Priority;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  /** Si es verdadero, el reloj corre solo en horario laboral. */
  businessHoursOnly: boolean;
  /** Jornada aplicable, en formato HH:mm. */
  workdayStart: string;
  workdayEnd: string;
  workDays: Weekday[];
  /** Predeterminada de su prioridad: el sistema impide desactivar la ultima. */
  isDefault: boolean;
  isActive: boolean;
}

export interface Holiday {
  id: number;
  /** Fecha en formato ISO corto (YYYY-MM-DD): es un dia, no un instante. */
  date: string;
  name: string;
  isActive: boolean;
}

export interface ProductLine {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
}

/** Espejo del enum `PlantCountry` del servidor, que viaja como texto. */
export type PlantCountry = "RD" | "Guatemala";

export const PLANT_COUNTRIES: { value: PlantCountry; label: string }[] = [
  { value: "RD", label: "República Dominicana" },
  { value: "Guatemala", label: "Guatemala" },
];

/** Planta de producción. El nombre es único dentro de su país, no en todo el catálogo. */
export interface Plant {
  id: number;
  name: string;
  country: PlantCountry;
  managerStaffId: number | null;
  /** Viene con la planta para pintar la columna sin pedirlo fila por fila. */
  managerName: string | null;
  isActive: boolean;
  /**
   * El de la persona: quien se desactivó después de ser elegido sigue figurando
   * como administrador y la tabla lo dice. Nulo cuando no hay administrador.
   */
  managerIsActive: boolean | null;
}

export interface SavePlantRequest {
  name: string;
  country: PlantCountry;
  managerStaffId: number | null;
  isActive: boolean;
}

/** Equipo de trabajo. El nombre es único en todo el catálogo. */
export interface Team {
  id: number;
  name: string;
  /** Planta a la que pertenece; nulo cuando el equipo no es de planta. */
  plantId: number | null;
  /** Viene con el equipo para pintar la columna sin pedirlo fila por fila. */
  plantName: string | null;
  /** Todos los integrantes, estén activos o no. */
  memberCount: number;
  isActive: boolean;
}

export interface SaveTeamRequest {
  name: string;
  plantId: number | null;
  isActive: boolean;
}

/**
 * Integrante de un equipo. `isActive` es el de la persona, no el del equipo.
 * Sin correo: la lectura de integrantes está abierta a cualquier sesión y el
 * correo del personal lo protege `staff.read`.
 */
export interface TeamMember {
  staffId: number;
  name: string;
  isActive: boolean;
  createdAt: string;
}

/** Formularios que una tarea puede exigir (docs/plan/02). Viajan por el nombre del enum. */
export const REQUIRED_FORMS: { value: RequiredForm; label: string }[] = [
  { value: "Reclamacion", label: "Reclamación de clientes" },
  { value: "RetiroMercancia", label: "Retiro de mercancía" },
  { value: "Hca", label: "HCA" },
  { value: "DiscrepanciaCarga", label: "Discrepancia de carga" },
];
export type RequiredForm = "Reclamacion" | "RetiroMercancia" | "Hca" | "DiscrepanciaCarga";

export const ROUTING_MOMENTS: { value: RoutingMoment; label: string }[] = [
  { value: "AlCrearTicket", label: "Al crear el ticket" },
  { value: "AlCompletarTarea", label: "Al completar la tarea" },
  { value: "ConsultaDesdeTarea", label: "Consulta desde la tarea" },
];
export type RoutingMoment = "AlCrearTicket" | "AlCompletarTarea" | "ConsultaDesdeTarea";

/** Tipo de tarea: la columna ACCION de la hoja SLA, con su plazo. */
export interface TaskType {
  id: number;
  name: string;
  /** Plazo en días, 1 a 365. */
  slaDays: number;
  /** Verdadero: laborables; falso: calendario; nulo: sin decidir (pregunta 1). */
  businessDaysOnly: boolean | null;
  requiredForm: RequiredForm | null;
  requiredFormLabel: string | null;
  isActive: boolean;
  departments: { id: number; name: string }[];
  /** `isActive` es el de la persona. */
  assignees: { staffId: number; name: string; isActive: boolean }[];
}

export interface SaveTaskTypeRequest {
  name: string;
  slaDays: number;
  businessDaysOnly: boolean | null;
  requiredForm: RequiredForm | null;
  departmentIds: number[];
  assigneeStaffIds: number[];
  isActive: boolean;
}

/** Quién llena o consulta un formulario y en qué momento (hoja FORMULARIOS). */
export interface FormRoutingRule {
  id: number;
  form: RequiredForm;
  formLabel: string;
  moment: RoutingMoment;
  momentLabel: string;
  departmentId: number | null;
  departmentName: string | null;
  teamId: number | null;
  teamName: string | null;
  /** Solo con el momento «Al completar la tarea». */
  isBlocking: boolean;
  isActive: boolean;
}

export interface SaveFormRoutingRuleRequest {
  form: RequiredForm;
  moment: RoutingMoment;
  departmentId: number | null;
  teamId: number | null;
  isBlocking: boolean;
  isActive: boolean;
}

/** Un formulario que aplica a quien pregunta desde un departamento, y por qué regla. */
export interface ApplicableForm {
  form: RequiredForm;
  formLabel: string;
  moment: RoutingMoment;
  isBlocking: boolean;
  source: string;
}

/** Producto: lo que se vende, se reclama o se retira. El código es único y es texto. */
export interface Product {
  id: number;
  code: string;
  /** Descripción del producto. */
  name: string;
  productLineId: number | null;
  /** Viene con el producto para pintar la columna sin pedirlo fila por fila. */
  productLineName: string | null;
  plantId: number | null;
  plantName: string | null;
  /** Acompaña a la planta porque su nombre se repite entre países. */
  plantCountry: PlantCountry | null;
  isActive: boolean;
}

export interface SaveProductRequest {
  code: string;
  name: string;
  productLineId: number | null;
  plantId: number | null;
  isActive: boolean;
}

/** Lo mínimo que devuelve la búsqueda del selector de producto. */
export interface ProductLookupItem {
  id: number;
  code: string;
  name: string;
}

export interface ProductImportRejection {
  /** Línea del archivo, contando la cabecera como la 1. */
  line: number;
  code: string | null;
  reason: string;
}

/**
 * Resultado de la carga por archivo. `rejections` trae como mucho las primeras
 * cien filas rechazadas; `rejected` es el total real y `rejectionsTruncated`
 * avisa del corte.
 */
export interface ProductImportResult {
  created: number;
  updated: number;
  unchanged: number;
  rejected: number;
  rejections: ProductImportRejection[];
  rejectionsTruncated: boolean;
}

/** Variables permitidas en una plantilla. Una desconocida se rechaza al guardar. */
export const TEMPLATE_VARIABLES = [
  { key: "contacto", label: "Nombre del contacto", sample: "María Reyes" },
  { key: "ticket", label: "Número de ticket", sample: "000482" },
  { key: "agente", label: "Nombre del agente", sample: "Yordy Acosta" },
  { key: "cliente", label: "Nombre del cliente", sample: "Distribuidora del Este" },
] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number]["key"];

export interface EmailTemplate {
  id: number;
  /** Clave estable con la que el sistema la invoca. */
  key: string;
  name: string;
  subject: string;
  body: string;
  isActive: boolean;
}

/** Valor de cable, tal como lo emite y espera el enum del servidor. */
export type MailboxProvider = "IMAP" | "Gmail" | "Office365";

/** El "Office 365" con espacio es solo como se lee en pantalla: mandarlo como
 *  valor dejaba el desplegable en blanco al reabrir el buzon para editarlo. */
export const MAILBOX_PROVIDERS: { value: MailboxProvider; label: string }[] = [
  { value: "IMAP", label: "IMAP" },
  { value: "Gmail", label: "Gmail" },
  { value: "Office365", label: "Office 365" },
];

export function providerLabel(provider: MailboxProvider): string {
  return MAILBOX_PROVIDERS.find((option) => option.value === provider)?.label ?? provider;
}

/**
 * Buzon de entrada. Solo administracion (RF-K4): la lectura real del correo
 * -que convertiria un mensaje entrante en ticket- es un subsistema aparte que
 * el plan deja pendiente (seccion 9.7, decision de Plastifar todavia abierta).
 */
export interface Mailbox {
  id: number;
  address: string;
  displayName: string;
  provider: MailboxProvider;
  /** Departamento donde caen los tickets que este buzon origine. */
  departmentId: number;
  /** Referencia al secreto en la configuracion protegida del servidor; nunca
   *  la contraseña en si. Una contraseña de correo en una columna es una fuga
   *  esperando su turno. Solo baja a quien puede escribir la configuracion;
   *  para el resto es null. */
  secretRef: string | null;
  isActive: boolean;
  lastSyncedAt: string | null;
}
