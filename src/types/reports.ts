// Contrato anticipado del modulo de Reportes. Todavia no existe en el backend
// -ni puede: la mayoria agrega sobre Tickets, que tampoco existe todavia- asi
// que esto es el catalogo completo de la seccion 11.2 del plan mas los datos
// de demostracion de las dos familias que ya se pueden ilustrar con lo que
// otros modulos definieron (Catalogos, Clientes).

export type ReportFamily =
  | "operacion"
  | "sla"
  | "productividad"
  | "calidad"
  | "clientes"
  | "volumen"
  | "auditoria";

export interface ReportFamilyInfo {
  key: ReportFamily;
  label: string;
  to: string;
}

export const REPORT_FAMILIES: ReportFamilyInfo[] = [
  { key: "operacion", label: "Operación en vivo", to: "/reportes/operacion" },
  { key: "sla", label: "SLA y tiempos", to: "/reportes/sla" },
  { key: "productividad", label: "Productividad", to: "/reportes/productividad" },
  { key: "calidad", label: "Calidad y reclamaciones", to: "/reportes/calidad" },
  { key: "clientes", label: "Clientes", to: "/reportes/clientes" },
  { key: "volumen", label: "Volumen", to: "/reportes/volumen" },
  { key: "auditoria", label: "Auditoría", to: "/reportes/auditoria" },
];

export interface ReportDefinition {
  id: string;
  family: ReportFamily;
  name: string;
  description: string;
}

/** Los 31 reportes de la seccion 11.2, verbatim. */
export const REPORT_CATALOG: ReportDefinition[] = [
  // Operación en vivo (5)
  { id: "bandeja-por-estado", family: "operacion", name: "Bandeja por estado", description: "Cuántos tickets hay en cada estado ahora mismo." },
  { id: "tickets-sin-asignar", family: "operacion", name: "Tickets sin asignar", description: "Los que todavía no tienen responsable." },
  { id: "carga-por-agente", family: "operacion", name: "Carga por agente", description: "Tickets abiertos que tiene cada persona hoy." },
  { id: "tickets-por-vencer", family: "operacion", name: "Tickets por vencer", description: "Dentro del margen de SLA, pero cerca del límite." },
  { id: "tickets-vencidos", family: "operacion", name: "Tickets vencidos", description: "Ya pasaron su fecha de compromiso." },
  // SLA y tiempos (5)
  { id: "cumplimiento-primera-respuesta", family: "sla", name: "Cumplimiento de primera respuesta", description: "% de tickets respondidos dentro del compromiso." },
  { id: "cumplimiento-resolucion", family: "sla", name: "Cumplimiento de resolución", description: "% de tickets resueltos dentro del compromiso." },
  { id: "tiempo-medio-primera-respuesta", family: "sla", name: "Tiempo medio de primera respuesta", description: "Promedio real, en horario laboral." },
  { id: "tiempo-medio-resolucion", family: "sla", name: "Tiempo medio de resolución", description: "Promedio real, en horario laboral." },
  { id: "tiempo-espera-cliente", family: "sla", name: "Tiempo acumulado en espera del cliente", description: "El tiempo que no cuenta contra el agente." },
  // Productividad (4)
  { id: "resueltos-por-agente", family: "productividad", name: "Resueltos por agente", description: "Volumen cerrado por persona en el período." },
  { id: "resueltos-por-departamento", family: "productividad", name: "Resueltos por departamento", description: "Volumen cerrado por cola en el período." },
  { id: "reaperturas-por-agente", family: "productividad", name: "Reaperturas por agente", description: "Tickets que el cliente reabrió tras la solución." },
  { id: "volumen-respuestas", family: "productividad", name: "Volumen de respuestas emitidas", description: "Mensajes salientes por persona y período." },
  // Calidad y reclamaciones (5)
  { id: "reclamaciones-por-motivo", family: "calidad", name: "Reclamaciones por motivo", description: "Qué tipo de reclamo pesa más." },
  { id: "reclamaciones-por-linea", family: "calidad", name: "Reclamaciones por línea de producto", description: "Qué línea concentra más no conformidades." },
  { id: "hca-por-periodo", family: "calidad", name: "HCA abiertas y cerradas por período", description: "Ritmo de apertura contra cierre." },
  { id: "tiempo-cierre-hca", family: "calidad", name: "Tiempo medio de cierre de HCA", description: "Desde detectada hasta verificada." },
  { id: "creditos-emitidos", family: "calidad", name: "Notas de crédito emitidas y monto acumulado", description: "Cuánto se ha acreditado y por qué." },
  // Clientes (4)
  { id: "ranking-volumen", family: "clientes", name: "Ranking por volumen de tickets", description: "Quién abre más solicitudes." },
  { id: "ranking-reclamaciones", family: "clientes", name: "Ranking por reclamaciones", description: "Quién reclama más, no solo quién compra más." },
  { id: "actividad-vendedor", family: "clientes", name: "Actividad por vendedor", description: "Tickets y reclamaciones de la cartera de cada vendedor." },
  { id: "clientes-sin-actividad", family: "clientes", name: "Clientes sin actividad en el período", description: "Los que llevan tiempo sin tocar el sistema." },
  // Volumen (4)
  { id: "tickets-por-fecha", family: "volumen", name: "Tickets por día, semana y mes", description: "La curva de entrada de solicitudes." },
  { id: "tickets-por-canal", family: "volumen", name: "Por canal de entrada", description: "Correo, teléfono, manual o portal." },
  { id: "tickets-por-departamento", family: "volumen", name: "Por departamento", description: "Dónde entra más volumen." },
  { id: "tickets-por-prioridad", family: "volumen", name: "Por prioridad", description: "Qué tan cargada está la cola urgente." },
  // Auditoría (4)
  { id: "accesos-por-usuario", family: "auditoria", name: "Accesos por usuario", description: "Quién entró, cuándo y desde dónde." },
  { id: "cambios-estado-tickets", family: "auditoria", name: "Cambios de estado de tickets", description: "Todo tránsito de estado, con actor." },
  { id: "bajas-desactivaciones", family: "auditoria", name: "Bajas y desactivaciones", description: "Registros dados de baja en el período." },
  { id: "sesiones-revocadas", family: "auditoria", name: "Sesiones revocadas", description: "Cierres forzados de sesión, con motivo." },
];

export interface DateRange {
  from: string;
  to: string;
}

export interface StatusCount {
  status: string;
  count: number;
  tone: "neutral" | "red" | "green" | "warn";
}

export interface AgentLoad {
  agentName: string;
  departmentName: string;
  openTickets: number;
}

/** Datos de "Operación en vivo": los cinco reportes de esa familia. */
export interface LiveOperationData {
  byStatus: StatusCount[];
  unassigned: number;
  dueSoon: number;
  overdue: number;
  byAgent: AgentLoad[];
}

/** Datos de "SLA y tiempos": los cinco reportes de esa familia. */
export interface SlaTimesData {
  firstResponseCompliance: number;
  resolutionCompliance: number;
  avgFirstResponseMinutes: number;
  avgResolutionMinutes: number;
  avgPausedMinutes: number;
  byPriority: { priority: string; compliance: number }[];
}
