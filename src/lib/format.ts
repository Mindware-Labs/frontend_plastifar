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

/**
 * Extrae el primer apellido respetando partículas compuestas comunes en español
 * y otros orígenes (ej: "De León", "De la Cruz", "Del Rosario", "De los Santos",
 * "San Martín", "Santa María", "Dos Santos", "Van der Bilt", etc.).
 */
export function getFirstSurname(lastName?: string | null): string {
  if (!lastName) return "";
  const normalized = lastName.trim().replace(/\s+/g, " ");
  if (!normalized) return "";

  // Prefijos de 3 palabras (partícula + artículo + sustantivo)
  // Ej: "De la Cruz", "De los Santos", "De las Nieves", "Van der Bilt"
  const multiParticleMatch = normalized.match(
    /^((?:de\s+(?:la|las|los)|van\s+der)\s+\S+)/i,
  );
  if (multiParticleMatch) {
    return multiParticleMatch[1];
  }

  // Prefijos de 2 palabras (partícula + sustantivo)
  // Ej: "De León", "Del Rosario", "San Martín", "Santa María", "Santo Domingo", "Da Silva", "Dos Santos", "Di Stefano", "Von Trapp", "Van Damme"
  const singleParticleMatch = normalized.match(
    /^((?:de|del|san|santa|santo|da|do|dos|das|di|von|van)\s+\S+)/i,
  );
  if (singleParticleMatch) {
    return singleParticleMatch[1];
  }

  // Apellido simple: toma la primera palabra (ej: "Pérez Gómez" -> "Pérez")
  return normalized.split(" ")[0] ?? "";
}

/**
 * Formatea el nombre a mostrar (primer nombre + primer apellido compuesto si aplica).
 * Ej: "Richard De León", "María De la Cruz", "Carlos Pérez".
 */
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

/**
 * Calcula las 2 iniciales representativas para el avatar de usuario.
 * Ej: "Richard" + "De León" -> "RD"
 *     "Carlos" + "Pérez" -> "CP"
 */
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
