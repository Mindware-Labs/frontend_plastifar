// Catalogo completo de los 31 reportes de la seccion 11.2 del plan. La mayoria
// agrega sobre Tickets y sigue bloqueada hasta que exista la Bandeja; los que
// ya se calculan tienen su endpoint en ReportsController y su tipo en
// src/api/reports.ts.

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
}

/**
 * Las familias ya no son rutas: son la agrupacion del selector de reportes.
 *
 * Fueron siete entradas del menu, y cuatro de ellas —Operacion, SLA,
 * Productividad y Volumen— no tenian un solo dato: solo el catalogo de lo que
 * algun dia mostraran. Cuatro de cada siete clics terminaban en una pared. Todo
 * el modulo vive ahora en una pantalla que se genera eligiendo reporte y
 * criterios, y lo bloqueado se ve en el selector, desactivado y con su motivo,
 * en vez de ocupar menu.
 */
export const REPORT_FAMILIES: ReportFamilyInfo[] = [
  { key: "operacion", label: "Operación en vivo" },
  { key: "sla", label: "SLA y tiempos" },
  { key: "productividad", label: "Productividad" },
  { key: "calidad", label: "Calidad y reclamaciones" },
  { key: "clientes", label: "Clientes" },
  { key: "volumen", label: "Volumen" },
  { key: "auditoria", label: "Auditoría" },
];

/** Cada criterio que el generador sabe pintar y mandar al servidor. */
export type ReportFilterKey =
  | "range"
  | "client"
  | "productLine"
  | "responsible"
  | "territory"
  | "salesRep"
  | "clientType"
  | "activeOnly";

export interface ReportDefinition {
  id: string;
  family: ReportFamily;
  name: string;
  description: string;
  /** `null` = se calcula hoy. Texto = que tiene que existir antes. */
  blockedBy: string | null;
  /** Los criterios que este reporte acota de verdad. Ver la nota de abajo. */
  filters: ReportFilterKey[];
}

/**
 * Un filtro solo se ofrece si el reporte lo honra. Pintar un control que el
 * servidor ignora es peor que no tenerlo: el usuario cree que acoto y lee un
 * numero que responde a otra pregunta. Por eso «Notas de credito» ofrece
 * cliente pero no linea de producto —CreditRequest no tiene esa columna— y
 * «Clientes» no ofrece rango: es una foto del presente, no hay historial de
 * cartera del que sacar un «como estaba en marzo».
 */
const TICKETS = "la Bandeja de tickets";

/**
 * Los 31 reportes de la seccion 11.2, verbatim, mas dos que el servidor ya
 * calcula y el plan no enumera: el reparto de cartera por territorio y la
 * bitacora completa de auditoria. Los dos ya se mostraban en el modulo antes de
 * unificarlo; quitarlos para que la lista cuadrara con el plan habria sido
 * borrar trabajo hecho para dejar mas limpia una cuenta.
 */
export const REPORT_CATALOG: ReportDefinition[] = [
  // Operación en vivo (5) — toda la familia cuenta tickets.
  { id: "bandeja-por-estado", family: "operacion", name: "Bandeja por estado", description: "Cuántos tickets hay en cada estado ahora mismo.", blockedBy: TICKETS, filters: [] },
  { id: "tickets-sin-asignar", family: "operacion", name: "Tickets sin asignar", description: "Los que todavía no tienen responsable.", blockedBy: TICKETS, filters: [] },
  { id: "carga-por-agente", family: "operacion", name: "Carga por agente", description: "Tickets abiertos que tiene cada persona hoy.", blockedBy: TICKETS, filters: [] },
  { id: "tickets-por-vencer", family: "operacion", name: "Tickets por vencer", description: "Dentro del margen de SLA, pero cerca del límite.", blockedBy: TICKETS, filters: [] },
  { id: "tickets-vencidos", family: "operacion", name: "Tickets vencidos", description: "Ya pasaron su fecha de compromiso.", blockedBy: TICKETS, filters: [] },
  // SLA y tiempos (5) — el ticket todavia no guarda fechas de compromiso.
  { id: "cumplimiento-primera-respuesta", family: "sla", name: "Cumplimiento de primera respuesta", description: "% de tickets respondidos dentro del compromiso.", blockedBy: TICKETS, filters: [] },
  { id: "cumplimiento-resolucion", family: "sla", name: "Cumplimiento de resolución", description: "% de tickets resueltos dentro del compromiso.", blockedBy: TICKETS, filters: [] },
  { id: "tiempo-medio-primera-respuesta", family: "sla", name: "Tiempo medio de primera respuesta", description: "Promedio real, en horario laboral.", blockedBy: TICKETS, filters: [] },
  { id: "tiempo-medio-resolucion", family: "sla", name: "Tiempo medio de resolución", description: "Promedio real, en horario laboral.", blockedBy: TICKETS, filters: [] },
  { id: "tiempo-espera-cliente", family: "sla", name: "Tiempo acumulado en espera del cliente", description: "El tiempo que no cuenta contra el agente.", blockedBy: TICKETS, filters: [] },
  // Productividad (4)
  { id: "resueltos-por-agente", family: "productividad", name: "Resueltos por agente", description: "Volumen cerrado por persona en el período.", blockedBy: TICKETS, filters: [] },
  { id: "resueltos-por-departamento", family: "productividad", name: "Resueltos por departamento", description: "Volumen cerrado por cola en el período.", blockedBy: TICKETS, filters: [] },
  { id: "reaperturas-por-agente", family: "productividad", name: "Reaperturas por agente", description: "Tickets que el cliente reabrió tras la solución.", blockedBy: TICKETS, filters: [] },
  { id: "volumen-respuestas", family: "productividad", name: "Volumen de respuestas emitidas", description: "Mensajes salientes por persona y período.", blockedBy: TICKETS, filters: [] },
  // Calidad y reclamaciones (5) — tres se calculan; dos cuentan reclamaciones,
  // y una reclamacion es un ticket.
  { id: "hca-por-periodo", family: "calidad", name: "HCA abiertas y cerradas por período", description: "Ritmo de apertura contra cierre.", blockedBy: null, filters: ["range", "client", "productLine", "responsible"] },
  { id: "tiempo-cierre-hca", family: "calidad", name: "Tiempo medio de cierre de HCA", description: "Desde detectada hasta verificada.", blockedBy: null, filters: ["range", "client", "productLine", "responsible"] },
  { id: "creditos-emitidos", family: "calidad", name: "Notas de crédito emitidas y monto acumulado", description: "Cuánto se ha acreditado y por qué.", blockedBy: null, filters: ["range", "client"] },
  { id: "reclamaciones-por-motivo", family: "calidad", name: "Reclamaciones por motivo", description: "Qué tipo de reclamo pesa más.", blockedBy: TICKETS, filters: [] },
  { id: "reclamaciones-por-linea", family: "calidad", name: "Reclamaciones por línea de producto", description: "Qué línea concentra más no conformidades.", blockedBy: TICKETS, filters: [] },
  // Clientes (4 del plan + cartera por territorio) — sin rango: es una foto.
  { id: "cartera-por-territorio", family: "clientes", name: "Reparto de la cartera por territorio", description: "Cuántos clientes y cuántos activos tiene cada zona.", blockedBy: null, filters: ["territory", "salesRep", "clientType", "activeOnly"] },
  { id: "actividad-vendedor", family: "clientes", name: "Actividad por vendedor", description: "Cartera asignada a cada vendedor activo.", blockedBy: null, filters: ["territory", "salesRep", "clientType", "activeOnly"] },
  { id: "ranking-volumen", family: "clientes", name: "Ranking por volumen de tickets", description: "Quién abre más solicitudes.", blockedBy: TICKETS, filters: [] },
  { id: "ranking-reclamaciones", family: "clientes", name: "Ranking por reclamaciones", description: "Quién reclama más, no solo quién compra más.", blockedBy: TICKETS, filters: [] },
  { id: "clientes-sin-actividad", family: "clientes", name: "Clientes sin actividad en el período", description: "Los que llevan tiempo sin tocar el sistema.", blockedBy: TICKETS, filters: [] },
  // Volumen (4)
  { id: "tickets-por-fecha", family: "volumen", name: "Tickets por día, semana y mes", description: "La curva de entrada de solicitudes.", blockedBy: TICKETS, filters: [] },
  { id: "tickets-por-canal", family: "volumen", name: "Por canal de entrada", description: "Correo, teléfono, manual o portal.", blockedBy: TICKETS, filters: [] },
  { id: "tickets-por-departamento", family: "volumen", name: "Por departamento", description: "Dónde entra más volumen.", blockedBy: TICKETS, filters: [] },
  { id: "tickets-por-prioridad", family: "volumen", name: "Por prioridad", description: "Qué tan cargada está la cola urgente.", blockedBy: TICKETS, filters: [] },
  // Auditoría (4 del plan + la bitacora completa).
  { id: "bitacora-completa", family: "auditoria", name: "Bitácora completa", description: "Todo lo que se escribió en el período, con su actor.", blockedBy: null, filters: ["range"] },
  { id: "accesos-por-usuario", family: "auditoria", name: "Accesos por usuario", description: "Quién entró, cuándo y desde dónde.", blockedBy: null, filters: ["range"] },
  { id: "bajas-desactivaciones", family: "auditoria", name: "Bajas y desactivaciones", description: "Registros dados de baja en el período.", blockedBy: null, filters: ["range"] },
  { id: "sesiones-revocadas", family: "auditoria", name: "Sesiones revocadas", description: "Cierres forzados de sesión, con quién los ordenó.", blockedBy: null, filters: ["range"] },
  { id: "cambios-estado-tickets", family: "auditoria", name: "Cambios de estado de tickets", description: "Todo tránsito de estado, con actor.", blockedBy: TICKETS, filters: [] },
];

/** Los que se pueden generar hoy. */
export const AVAILABLE_REPORTS = REPORT_CATALOG.filter((r) => r.blockedBy === null);

export interface DateRange {
  from: string;
  to: string;
}
