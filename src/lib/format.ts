/** Hora si es de hoy, dia y mes si no: lo que importa en una fila de bandeja. */
export function formatEmailListDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  return sameDay
    ? date.toLocaleTimeString("es-419", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("es-419", { day: "2-digit", month: "short" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-419", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Fecha y hora para una celda de listado, recortada a lo que hace falta saber.
 *
 * `formatDateTime` escribe siempre el año —«12 sept 2026, 05:08 p.m.»— y eso
 * pedia 165 px de los 1085 del panel para un dato que, en una bandeja
 * operativa, casi nunca cambia: todo es de este año. Peor: el año ocupaba el
 * sitio del unico matiz que de verdad se consulta, que es si algo paso HOY.
 *
 * Asi que la precision sube cuanto mas reciente es el dato. Hoy: solo la hora.
 * Este año: dia y mes con hora. Mas atras: con año, porque ahi si distingue.
 */
export function formatListDateTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";

  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const time = d.toLocaleTimeString("es-419", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return time;

  const day = d.toLocaleDateString("es-419", {
    day: "2-digit",
    month: "short",
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
  return `${day}, ${time}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unitIndex]}`;
}

export function formatTicketCode(ticketId: number): string {
  return `PLT-${String(ticketId).padStart(6, "0")}`;
}

/** Estado de entrega que informa el proveedor, en palabras; cada pantalla pone su color. */
export const DELIVERY_LABELS: Record<string, string> = {
  Queued: "En cola",
  Sent: "Enviado",
  Delivered: "Entregado",
  Delayed: "Demorado",
  Bounced: "No entregado",
  Complained: "Marcado como spam",
  Failed: "No se pudo enviar",
};

/** Extrae el primer apellido respetando partículas compuestas en español y otros orígenes. */
function getFirstSurname(lastName?: string | null): string {
  if (!lastName) return "";
  const normalized = lastName.trim().replace(/\s+/g, " ");
  if (!normalized) return "";

  // Prefijos de 3 palabras (partícula + artículo + sustantivo).
  const multiParticleMatch = normalized.match(
    /^((?:de\s+(?:la|las|los)|van\s+der)\s+\S+)/i,
  );
  if (multiParticleMatch) {
    return multiParticleMatch[1];
  }

  // Prefijos de 2 palabras (partícula + sustantivo).
  const singleParticleMatch = normalized.match(
    /^((?:de|del|san|santa|santo|da|do|dos|das|di|von|van)\s+\S+)/i,
  );
  if (singleParticleMatch) {
    return singleParticleMatch[1];
  }

  // Apellido simple: toma la primera palabra (ej: "Pérez Gómez" -> "Pérez")
  return normalized.split(" ")[0] ?? "";
}

/** Formatea nombre para visualización (primer nombre + primer apellido compuesto). */
export function formatDisplayName(
  firstName?: string | null,
  lastName?: string | null,
  fallbackEmail?: string | null,
): string {
  const primerNombre = firstName?.trim().split(/\s+/)[0];
  const primerApellido = getFirstSurname(lastName);

  if (primerNombre && primerApellido) {
    return `${primerNombre} ${primerApellido}`;
  }
  if (primerNombre) {
    return primerNombre;
  }
  if (primerApellido) {
    return primerApellido;
  }
  if (fallbackEmail) {
    const raw = fallbackEmail.split("@")[0] ?? "";
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }
  return "Colaborador";
}

/** Calcula las 2 iniciales representativas para el avatar. */
export function formatInitials(
  firstName?: string | null,
  lastName?: string | null,
  fallbackEmail?: string | null,
): string {
  const primerNombre = firstName?.trim().split(/\s+/)[0];
  const primerApellido = getFirstSurname(lastName);

  if (primerNombre && primerApellido) {
    return `${primerNombre[0]}${primerApellido[0]}`.toUpperCase();
  }
  if (primerNombre) {
    return primerNombre.slice(0, 2).toUpperCase();
  }
  if (primerApellido) {
    return primerApellido.slice(0, 2).toUpperCase();
  }
  if (fallbackEmail) {
    return (fallbackEmail.split("@")[0] ?? "").slice(0, 2).toUpperCase() || "PF";
  }
  return "PF";
}

/** Iniciales de un nombre en una sola cadena ("Ana Pérez Gómez" -> "AP"); vale un correo como respaldo. */
export function initialsFromName(name: string, fallbackEmail?: string | null): string {
  const [first, ...rest] = name.trim().split(/\s+/);
  return formatInitials(first, rest.join(" "), fallbackEmail ?? first);
}

/** Calcula el tiempo restante o vencido de un compromiso de SLA para la bandeja o detalle. */
export function formatSlaRemaining(
  dueAtIso: string | null,
  isPaused: boolean,
  status?: string | null,
  closedAtIso?: string | null,
): { text: string; tone: "overdue" | "warning" | "ok" | "paused" | "completed" } {
  const normStatus = (status ?? "").toLowerCase().trim();
  const isFinalized = ["solucionado", "solucionada", "cancelado", "cerrado"].includes(normStatus);

  if (isFinalized) {
    if (normStatus === "cancelado") {
      return { text: "Cancelado", tone: "paused" };
    }
    // Si tiene compromiso de resolución y fecha de cierre, verificamos si cumplió en plazo
    if (dueAtIso && closedAtIso) {
      const due = new Date(dueAtIso).getTime();
      const closed = new Date(closedAtIso).getTime();
      if (closed <= due) {
        return { text: "Cumplido", tone: "completed" };
      } else {
        return { text: "Fuera de SLA", tone: "warning" };
      }
    }
    return { text: "Cumplido", tone: "completed" };
  }

  if (isPaused) {
    return { text: "Pausado", tone: "paused" };
  }
  if (!dueAtIso) {
    return { text: "Sin SLA", tone: "ok" };
  }
  const due = new Date(dueAtIso).getTime();
  const now = Date.now();
  const diffMs = due - now;

  if (diffMs <= 0) {
    const overdueMin = Math.max(1, Math.floor(Math.abs(diffMs) / 60000));
    if (overdueMin < 60) return { text: `Vencido (${overdueMin}m)`, tone: "overdue" };
    const overdueHours = Math.floor(overdueMin / 60);
    if (overdueHours < 24) return { text: `Vencido (${overdueHours}h)`, tone: "overdue" };
    const overdueDays = Math.floor(overdueHours / 24);
    return { text: `Vencido (${overdueDays}d)`, tone: "overdue" };
  }

  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return { text: `${diffMin}m restantes`, tone: "warning" };
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return { text: `${diffHours}h restantes`, tone: diffHours <= 4 ? "warning" : "ok" };
  const diffDays = Math.floor(diffHours / 24);
  return { text: `${diffDays}d restantes`, tone: "ok" };
}

/** Formatea fecha y hora de actividad de manera compacta para tablas. */
export function formatActivityDate(iso: string | null | undefined): { compact: string; full: string } {
  if (!iso) return { compact: "—", full: "Sin actividad" };
  const date = new Date(iso);
  if (isNaN(date.getTime())) return { compact: "—", full: "Fecha inválida" };

  const now = new Date();
  const full = formatDateTime(iso);

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const timeStr = date.toLocaleTimeString("es-419", { hour: "2-digit", minute: "2-digit" });

  if (isToday) {
    return { compact: `Hoy, ${timeStr}`, full };
  }
  if (isYesterday) {
    return { compact: `Ayer, ${timeStr}`, full };
  }

  const isSameYear = date.getFullYear() === now.getFullYear();
  const dateStr = date.toLocaleDateString("es-419", {
    day: "2-digit",
    month: "short",
    ...(isSameYear ? {} : { year: "numeric" }),
  });

  return { compact: `${dateStr}, ${timeStr}`, full };
}
