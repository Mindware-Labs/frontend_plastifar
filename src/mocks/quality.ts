/**
 * Datos de prueba del modulo de Calidad.
 *
 * Existe solo mientras el backend no expone /api/quality/... Los datos incluyen
 * a proposito los casos que activan las guardas de la seccion 10.3: una hoja
 * vencida, una sin causa raiz que no puede pasar a ejecucion, una con acciones
 * pendientes que no puede cerrarse, una lista para cerrar, y una ya cerrada.
 *
 * Las solicitudes de credito incluyen una en estado Solicitada que se marca como
 * pedida por quien mira la pantalla (ver `creditRequests`), porque la regla mas
 * importante del modulo — quien pide no aprueba — es invisible si todas las
 * solicitudes de prueba las hizo otra persona.
 */
import type {
  ActionPlanItem,
  CorrectiveActionSheet,
  CreditRequest,
  QualityStaff,
} from "../types/quality";

/** Mismo universo de personal que el modulo de Personal, recortado a lo que
 *  estas pantallas necesitan mostrar sin depender de esa API real. */
const staff: QualityStaff[] = [
  { id: 1, name: "Yordy Acosta" },
  { id: 2, name: "Richard De León" },
  { id: 3, name: "Carla Ventura" },
  { id: 4, name: "Elena Guzmán" },
];

const sheets: CorrectiveActionSheet[] = [
  {
    id: 1,
    number: "HCA-000141",
    ticketId: 482,
    ticketNumber: "000482",
    clientId: 1,
    productLineId: 2,
    detectedAt: "2026-08-11T13:40:00Z",
    description:
      "El lote 4471 de envases rígidos llegó con rebabas en el borde superior. El cliente rechazó 1 200 unidades en recepción y detuvo su línea de llenado durante la mañana.",
    immediateAction:
      "Se retiró el lote completo del almacén del cliente y se repuso con material del lote 4488.",
    rootCause:
      "Desgaste del molde 7 sin registro de mantenimiento preventivo: la última revisión consta en abril y el plan exige cada ocho semanas.",
    responsibleStaffId: 3,
    dueDate: "2026-08-29",
    status: "En ejecución",
    effectivenessCheckAt: null,
    effectivenessNotes: null,
    closedAt: null,
    closedByStaffId: null,
    closingNote: null,
    createdAt: "2026-08-11T14:05:00Z",
  },
  {
    id: 2,
    number: "HCA-000142",
    ticketId: 495,
    ticketNumber: "000495",
    clientId: 3,
    productLineId: 3,
    detectedAt: "2026-08-26T09:15:00Z",
    description:
      "Rollos de film flexible con espesor por debajo de la tolerancia declarada en ficha técnica. Detectado por el cliente al calibrar su selladora.",
    immediateAction: "Se bloqueó el resto del lote en almacén a la espera del análisis.",
    rootCause: null,
    responsibleStaffId: 1,
    dueDate: "2026-09-12",
    status: "En análisis",
    effectivenessCheckAt: null,
    effectivenessNotes: null,
    closedAt: null,
    closedByStaffId: null,
    closingNote: null,
    createdAt: "2026-08-26T09:40:00Z",
  },
  {
    id: 3,
    number: "HCA-000143",
    ticketId: null,
    ticketNumber: null,
    clientId: 2,
    productLineId: 1,
    detectedAt: "2026-08-30T16:00:00Z",
    description:
      "Auditoría interna: las bolsas Bio del pedido 9912 salieron sin el sello de compostabilidad impreso.",
    immediateAction: null,
    rootCause:
      "Cambio de cliché sin verificación posterior: el operador sustituyó la placa y nadie firmó la primera pieza conforme.",
    responsibleStaffId: 4,
    dueDate: "2026-09-20",
    status: "En verificación",
    effectivenessCheckAt: null,
    effectivenessNotes: null,
    closedAt: null,
    closedByStaffId: null,
    closingNote: null,
    createdAt: "2026-08-30T16:20:00Z",
  },
  {
    id: 4,
    number: "HCA-000140",
    ticketId: 461,
    ticketNumber: "000461",
    clientId: 4,
    productLineId: 2,
    detectedAt: "2026-07-02T11:10:00Z",
    description:
      "Entrega institucional con etiquetado en idioma incorrecto para el destino aduanero declarado.",
    immediateAction: "Reetiquetado completo en almacén antes del despacho.",
    rootCause: "La orden de producción no arrastraba el país de destino desde el pedido comercial.",
    responsibleStaffId: 2,
    dueDate: "2026-08-01",
    status: "Cerrada",
    effectivenessCheckAt: "2026-08-14T15:00:00Z",
    effectivenessNotes:
      "Se auditaron las tres entregas institucionales siguientes: todas con etiquetado correcto y firma de verificación en la orden.",
    closedAt: "2026-08-14T15:30:00Z",
    closedByStaffId: 3,
    closingNote: null,
    createdAt: "2026-07-02T11:35:00Z",
  },
];

const planItems: ActionPlanItem[] = [
  {
    id: 1,
    sheetId: 1,
    description: "Reponer el molde 7 y registrar la sustitución en la ficha de mantenimiento.",
    responsibleStaffId: 2,
    dueDate: "2026-08-22",
    completedAt: "2026-08-21",
    status: "Cumplida",
    cancelReason: null,
  },
  {
    id: 2,
    sheetId: 1,
    description:
      "Incorporar la revisión de moldes al calendario preventivo con alerta a las ocho semanas.",
    responsibleStaffId: 3,
    dueDate: "2026-08-28",
    completedAt: null,
    status: "En curso",
    cancelReason: null,
  },
  {
    id: 3,
    sheetId: 1,
    description: "Capacitar al turno de noche en la inspección visual de borde.",
    responsibleStaffId: 4,
    dueDate: "2026-09-10",
    completedAt: null,
    status: "Pendiente",
    cancelReason: null,
  },
  {
    id: 4,
    sheetId: 3,
    description: "Exigir firma de primera pieza conforme tras todo cambio de cliché.",
    responsibleStaffId: 4,
    dueDate: "2026-09-08",
    completedAt: "2026-09-01",
    status: "Cumplida",
    cancelReason: null,
  },
  {
    id: 5,
    sheetId: 3,
    description: "Comprar un lector de código para validar el sello en línea.",
    responsibleStaffId: 2,
    dueDate: "2026-09-15",
    completedAt: null,
    status: "Anulada",
    cancelReason:
      "El lector no llega antes del cierre comprometido; la verificación por firma cubre el riesgo y se replantea como mejora aparte.",
  },
  {
    id: 6,
    sheetId: 4,
    description: "Arrastrar el país de destino del pedido a la orden de producción.",
    responsibleStaffId: 2,
    dueDate: "2026-07-25",
    completedAt: "2026-07-23",
    status: "Cumplida",
    cancelReason: null,
  },
];

const creditRequests: CreditRequest[] = [
  {
    id: 1,
    number: "SC-000078",
    ticketId: 482,
    ticketNumber: "000482",
    clientId: 1,
    amount: 48_600,
    currency: "DOP",
    reason:
      "Reposición de las 1 200 unidades rechazadas del lote 4471 y el flete de la devolución.",
    invoiceRef: "B0100004471",
    status: "Solicitada",
    requestedByStaffId: 3,
    requestedAt: "2026-08-12T14:20:00Z",
    decidedByStaffId: null,
    decidedAt: null,
    decisionNote: null,
  },
  {
    id: 2,
    number: "SC-000079",
    ticketId: 495,
    ticketNumber: "000495",
    clientId: 3,
    amount: 1_250,
    currency: "USD",
    reason: "Diferencia de espesor en el film del pedido 9887, aceptada tras medición conjunta.",
    invoiceRef: "B0100009887",
    status: "Solicitada",
    requestedByStaffId: 1,
    requestedAt: "2026-08-27T15:10:00Z",
    decidedByStaffId: null,
    decidedAt: null,
    decisionNote: null,
  },
  {
    id: 3,
    number: "SC-000077",
    ticketId: 461,
    ticketNumber: "000461",
    clientId: 4,
    amount: 22_000,
    currency: "DOP",
    reason: "Costo del reetiquetado asumido por Plastifar.",
    invoiceRef: "B0100004461",
    status: "Aprobada",
    requestedByStaffId: 2,
    requestedAt: "2026-07-05T13:40:00Z",
    decidedByStaffId: 3,
    decidedAt: "2026-07-06T15:05:00Z",
    decisionNote: "Procede: el error de etiquetado es nuestro y está documentado en la HCA-000140.",
  },
  {
    id: 4,
    number: "SC-000076",
    ticketId: null,
    ticketNumber: null,
    clientId: 2,
    amount: 9_800,
    currency: "DOP",
    reason: "Reclamación por faltante en el pedido 9790.",
    invoiceRef: "B0100009790",
    status: "Rechazada",
    requestedByStaffId: 1,
    requestedAt: "2026-06-18T17:25:00Z",
    decidedByStaffId: 2,
    decidedAt: "2026-06-19T13:15:00Z",
    decisionNote:
      "El conduce firmado por el cliente cubre la cantidad completa; el faltante no se sostiene.",
  },
  {
    id: 5,
    number: "SC-000075",
    ticketId: null,
    ticketNumber: null,
    clientId: 1,
    amount: 15_400,
    currency: "DOP",
    reason: "Nota de crédito por reclamación de mayo, ya aplicada en contabilidad.",
    invoiceRef: "B0100004390",
    status: "Aplicada",
    requestedByStaffId: 3,
    requestedAt: "2026-05-20T14:35:00Z",
    decidedByStaffId: 2,
    decidedAt: "2026-05-21T18:50:00Z",
    decisionNote: "Aprobada y remitida a contabilidad el mismo día.",
  },
];

function delay<T>(value: T, ms = 260): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const qualityMock = {
  staff: () => clone(staff),

  sheets: (): Promise<CorrectiveActionSheet[]> => delay(clone(sheets)),

  planItems: (sheetId: number): Promise<ActionPlanItem[]> =>
    delay(clone(planItems.filter((item) => item.sheetId === sheetId))),

  /** Sincrono y agrupado: el listado cuenta las acciones de todas las filas a
   *  la vez, y pedirlas hoja por hoja seria un N+1. */
  planItemsBySheet(): Record<number, ActionPlanItem[]> {
    const grouped: Record<number, ActionPlanItem[]> = {};
    for (const item of clone(planItems)) {
      (grouped[item.sheetId] ??= []).push(item);
    }
    return grouped;
  },

  /**
   * `viewerStaffId` marca una solicitud pendiente como hecha por quien mira,
   * para que la separacion entre solicitante y aprobador sea observable con
   * datos de prueba. Cuando exista el API esto desaparece: el servidor ya sabe
   * quien pidio cada una.
   */
  creditRequests: (viewerStaffId: number | null): Promise<CreditRequest[]> => {
    const seeded = clone(creditRequests).map((request) =>
      request.id === 2 && viewerStaffId !== null
        ? { ...request, requestedByStaffId: viewerStaffId }
        : request,
    );
    return delay(seeded);
  },
};
