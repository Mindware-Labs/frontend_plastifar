/**
 * Datos de prueba del Dashboard: KPIs con delta y mini-tendencia, volumen por
 * dia de semana, actividad por hora, cumplimiento de SLA por prioridad y la
 * bandeja de tickets que centra la pantalla. Es una vista rapida, sin control
 * de rango propio — el detalle filtrable por fecha vive en Reportes; semilla
 * fija, cifras estables.
 */
import type {
  ActivityStreamPoint,
  DashboardData,
  KpiCardData,
  PriorityCompliance,
  SlaState,
  TicketPriority,
  TicketRow,
  TicketStatus,
  WeeklyBarPoint,
} from "../types/dashboard";
import { HOUR_BLOCKS, WEEKDAYS_SHORT } from "../types/dashboard";

const SEED = seedFrom("dashboard-demo");

function delay<T>(value: T, ms = 260): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function rng(seed: number) {
  let value = seed || 1;
  return () => {
    value = (value * 1103515245 + 12345) & 0x7fffffff;
    return value / 0x7fffffff;
  };
}

function seedFrom(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash || 1;
}

function sparkline(seed: number, base: number, spread: number): number[] {
  const random = rng(seed);
  return Array.from({ length: 7 }, () => Math.max(1, Math.round(base + (random() - 0.5) * spread)));
}

function delta(seed: number, spread: number, increaseIsGood: boolean, comparisonLabel: string) {
  const random = rng(seed);
  const percent = Math.round((random() - 0.35) * spread * 10) / 10;
  return { percent, increaseIsGood, comparisonLabel };
}

function buildKpis(seed: number): KpiCardData[] {
  const random = rng(seed);
  const open = Math.round(28 + random() * 20);
  const inProgress = Math.round(14 + random() * 12);
  const unassigned = Math.round(random() * 7);
  const slaAtRisk = Math.round(random() * 6);
  const resolved = Math.round(140 + random() * 60);
  const comparison = "vs. semana anterior";

  return [
    {
      key: "open",
      label: "Tickets abiertos",
      value: String(open),
      tone: "neutral",
      emphasis: false,
      delta: delta(seed, 20, true, comparison),
      sparkline: sparkline(seed, open / 3, open / 2),
    },
    {
      key: "inProgress",
      label: "En progreso",
      value: String(inProgress),
      tone: "neutral",
      emphasis: false,
      delta: delta(seed >> 2, 20, true, comparison),
      sparkline: sparkline(seed >> 2, inProgress / 3, inProgress / 2),
    },
    {
      key: "unassigned",
      label: "Sin asignar",
      value: String(unassigned),
      tone: unassigned > 0 ? "warn" : "green",
      emphasis: unassigned > 0,
      delta: delta(seed >> 4, 40, false, comparison),
      sparkline: sparkline(seed >> 4, Math.max(1, unassigned), 4),
    },
    {
      key: "slaAtRisk",
      label: "SLA en riesgo",
      value: String(slaAtRisk),
      tone: slaAtRisk > 0 ? "red" : "green",
      emphasis: slaAtRisk > 0,
      delta: delta(seed >> 6, 40, false, comparison),
      sparkline: sparkline(seed >> 6, Math.max(1, slaAtRisk), 3),
    },
    {
      key: "resolved",
      label: "Resueltos",
      value: String(resolved),
      tone: "green",
      emphasis: false,
      delta: delta(seed >> 8, 20, true, comparison),
      sparkline: sparkline(seed >> 8, resolved / 7, resolved / 4),
    },
  ];
}

function buildWeeklyBars(seed: number): WeeklyBarPoint[] {
  const random = rng(seed);
  return WEEKDAYS_SHORT.map((label, index) => {
    const primary = Math.round((index < 5 ? 30 + Math.sin(index) * 12 : 8) + random() * 14);
    return { label, primary, secondary: Math.round(primary * (0.55 + random() * 0.3)) };
  });
}

function buildActivityStream(seed: number): ActivityStreamPoint[] {
  const random = rng(seed);
  return HOUR_BLOCKS.map((block, index) => {
    // Horario laboral (08–12, 12–16) concentra la carga; noche y madrugada
    // casi no tienen tickets.
    const businessHours = index === 2 || index === 3;
    const base = businessHours ? 70 : index === 1 || index === 4 ? 30 : 5;
    const w1 = Math.round(Math.max(0, base + (random() - 0.5) * 20));
    return { t: block, w1, w2: Math.round(w1 * (0.5 + random() * 0.3)) };
  });
}

function buildActivityHeatmap(seed: number, weeks = 13): ActivityHeatmapDay[] {
  const random = rng(seed);
  const days = weeks * 7;
  const today = new Date();
  // Retrocede hasta el lunes de la semana mas antigua, para que cada columna
  // sea una semana completa L→D como el resto del panel.
  const mondayOffset = (today.getDay() + 6) % 7;
  const start = new Date(today);
  start.setDate(start.getDate() - mondayOffset - (weeks - 1) * 7);

  const counts = Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const base = isWeekend ? random() * 3 : 6 + random() * 14;
    return { date: date.toISOString().slice(0, 10), count: Math.round(base) };
  });

  const max = Math.max(1, ...counts.map((day) => day.count));
  return counts.map((day) => ({
    ...day,
    level: (day.count === 0 ? 0 : Math.min(4, 1 + Math.floor((day.count / max) * 4))) as ActivityHeatmapDay["level"],
  }));
}

function buildPriorityCompliance(seed: number): PriorityCompliance[] {
  const random = rng(seed);
  return [
    { priority: "Crítica", compliance: Math.min(100, Math.round(94 + random() * 5)) },
    { priority: "Alta", compliance: Math.min(100, Math.round(88 + random() * 8)) },
    { priority: "Media", compliance: Math.min(100, Math.round(85 + random() * 10)) },
    { priority: "Baja", compliance: Math.min(100, Math.round(92 + random() * 6)) },
  ];
}

const assignees = ["Yordy Acosta", "Richard De León", "Carla Ventura"];

const ticketSeeds: {
  subject: string;
  requesterName: string;
  requesterCompany: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  sla: SlaState;
  assigned: boolean;
}[] = [
  { subject: "Producto defectuoso en lote 88 — rebabas visibles", requesterName: "María Reyes", requesterCompany: "Distribuidora del Este", category: "Reclamación", priority: "Crítica", status: "Escalado", sla: "Vencido", assigned: true },
  { subject: "Faltante de 8 unidades en pedido #4021", requesterName: "Luis Feliz", requesterCompany: "Distribuidora del Este", category: "Faltante", priority: "Alta", status: "En progreso", sla: "En riesgo", assigned: true },
  { subject: "Cotización línea Bio para 500 u./mes", requesterName: "Ana Peña", requesterCompany: "Supermercados La Cadena", category: "Cotización", priority: "Media", status: "Abierto", sla: "A tiempo", assigned: false },
  { subject: "Diferencia de medida en rollo — grosor no coincide", requesterName: "Carlos Guzmán", requesterCompany: "Ferretería Reyes", category: "Reclamación", priority: "Alta", status: "Esperando respuesta", sla: "En riesgo", assigned: true },
  { subject: "Retraso en notificación de envío", requesterName: "Sofía Cabrera", requesterCompany: "Ayuntamiento de Higüey", category: "Facturación", priority: "Baja", status: "Resuelto", sla: "A tiempo", assigned: true },
  { subject: "Solicitud de crédito por faltante en factura", requesterName: "María Reyes", requesterCompany: "Distribuidora del Este", category: "Facturación", priority: "Media", status: "Esperando respuesta", sla: "A tiempo", assigned: true },
  { subject: "Muestra de línea Flexible no llegó completa", requesterName: "Ana Peña", requesterCompany: "Supermercados La Cadena", category: "Faltante", priority: "Media", status: "Abierto", sla: "A tiempo", assigned: false },
  { subject: "Garantía por empaque termoencogible roto", requesterName: "Carlos Guzmán", requesterCompany: "Ferretería Reyes", category: "Garantía", priority: "Alta", status: "En progreso", sla: "A tiempo", assigned: true },
  { subject: "Devolución por acuerdo comercial no procesada", requesterName: "Sofía Cabrera", requesterCompany: "Ayuntamiento de Higüey", category: "Devolución", priority: "Crítica", status: "En progreso", sla: "En riesgo", assigned: true },
  { subject: "Precio de cotización no coincide con lo acordado", requesterName: "Luis Feliz", requesterCompany: "Distribuidora del Este", category: "Facturación", priority: "Media", status: "Cerrado", sla: "A tiempo", assigned: true },
  { subject: "Reclamo por olor extraño en lote de producción", requesterName: "María Reyes", requesterCompany: "Distribuidora del Este", category: "Reclamación", priority: "Crítica", status: "Abierto", sla: "Vencido", assigned: false },
  { subject: "Consulta sobre disponibilidad de línea Agrícola", requesterName: "Ana Peña", requesterCompany: "Supermercados La Cadena", category: "Cotización", priority: "Baja", status: "Resuelto", sla: "A tiempo", assigned: true },
  { subject: "Actualización de dirección de entrega", requesterName: "Carlos Guzmán", requesterCompany: "Ferretería Reyes", category: "Facturación", priority: "Baja", status: "Cerrado", sla: "A tiempo", assigned: true },
  { subject: "Reclamo repetido — mismo lote que ticket anterior", requesterName: "Sofía Cabrera", requesterCompany: "Ayuntamiento de Higüey", category: "Reclamación", priority: "Alta", status: "Escalado", sla: "En riesgo", assigned: true },
];

function buildTickets(seed: number): TicketRow[] {
  const random = rng(seed);

  return ticketSeeds.map((seedRow, index) => ({
    id: index + 1,
    number: String(4034 - index).padStart(6, "0"),
    subject: seedRow.subject,
    requesterName: seedRow.requesterName,
    requesterCompany: seedRow.requesterCompany,
    category: seedRow.category,
    priority: seedRow.priority,
    status: seedRow.status,
    assigneeName: seedRow.assigned ? assignees[Math.floor(random() * assignees.length)] : null,
    sla: seedRow.sla,
    updatedMinutesAgo: Math.round(6 + random() * 2600),
  }));
}

export const dashboardMock = {
  data(): Promise<DashboardData> {
    const weeklyBars = buildWeeklyBars(SEED >> 1);
    const activityStream = buildActivityStream(SEED >> 11);
    const activityHeatmap = buildActivityHeatmap(SEED >> 13);

    return delay({
      kpis: buildKpis(SEED),
      weeklyBars,
      weeklyTotal: weeklyBars.reduce((sum, point) => sum + point.primary, 0),
      activityStream,
      activityPeak: Math.max(...activityStream.map((point) => point.w1)),
      activityHeatmap,
      activityHeatmapTotal: activityHeatmap.reduce((sum, day) => sum + day.count, 0),
      slaCompliance: Math.round(85 + rng(SEED >> 9)() * 12),
      priorityCompliance: buildPriorityCompliance(SEED >> 10),
      tickets: buildTickets(SEED >> 7),
    });
  },
};
