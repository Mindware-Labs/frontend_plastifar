import { apiRequest, toQuery } from "./client";

/**
 * El tablero de operación, en una sola lectura.
 *
 * Las ocho tarjetas miran la misma ventana y se pintan juntas. Por eso hay un
 * endpoint y no cinco: partido, cada tarjeta llegaría en un instante distinto
 * y dos de ellas podrían contar el mismo ticket de forma diferente, sin que
 * nada en la pantalla explique por qué no cuadran.
 */

export interface DashboardCounts {
  all: number;
  open: number;
  upcoming: number;
  overdue: number;
  waitingOnClient: number;
  closed: number;
  /**
   * Los que no están cerrados.
   *
   * Lo calcula el SERVIDOR y no se recompone aquí. La versión anterior hacía
   * `open + upcoming + overdue + waiting`, y esos tramos se solapan: un ticket
   * abierto y vencido está en dos, así que la suma lo contaba dos veces y el
   * total de «tickets vivos» salía inflado.
   */
  live: number;
}

/**
 * El acompañante de cada indicador.
 *
 * Sustituye a las variaciones «contra ayer», que eran imposibles: vencidos,
 * por vencer y en espera son cantidades del instante, deducidas comparando la
 * fecha de compromiso contra el reloj, y el valor de ayer no está guardado en
 * ninguna tabla. Cada uno de estos sale de una consulta y contesta algo más
 * útil: dónde actuar ahora.
 */
/**
 * Reparto EXCLUYENTE de los vivos: los cuatro suman `counts.live` exacto.
 *
 * Existe porque los contadores de la bandeja se solapan a propósito —un ticket
 * abierto y vencido está en las dos pastillas, para poder llegar a él por
 * cualquiera de los dos caminos— y para una barra apilada eso pinta más barra
 * que tickets hay. El orden lo decide la urgencia: vencido gana sobre en
 * espera, porque es lo que exige actuar.
 */
export interface DashboardStage {
  overdue: number;
  upcoming: number;
  waiting: number;
  /** Vivo, con plazo holgado y sin esperar a nadie. */
  onTrack: number;
}

export interface DashboardAttention {
  /** Días que lleva vencido el más viejo, o `null` si no hay ninguno. */
  oldestOverdueDays: number | null;
  dueWithin2h: number;
  unassigned: number;
  waitingOver7Days: number;
}

export interface DashboardTrendPoint {
  /** `yyyy-MM-dd`. */
  date: string;
  opened: number;
  closed: number;
}

export interface DashboardDistribution {
  label: string;
  value: number;
}

export interface DashboardChannel extends DashboardDistribution {
  /**
   * Variación contra la ventana anterior, en porcentaje.
   *
   * `null` cuando la ventana anterior no tuvo ninguno: un cero afirmaría «no
   * cambió», y eso sería inventar.
   */
  delta: number | null;
}

export interface DashboardAgent {
  id: number;
  name: string;
  /** El departamento de la persona; es la función, no el rol de seguridad. */
  role: string;
  /** Cerrados en la ventana. */
  closed: number;
  /** Abiertos en su cola ahora mismo. */
  open: number;
  /** Vencidos en su cola ahora mismo. */
  overdue: number;
}

export interface DashboardStateAging {
  /** Sólo estados vivos: medir el atasco de un ticket cerrado no dice nada. */
  state: string;
  /** Menos de 24 horas en este estado. */
  fresh: number;
  /** Entre uno y tres días. */
  aging: number;
  /** Más de tres días. Acá vive el atasco. */
  stale: number;
}

/** Una fila de la cola reciente, recortada a lo que la tarjeta muestra. */
export interface DashboardRecentTicket {
  /** Numero visible, p. ej. «PLT-000246». */
  id: string;
  ticketId: number;
  customer: string;
  subject: string;
  channel: string;
  priority: string;
  /** Nombre del enum; usar `nombreDeEstado` para mostrarlo. */
  status: string;
  agentId: number | null;
  agentName: string | null;
  overdue: boolean;
  /**
   * Minutos desde la última intervención, calculados por el SERVIDOR.
   *
   * Restando en el navegador, un reloj mal puesto —o simplemente otra zona
   * horaria— convierte «hace 5 minutos» en «hace 4 horas» sin que nada avise.
   */
  minutesSinceActivity: number;
}

export interface DashboardResponse {
  range: { from: string; to: string; days: number };
  counts: DashboardCounts;
  stage: DashboardStage;
  attention: DashboardAttention;
  quality: { openNow: number; overdueNow: number };
  trend: DashboardTrendPoint[];
  topics: DashboardDistribution[];
  channels: DashboardChannel[];
  agents: DashboardAgent[];
  stateAging: DashboardStateAging[];
  /** Veinte filas: la tarjeta muestra cinco y busca sobre las veinte. */
  recent: DashboardRecentTicket[];
}

export const dashboardApi = {
  get: (days = 30) => apiRequest<DashboardResponse>(`/api/dashboard${toQuery({ days })}`),
};

/**
 * Nombre legible de un estado.
 *
 * El servidor manda el nombre del enum (`EnEsperaDelCliente`) porque es su
 * identificador estable; la pantalla no puede mostrarlo así. La traducción vive
 * aquí y no en cada componente para que dos tarjetas no lleguen a llamar de
 * dos formas distintas al mismo estado.
 */
export function nombreDeEstado(estado: string): string {
  switch (estado) {
    case "Abierto":
      return "Abierto";
    case "EnEsperaDelCliente":
      return "En espera del cliente";
    case "ReenvioDeProducto":
      return "Reenvío de producto";
    case "Solucionado":
      return "Solucionado";
    case "Cancelado":
      return "Cancelado";
    default:
      return estado;
  }
}
