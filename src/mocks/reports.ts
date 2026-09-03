/**
 * Datos de prueba del modulo de Reportes.
 *
 * Solo dos de las siete familias tienen datos ilustrados con numeros: las que
 * se pueden armar sobre lo que ya definieron Catalogos y Clientes. El resto
 * agrega sobre Tickets, Calidad y Auditoria de escritura -que no existen
 * todavia-, asi que solo aparece el catalogo con su nombre y su proposito
 * (seccion 11.2 del plan), sin inventar cifras que no hay como sostener.
 */
import type { AgentLoad, DateRange, LiveOperationData, SlaTimesData } from "../types/reports";

function delay<T>(value: T, ms = 260): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/** Variacion cosmetica y estable por rango: cambiar la fecha cambia los
 *  numeros, sin pretender que hay una consulta real detras. */
function seedFrom(range: DateRange): number {
  const text = `${range.from}|${range.to}`;
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash;
}

function vary(base: number, seed: number, spread: number): number {
  return Math.max(0, Math.round(base + ((seed % (spread * 2 + 1)) - spread)));
}

const agents: AgentLoad[] = [
  { agentName: "Yordy Acosta", departmentName: "Calidad", openTickets: 0 },
  { agentName: "Richard De León", departmentName: "Soporte", openTickets: 0 },
  { agentName: "Carla Ventura", departmentName: "Almacén", openTickets: 0 },
  { agentName: "Sin asignar", departmentName: "—", openTickets: 0 },
];

export const reportsMock = {
  liveOperation(range: DateRange): Promise<LiveOperationData> {
    const seed = seedFrom(range);

    const byStatus = [
      { status: "Abierto", count: vary(38, seed, 6), tone: "neutral" as const },
      { status: "En espera del cliente", count: vary(14, seed >> 2, 4), tone: "warn" as const },
      { status: "Reenvío de producto", count: vary(5, seed >> 4, 2), tone: "neutral" as const },
      { status: "Solucionado", count: vary(212, seed >> 6, 20), tone: "green" as const },
      { status: "Cancelado", count: vary(9, seed >> 8, 3), tone: "neutral" as const },
    ];

    const byAgent = agents.map((agent, index) => ({
      ...agent,
      openTickets: vary([16, 11, 9, 4][index], seed >> (index + 1), 5),
    }));

    return delay({
      byStatus,
      unassigned: vary(4, seed >> 3, 3),
      dueSoon: vary(7, seed >> 5, 3),
      overdue: vary(3, seed >> 7, 2),
      byAgent,
    });
  },

  slaTimes(range: DateRange): Promise<SlaTimesData> {
    const seed = seedFrom(range);

    return delay({
      firstResponseCompliance: Math.min(100, vary(94, seed, 4)),
      resolutionCompliance: Math.min(100, vary(88, seed >> 2, 5)),
      avgFirstResponseMinutes: vary(42, seed >> 4, 10),
      avgResolutionMinutes: vary(390, seed >> 6, 60),
      avgPausedMinutes: vary(120, seed >> 8, 30),
      byPriority: [
        { priority: "Emergencia", compliance: Math.min(100, vary(97, seed, 3)) },
        { priority: "Alta", compliance: Math.min(100, vary(91, seed >> 2, 4)) },
        { priority: "Normal", compliance: Math.min(100, vary(89, seed >> 4, 5)) },
        { priority: "Baja", compliance: Math.min(100, vary(96, seed >> 6, 3)) },
      ],
    });
  },
};
