/** Contexto disponible al insertar una plantilla desde la bandeja. */
export interface CannedVariableContext {
  contactName?: string | null;
  contactEmail?: string | null;
  agentName?: string | null;
  agentEmail?: string | null;
  ticketId?: number | null;
}

export interface CannedVariableDefinition {
  token: string;
  label: string;
  hint: string;
  /** Etiquetas legacy entre corchetes que se resuelven igual. */
  legacyLabels?: string[];
}

export const CANNED_VARIABLES: CannedVariableDefinition[] = [
  {
    token: "{cliente.nombre}",
    label: "Cliente",
    hint: "Nombre del contacto del hilo",
    legacyLabels: ["Nombre del cliente", "Nombre del Cliente", "Nombre del contacto"],
  },
  {
    token: "{cliente.correo}",
    label: "Correo cliente",
    hint: "Correo del contacto",
    legacyLabels: ["Correo del cliente", "Email del cliente"],
  },
  {
    token: "{agente.nombre}",
    label: "Agente",
    hint: "Quien redacta el mensaje",
    legacyLabels: ["Nombre del agente", "Mi nombre"],
  },
  {
    token: "{agente.correo}",
    label: "Correo agente",
    hint: "Correo corporativo del agente",
  },
  {
    token: "{fecha.hoy}",
    label: "Fecha",
    hint: "Fecha de hoy (formato local)",
    legacyLabels: ["Fecha de hoy", "Fecha"],
  },
  {
    token: "{ticket.numero}",
    label: "Ticket",
    hint: "Número de ticket vinculado al hilo",
    legacyLabels: ["N° ticket", "Número de ticket", "N° pedido", "N° pedido"],
  },
];

function formatToday(): string {
  return new Intl.DateTimeFormat("es-DO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function formatTicketNumber(ticketId?: number | null): string {
  if (ticketId == null) return "";
  return `#${ticketId}`;
}

function resolveToken(key: string, ctx: CannedVariableContext): string | undefined {
  const normalized = key.trim().toLowerCase();
  switch (normalized) {
    case "cliente.nombre":
      return ctx.contactName?.trim() || undefined;
    case "cliente.correo":
      return ctx.contactEmail?.trim() || undefined;
    case "agente.nombre":
      return ctx.agentName?.trim() || undefined;
    case "agente.correo":
      return ctx.agentEmail?.trim() || undefined;
    case "fecha.hoy":
      return formatToday();
    case "ticket.numero":
      return ctx.ticketId != null ? formatTicketNumber(ctx.ticketId) : undefined;
    default:
      return undefined;
  }
}

function legacyPattern(label: string): RegExp {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\[\\s*${escaped}\\s*\\]`, "gi");
}

/** Sustituye variables `{clave}` y etiquetas legacy `[…]` cuando hay dato; si no, deja el marcador. */
export function applyCannedVariables(text: string, ctx: CannedVariableContext): string {
  let out = text.replace(/\{([a-z0-9_.]+)\}/gi, (match, key: string) => {
    const value = resolveToken(key, ctx);
    return value ?? match;
  });

  for (const def of CANNED_VARIABLES) {
    const value = resolveToken(def.token.slice(1, -1), ctx);
    if (!value || !def.legacyLabels) continue;
    for (const label of def.legacyLabels) {
      out = out.replace(legacyPattern(label), value);
    }
  }

  return out;
}

export function buildCannedVariableContext(input: {
  user?: { firstName?: string; lastName?: string; email?: string } | null;
  contactName?: string | null;
  contactEmail?: string | null;
  ticketId?: number | null;
}): CannedVariableContext {
  const agentName = [input.user?.firstName, input.user?.lastName].filter(Boolean).join(" ").trim();
  return {
    contactName: input.contactName,
    contactEmail: input.contactEmail,
    agentName: agentName || undefined,
    agentEmail: input.user?.email,
    ticketId: input.ticketId,
  };
}
