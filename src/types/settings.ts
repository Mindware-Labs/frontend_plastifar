// Contrato anticipado del modulo de Catalogos y configuracion. Todavia no existe
// en el backend: cuando los endpoints /api/settings/... esten escritos, esto
// pasa a types/api.ts como espejo de los DTOs reales.

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

/** Motivo o tema del ticket. Admite un segundo nivel de detalle. */
export interface TicketTopic {
  id: number;
  name: string;
  /** Motivo padre; null en el primer nivel. */
  parentId: number | null;
  /** Departamento al que se encola por defecto. */
  defaultDepartmentId: number;
  defaultPriority: Priority;
  /** Politica aplicable; si es null se usa la de la prioridad. */
  slaPolicyId: number | null;
  /** Obliga a indicar linea de producto (reclamaciones de calidad). */
  requiresProductLine: boolean;
  isActive: boolean;
  /** Tickets que ya lo usan: un motivo en uso no se elimina, se desactiva. */
  ticketCount: number;
}

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
  /** Motivos que la exigen: la ultima en uso no se desactiva. */
  usedByTopics: number;
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
