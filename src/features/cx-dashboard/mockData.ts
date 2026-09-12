/**
 * Andamiaje del tablero de operación.
 *
 * Las cifras son falsas; las FORMAS no. Cada export refleja lo que el endpoint
 * real ya devuelve, así que cablearlo es un reemplazo y no una reescritura:
 *
 *   TicketCounts  → GET /api/tickets            (`counts`)
 *   Ticket        → GET /api/tickets            (`items[]`, recortado)
 *   Distribution  → agregado nuevo, ver DASHBOARD.md
 *   TicketCounts  → GET /api/reports/quality    (cifras de calidad)
 *
 * Acá NO hay color. El color de una categoría no es un dato del negocio: es una
 * decisión de presentación, y sale de `C.cat` / `C.avatar` por índice en el
 * componente que dibuja. Antes venía mezclado con el dato, y por eso cambiar la
 * paleta obligaba a editar el archivo de datos.
 *
 * La generación es DETERMINISTA a propósito. `mulberry32` es un PRNG con
 * semilla, no `Math.random`: la misma semilla da la misma serie en cada
 * pintada y las gráficas no bailan entre renders.
 */

/* -------------------------------------------------------------------------- */
/*  Generación determinista                                                    */
/* -------------------------------------------------------------------------- */

export function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function series(seed: number, n: number, min: number, max: number): number[] {
  const rnd = mulberry32(seed);
  return Array.from({ length: n }, () => Math.round(min + rnd() * (max - min)));
}

/* -------------------------------------------------------------------------- */
/*  Ventanas de tiempo                                                         */
/* -------------------------------------------------------------------------- */

const MESES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export interface RangeConfig {
  count: number;
  max: number;
  seed: number;
  band: [number, number];
  /** Pares `[índice, rótulo]` del eje horizontal. */
  ticks: [number, string][];
  labelFor: (index: number) => string;
}

export const RANGES: Record<string, RangeConfig> = {
  Hoy: {
    count: 24,
    max: 120,
    seed: 11,
    band: [30, 115],
    ticks: [[2, "02:00"], [8, "08:00"], [14, "14:00"], [20, "20:00"]],
    labelFor: (i) => `${String(i).padStart(2, "0")}:00`,
  },
  "7 días": {
    count: 7,
    max: 1000,
    seed: 22,
    band: [380, 900],
    ticks: [[0, "Lun"], [2, "Mié"], [4, "Vie"], [6, "Dom"]],
    labelFor: (i) => DIAS[i],
  },
  "30 días": {
    count: 28,
    max: 1000,
    seed: 33,
    band: [420, 780],
    ticks: [[3, "1-7"], [10, "8-15"], [17, "16-22"], [24, "23-30"]],
    labelFor: (i) => `Día ${i + 1}`,
  },
  "12 meses": {
    count: 12,
    max: 1000,
    seed: 44,
    band: [400, 950],
    ticks: [[0, "Ene"], [3, "Abr"], [6, "Jul"], [10, "Nov"]],
    labelFor: (i) => MESES[i],
  },
};

/* -------------------------------------------------------------------------- */
/*  Conteos de la bandeja — GET /api/tickets → counts                          */
/* -------------------------------------------------------------------------- */

export interface TicketCounts {
  all: number;
  open: number;
  upcoming: number;
  overdue: number;
  waitingOnClient: number;
  closed: number;
}

export const COUNTS: TicketCounts = {
  all: 1284,
  open: 137,
  upcoming: 42,
  overdue: 19,
  waitingOnClient: 28,
  closed: 1058,
};

/** Calidad: lo que ya devuelve GET /api/reports/quality. */
export const QUALITY = {
  openedInRange: 86,
  closedInRange: 74,
  openNow: 31,
  overdueNow: 7,
  averageClosureDays: 4.2,
};

/* -------------------------------------------------------------------------- */
/*  Distribuciones                                                             */
/* -------------------------------------------------------------------------- */

export interface Distribution {
  label: string;
  value: number;
}

/** Por qué se abre un ticket. En el sistema real es `topicName`. */
export const TOPICS: Distribution[] = [
  { label: "Reclamo de calidad", value: 102 },
  { label: "Nota de crédito", value: 80 },
  { label: "Despacho y entrega", value: 70 },
  { label: "Facturación", value: 58 },
  { label: "Improcedente", value: 24 },
];

export interface Channel extends Distribution {
  /** Variación contra la ventana anterior, en porcentaje. */
  delta: number;
}

/** Por dónde entra el trabajo. En el sistema real es `channel`. */
export const CHANNELS: Channel[] = [
  { label: "Correo", value: 742, delta: 12.4 },
  { label: "WhatsApp", value: 508, delta: -3.1 },
  { label: "Teléfono", value: 361, delta: 6.8 },
  { label: "Chat web", value: 244, delta: -8.2 },
  { label: "Presencial", value: 145, delta: 21.6 },
];

/* -------------------------------------------------------------------------- */
/*  Carga por responsable — `assignedStaffName` agregado                       */
/* -------------------------------------------------------------------------- */

export interface Agent {
  id: number;
  name: string;
  role: string;
  /** Cerrados en la ventana. */
  closed: number;
  /** Abiertos en su cola ahora mismo. */
  open: number;
  /** Vencidos en su cola ahora mismo. */
  overdue: number;
}

export const AGENTS: Agent[] = [
  { id: 1, name: "Alejandro Rivera", role: "Calidad", closed: 142, open: 18, overdue: 0 },
  { id: 2, name: "Mina Santos", role: "Servicio al cliente", closed: 128, open: 24, overdue: 2 },
  { id: 3, name: "Kevin Batista", role: "Despacho", closed: 119, open: 31, overdue: 5 },
  { id: 4, name: "Laura Ortiz", role: "Facturación", closed: 97, open: 27, overdue: 8 },
  { id: 5, name: "Dimitri Volkov", role: "Escalados", closed: 64, open: 12, overdue: 4 },
];

/* -------------------------------------------------------------------------- */
/*  Bandeja — GET /api/tickets → items[]                                       */
/* -------------------------------------------------------------------------- */

/** Los mismos estados que acepta `TicketQuery.status`. */
export type TicketStatus = "Abierto" | "Por vencer" | "Vencido" | "En espera" | "Cerrado";
export type TicketPriority = "Alta" | "Media" | "Baja";

export interface Ticket {
  id: string;
  customer: string;
  subject: string;
  channel: string;
  priority: TicketPriority;
  status: TicketStatus;
  agentId: number;
  /** Minutos desde la última actividad. */
  mins: number;
}

export const TICKETS: Ticket[] = [
  { id: "TCK-2841", customer: "Farmacia Carol", subject: "Nota de crédito sin reflejar a 5 días", channel: "Correo", priority: "Alta", status: "Vencido", agentId: 1, mins: 14 },
  { id: "TCK-2840", customer: "Grupo Ramos", subject: "No puede subir el comprobante fiscal", channel: "Chat web", priority: "Media", status: "En espera", agentId: 2, mins: 38 },
  { id: "TCK-2839", customer: "Supermercados Nacional", subject: "Doble cargo en la factura de febrero", channel: "WhatsApp", priority: "Alta", status: "Por vencer", agentId: 5, mins: 51 },
  { id: "TCK-2838", customer: "Ferretería Ochoa", subject: "Reprogramar la visita técnica", channel: "Teléfono", priority: "Baja", status: "Cerrado", agentId: 4, mins: 96 },
  { id: "TCK-2837", customer: "Plaza Lama", subject: "Los avisos caen en no deseados", channel: "Correo", priority: "Baja", status: "Cerrado", agentId: 3, mins: 120 },
  { id: "TCK-2836", customer: "Distribuidora Corripio", subject: "Nunca llegó la confirmación del pedido", channel: "WhatsApp", priority: "Media", status: "Abierto", agentId: 2, mins: 7 },
  { id: "TCK-2835", customer: "Almacenes Unidos", subject: "Lo transfirieron tres veces", channel: "Chat web", priority: "Alta", status: "Vencido", agentId: 5, mins: 62 },
  { id: "TCK-2834", customer: "Bravo Supermercados", subject: "Actualizar la cuenta de cobro", channel: "Presencial", priority: "Baja", status: "En espera", agentId: 4, mins: 149 },
];
