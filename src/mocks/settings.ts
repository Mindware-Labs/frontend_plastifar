/**
 * Datos de prueba del modulo de Catalogos y configuracion.
 *
 * Existe solo mientras el backend no expone /api/settings/... Cada funcion imita
 * la forma y la latencia del endpoint que la va a sustituir. Los datos incluyen
 * a proposito los casos que activan las guardas de la seccion 8.3: una politica
 * predeterminada por prioridad, una linea de producto en uso, motivos con
 * tickets encima y un segundo nivel de motivos.
 */
import type {
  EmailTemplate,
  Holiday,
  Mailbox,
  ProductLine,
  SlaPolicy,
  TicketTopic,
} from "../types/settings";

const departments = [
  { id: 1, name: "Calidad" },
  { id: 2, name: "Almacén" },
  { id: 3, name: "Soporte" },
  { id: 4, name: "Administración" },
];

const topics: TicketTopic[] = [
  {
    id: 1,
    name: "Reclamación",
    parentId: null,
    defaultDepartmentId: 1,
    defaultPriority: "Alta",
    slaPolicyId: 2,
    requiresProductLine: true,
    isActive: true,
    ticketCount: 412,
  },
  {
    id: 2,
    name: "Producto defectuoso",
    parentId: 1,
    defaultDepartmentId: 1,
    defaultPriority: "Emergencia",
    slaPolicyId: 1,
    requiresProductLine: true,
    isActive: true,
    ticketCount: 188,
  },
  {
    id: 3,
    name: "Diferencia de medida",
    parentId: 1,
    defaultDepartmentId: 1,
    defaultPriority: "Alta",
    slaPolicyId: null,
    requiresProductLine: true,
    isActive: true,
    ticketCount: 96,
  },
  {
    id: 4,
    name: "Faltante",
    parentId: null,
    defaultDepartmentId: 2,
    defaultPriority: "Alta",
    slaPolicyId: 2,
    requiresProductLine: false,
    isActive: true,
    ticketCount: 233,
  },
  {
    id: 5,
    name: "Cotizaciones",
    parentId: null,
    defaultDepartmentId: 3,
    defaultPriority: "Normal",
    slaPolicyId: 3,
    requiresProductLine: false,
    isActive: true,
    ticketCount: 587,
  },
  {
    id: 6,
    name: "Muestras",
    parentId: null,
    defaultDepartmentId: 3,
    defaultPriority: "Baja",
    slaPolicyId: 4,
    requiresProductLine: true,
    isActive: true,
    ticketCount: 74,
  },
  {
    id: 7,
    name: "Devolución por acuerdo comercial",
    parentId: null,
    defaultDepartmentId: 4,
    defaultPriority: "Normal",
    slaPolicyId: null,
    requiresProductLine: false,
    isActive: false,
    ticketCount: 18,
  },
];

const policies: SlaPolicy[] = [
  {
    id: 1,
    name: "Emergencia · reloj continuo",
    priority: "Emergencia",
    firstResponseMinutes: 30,
    resolutionMinutes: 240,
    businessHoursOnly: false,
    workdayStart: "08:00",
    workdayEnd: "17:00",
    workDays: ["L", "M", "X", "J", "V"],
    isDefault: true,
    isActive: true,
  },
  {
    id: 2,
    name: "Alta · jornada laboral",
    priority: "Alta",
    firstResponseMinutes: 60,
    resolutionMinutes: 480,
    businessHoursOnly: true,
    workdayStart: "08:00",
    workdayEnd: "17:00",
    workDays: ["L", "M", "X", "J", "V"],
    isDefault: true,
    isActive: true,
  },
  {
    id: 3,
    name: "Normal · jornada laboral",
    priority: "Normal",
    firstResponseMinutes: 240,
    resolutionMinutes: 1440,
    businessHoursOnly: true,
    workdayStart: "08:00",
    workdayEnd: "17:00",
    workDays: ["L", "M", "X", "J", "V"],
    isDefault: true,
    isActive: true,
  },
  {
    id: 4,
    name: "Baja · jornada laboral",
    priority: "Baja",
    firstResponseMinutes: 480,
    resolutionMinutes: 2880,
    businessHoursOnly: true,
    workdayStart: "08:00",
    workdayEnd: "17:00",
    workDays: ["L", "M", "X", "J", "V"],
    isDefault: true,
    isActive: true,
  },
  {
    id: 5,
    name: "Alta · con sábado medio día",
    priority: "Alta",
    firstResponseMinutes: 60,
    resolutionMinutes: 600,
    businessHoursOnly: true,
    workdayStart: "08:00",
    workdayEnd: "12:00",
    workDays: ["L", "M", "X", "J", "V", "S"],
    isDefault: false,
    isActive: true,
  },
];

const holidays: Holiday[] = [
  { id: 1, date: "2026-01-01", name: "Año Nuevo", isActive: true },
  { id: 2, date: "2026-01-21", name: "Nuestra Señora de la Altagracia", isActive: true },
  { id: 3, date: "2026-02-27", name: "Día de la Independencia", isActive: true },
  { id: 4, date: "2026-05-01", name: "Día del Trabajo", isActive: true },
  { id: 5, date: "2026-08-16", name: "Día de la Restauración", isActive: true },
  { id: 6, date: "2026-09-03", name: "Inventario general de planta", isActive: true },
  { id: 7, date: "2026-09-04", name: "Inventario general de planta", isActive: true },
  { id: 8, date: "2026-12-25", name: "Navidad", isActive: true },
  { id: 9, date: "2025-12-25", name: "Navidad", isActive: false },
];

const productLines: ProductLine[] = [
  { id: 1, code: "BIO", name: "Bio", isActive: true, usedByTopics: 3 },
  { id: 2, code: "RIG", name: "Rígido", isActive: true, usedByTopics: 2 },
  { id: 3, code: "FLX", name: "Flexible", isActive: true, usedByTopics: 4 },
  { id: 4, code: "TER", name: "Termoencogible", isActive: true, usedByTopics: 0 },
  { id: 5, code: "AGR", name: "Agrícola", isActive: false, usedByTopics: 0 },
];

const templates: EmailTemplate[] = [
  {
    id: 1,
    key: "ticket.recibido",
    name: "Acuse de recibo",
    subject: "Recibimos su solicitud · Ticket {{ticket}}",
    body:
      "Estimado/a {{contacto}}:\n\n" +
      "Recibimos su solicitud y quedó registrada con el número {{ticket}}. " +
      "Un miembro de nuestro equipo la está revisando y le responderemos dentro del " +
      "tiempo comprometido.\n\n" +
      "Cordialmente,\n{{agente}}\nPlastifar, S. A.",
    isActive: true,
  },
  {
    id: 2,
    key: "ticket.resuelto",
    name: "Solicitud resuelta",
    subject: "Su solicitud {{ticket}} fue resuelta",
    body:
      "Estimado/a {{contacto}}:\n\n" +
      "Le informamos que su solicitud {{ticket}} fue resuelta. Si el asunto continúa, " +
      "puede responder a este correo dentro de los próximos 7 días y la reabriremos " +
      "automáticamente.\n\n" +
      "Cordialmente,\n{{agente}}\nPlastifar, S. A.",
    isActive: true,
  },
  {
    id: 3,
    key: "credito.aprobado",
    name: "Crédito aprobado",
    subject: "Nota de crédito aprobada · {{cliente}}",
    body:
      "Estimado/a {{contacto}}:\n\n" +
      "La solicitud de crédito asociada al ticket {{ticket}} fue aprobada. " +
      "El departamento de Administración procederá con la emisión de la nota de crédito " +
      "a nombre de {{cliente}}.\n\n" +
      "Cordialmente,\n{{agente}}",
    isActive: true,
  },
  {
    id: 4,
    key: "hca.vencida",
    name: "Aviso de HCA vencida",
    subject: "Hoja de corrección vencida",
    body:
      "La hoja de corrección a su cargo superó la fecha comprometida de cierre. " +
      "Por favor actualice el plan de acción o justifique la prórroga.",
    isActive: false,
  },
];

const mailboxes: Mailbox[] = [
  {
    id: 1,
    address: "calidad@plastifar.com",
    displayName: "Calidad · reclamaciones",
    provider: "Office 365",
    departmentId: 1,
    secretRef: "mailbox/calidad",
    isActive: true,
    lastSyncedAt: "2026-09-03T12:40:00Z",
  },
  {
    id: 2,
    address: "almacen@plastifar.com",
    displayName: "Almacén · faltantes",
    provider: "Gmail",
    departmentId: 2,
    secretRef: "mailbox/almacen",
    isActive: true,
    lastSyncedAt: "2026-09-03T11:05:00Z",
  },
  {
    id: 3,
    address: "ventas@plastifar.com",
    displayName: "Soporte · cotizaciones",
    provider: "IMAP",
    departmentId: 3,
    secretRef: "mailbox/ventas",
    isActive: false,
    lastSyncedAt: null,
  },
];

/** Latencia simulada: sin ella los estados de carga nunca se ven al desarrollar. */
function delay<T>(value: T, ms = 240): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const settingsMock = {
  departments: () => clone(departments),
  topics: (): Promise<TicketTopic[]> => delay(clone(topics)),
  policies: (): Promise<SlaPolicy[]> => delay(clone(policies)),
  holidays: (): Promise<Holiday[]> => delay(clone(holidays)),
  productLines: (): Promise<ProductLine[]> => delay(clone(productLines)),
  templates: (): Promise<EmailTemplate[]> => delay(clone(templates)),
  mailboxes: (): Promise<Mailbox[]> => delay(clone(mailboxes)),
};
