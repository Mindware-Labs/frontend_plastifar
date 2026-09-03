// Contrato anticipado del Dashboard. Mismo caso que Reportes: agrega sobre
// Tickets, que todavia no existe, asi que esto es demostracion. El vocabulario
// de estados y prioridades de esta pantalla es el que pidio Plastifar para el
// dashboard especificamente y puede no coincidir palabra por palabra con el
// de la seccion 9 del plan — eso lo define quien construya la Bandeja.

export interface Delta {
  /** Positivo o negativo; el signo lo decide el dato, no el color. */
  percent: number;
  /** Si crecer es bueno para este KPI. "Sin asignar" sube = malo, aunque el
   *  numero sea positivo — por eso el color no sale del signo solo. */
  increaseIsGood: boolean;
  comparisonLabel: string;
}

export type KpiKey = "open" | "inProgress" | "unassigned" | "slaAtRisk" | "resolved";

export interface KpiCardData {
  key: KpiKey;
  label: string;
  value: string;
  tone: "neutral" | "red" | "green" | "warn";
  /** Las metricas que piden atencion inmediata llevan mas peso visual. */
  emphasis: boolean;
  delta: Delta;
  /** Ultimos puntos para la mini-barra de contexto de la tarjeta. */
  sparkline: number[];
}

export const WEEKDAYS_SHORT = ["L", "M", "X", "J", "V", "S", "D"] as const;

/** Datos del MonoRoundedBarChart: creados/resueltos por dia de la semana. */
export interface WeeklyBarPoint {
  label: (typeof WEEKDAYS_SHORT)[number];
  primary: number;
  secondary: number;
}

/** Datos del MonoRoundedStreamChart: dos series por bloque horario. */
export interface ActivityStreamPoint {
  t: string;
  w1: number;
  w2: number;
}

export const TICKET_STATUSES = [
  "Abierto",
  "En progreso",
  "Esperando respuesta",
  "Escalado",
  "Resuelto",
  "Cerrado",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ["Crítica", "Alta", "Media", "Baja"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export type SlaState = "A tiempo" | "En riesgo" | "Vencido";

export interface TicketRow {
  id: number;
  number: string;
  subject: string;
  requesterName: string;
  requesterCompany: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  assigneeName: string | null;
  sla: SlaState;
  updatedMinutesAgo: number;
}

export interface PriorityCompliance {
  priority: TicketPriority;
  compliance: number;
}

export const HOUR_BLOCKS = ["00–04", "04–08", "08–12", "12–16", "16–20", "20–24"] as const;

export interface DashboardData {
  kpis: KpiCardData[];
  weeklyBars: WeeklyBarPoint[];
  weeklyTotal: number;
  activityStream: ActivityStreamPoint[];
  activityPeak: number;
  slaCompliance: number;
  priorityCompliance: PriorityCompliance[];
  tickets: TicketRow[];
}
