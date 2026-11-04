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
  example: string;
  /** Etiquetas legacy entre corchetes que se resuelven igual. */
  legacyLabels?: string[];
}

export const CANNED_VARIABLES: CannedVariableDefinition[] = [
  {
    token: "{cliente.correo}",
    label: "Correo cliente",
    hint: "Se sustituye por el correo real del destinatario",
    example: "cliente@empresa.com",
    legacyLabels: ["Correo cliente", "Correo del cliente", "Email del cliente"],
  },
  {
    token: "{agente.nombre}",
    label: "Agente",
    hint: "Se sustituye por el nombre de quien envía el correo",
    example: "Soporte Plastifar",
    legacyLabels: ["Agente", "Nombre del agente", "Mi nombre"],
  },
  {
    token: "{agente.correo}",
    label: "Correo agente",
    hint: "Se sustituye por el correo corporativo del agente",
    example: "soporte@plastifar.com",
    legacyLabels: ["Correo agente", "Correo del agente"],
  },
  {
    token: "{fecha.hoy}",
    label: "Fecha",
    hint: "Se sustituye por la fecha de hoy en formato local",
    example: new Intl.DateTimeFormat("es-DO", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date()),
    legacyLabels: ["Fecha de hoy", "Fecha"],
  },
  {
    token: "{ticket.numero}",
    label: "Ticket",
    hint: "Se sustituye por el número de ticket vinculado al hilo",
    example: "#1042",
    legacyLabels: ["Ticket", "N° ticket", "Número de ticket", "N° pedido"],
  },
];

const KEY_ALIASES: Record<string, string> = {
  "cliente.email": "cliente.correo",
  "cliente.mail": "cliente.correo",
  "correo.cliente": "cliente.correo",
  "correo_cliente": "cliente.correo",
  "email.cliente": "cliente.correo",
  "email_cliente": "cliente.correo",
  "cliente.nombre": "cliente.correo",
  "cliente.name": "cliente.correo",
  "nombre.cliente": "cliente.correo",
  "nombre_cliente": "cliente.correo",
  "agente.email": "agente.correo",
  "agente.mail": "agente.correo",
  "correo.agente": "agente.correo",
  "correo_agente": "agente.correo",
  "agente.name": "agente.nombre",
  "nombre.agente": "agente.nombre",
  "nombre_agente": "agente.nombre",
  "fecha": "fecha.hoy",
  "hoy": "fecha.hoy",
  "ticket": "ticket.numero",
  "ticket.id": "ticket.numero",
  "numero.ticket": "ticket.numero",
};

/** Clave normalizada sin llaves, p. ej. `cliente.correo`. */
export function normalizeVariableKey(raw: string): string {
  let trimmed = raw.trim().toLowerCase();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  return KEY_ALIASES[trimmed] ?? trimmed;
}

export function lookupCannedVariable(keyOrToken: string): CannedVariableDefinition | undefined {
  const key = normalizeVariableKey(keyOrToken);
  return CANNED_VARIABLES.find((def) => normalizeVariableKey(def.token) === key);
}

export function cannedVariableLabel(keyOrToken: string): string {
  return lookupCannedVariable(keyOrToken)?.label ?? normalizeVariableKey(keyOrToken);
}

/** Texto de ejemplo para el cuerpo vacío (sin sintaxis técnica). */
export const CANNED_BODY_PLACEHOLDER =
  "Hola,\n\n" +
  "Gracias por comunicarse con Plastifar. Hemos recibido su consulta y nuestro equipo ya está atendiendo los detalles.\n\n" +
  "Quedamos a su entera disposición ante cualquier duda adicional.\n\n" +
  "Atentamente,\n" +
  "Equipo Plastifar";

/** Vista previa en listas: sustituye marcadores internos por etiquetas legibles. */
export function templateToReadablePlain(text: string): string {
  return text.replace(/\{([a-z0-9_.]+)\}/gi, (_, raw: string) => cannedVariableLabel(raw));
}

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

export function resolveCannedVariable(keyOrToken: string, ctx: CannedVariableContext): string | undefined {
  const normalized = normalizeVariableKey(keyOrToken);
  switch (normalized) {
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

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function legacyPattern(label: string): RegExp {
  const escaped = escapeRegExp(label);
  return new RegExp(`\\[\\s*${escaped}\\s*\\]`, "gi");
}

/** Sustituye variables `{clave}` y etiquetas `[…]` cuando hay dato; si no, deja etiqueta amigable. */
export function applyCannedVariables(text: string, ctx: CannedVariableContext): string {
  let out = text.replace(/\{([a-z0-9_.]+)\}/gi, (_match, key: string) => {
    const value = resolveCannedVariable(key, ctx);
    return value ?? cannedVariableLabel(key);
  });

  for (const def of CANNED_VARIABLES) {
    const value = resolveCannedVariable(def.token, ctx);
    if (!value || !def.legacyLabels) continue;
    for (const label of def.legacyLabels) {
      out = out.replace(legacyPattern(label), value);
    }
  }

  return out;
}

/**
 * Si el usuario insertó una plantilla antes de escribir el destinatario en "Para" (o cambió el destinatario),
 * actualiza la variable de destinatario (`Correo cliente`) cuando ya hay un correo válido.
 */
export function replaceRecipientVariablesInText(
  text: string,
  prevCtx: CannedVariableContext | undefined,
  nextCtx: CannedVariableContext,
): string {
  if (!text) return text;
  let out = applyCannedVariables(text, nextCtx);

  const nextEmail = nextCtx.contactEmail?.trim();
  if (nextEmail) {
    const emailCandidates = new Set<string>(["Correo cliente", "[Correo cliente]", "[Correo del cliente]"]);
    const prevEmail = prevCtx?.contactEmail?.trim();
    if (prevEmail && prevEmail !== nextEmail) {
      emailCandidates.add(prevEmail);
    }
    for (const candidate of emailCandidates) {
      out = out.replace(new RegExp(escapeRegExp(candidate), "g"), nextEmail);
    }
  }

  return out;
}

export function replaceRecipientVariablesInBlocks(
  blocks: unknown,
  prevCtx: CannedVariableContext | undefined,
  nextCtx: CannedVariableContext,
): { blocks: unknown; changed: boolean } {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return { blocks, changed: false };
  }

  let changed = false;

  const transformNodes = (nodes: unknown): unknown => {
    if (!Array.isArray(nodes)) return nodes;
    return nodes.map((node) => {
      if (!node || typeof node !== "object") return node;
      const item = node as Record<string, unknown>;
      if (typeof item.text === "string") {
        const nextText = replaceRecipientVariablesInText(item.text, prevCtx, nextCtx);
        if (nextText !== item.text) {
          changed = true;
          return { ...item, text: nextText };
        }
      }
      if (Array.isArray(item.content)) {
        const nextContent = transformNodes(item.content);
        if (nextContent !== item.content) {
          return { ...item, content: nextContent };
        }
      }
      return item;
    });
  };

  const transformBlockList = (list: unknown[]): unknown[] => {
    return list.map((raw) => {
      if (!raw || typeof raw !== "object") return raw;
      const block = raw as Record<string, unknown>;
      let nextBlock = block;

      if (Array.isArray(block.content)) {
        const nextContent = transformNodes(block.content);
        if (nextContent !== block.content) {
          nextBlock = { ...nextBlock, content: nextContent };
        }
      }

      if (Array.isArray(block.children) && block.children.length > 0) {
        const nextChildren = transformBlockList(block.children);
        if (nextChildren !== block.children) {
          nextBlock = { ...nextBlock, children: nextChildren };
        }
      }

      return nextBlock;
    });
  };

  const nextBlocks = transformBlockList(blocks);
  return { blocks: changed ? nextBlocks : blocks, changed };
}

/** Extrae nombre y correo desde una cadena como `"María <maria@empresa.com>"` o `"maria@empresa.com"`. */
export function parseRecipientAddress(raw: string): { email?: string; name?: string } {
  const first = raw.split(/[,;]/)[0]?.trim() ?? "";
  if (!first) return {};

  const angleMatch = first.match(/^(.*?)\s*<([^>]+)>\s*$/);
  if (angleMatch) {
    const rawName = angleMatch[1]?.trim().replace(/^["']|["']$/g, "");
    const rawEmail = angleMatch[2]?.trim();
    return {
      email: rawEmail && rawEmail.includes("@") ? rawEmail : undefined,
      name: rawName || undefined,
    };
  }

  if (first.includes("@")) {
    return { email: first };
  }

  return {};
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
