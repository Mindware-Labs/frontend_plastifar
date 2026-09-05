/** Criterios ademas del texto libre. Las fechas van como YYYY-MM-DD del calendario local. */
export interface AdvancedFilters {
  since: string;
  until: string;
  hasAttachments: boolean;
  /** Etiqueta exacta de la conversacion; vacio = cualquiera. */
  tag: string;
}

export const EMPTY_FILTERS: AdvancedFilters = { since: "", until: "", hasAttachments: false, tag: "" };

export function countActive(filters: AdvancedFilters) {
  const hasDate = Boolean(filters.since || filters.until);
  return (hasDate ? 1 : 0) + (filters.hasAttachments ? 1 : 0) + (filters.tag ? 1 : 0);
}

/** Medianoche local del dia: la persona piensa en su calendario, no en UTC. */
export function dayStart(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date);
}

function nextDay(day: string) {
  const date = dayStart(day);
  date.setDate(date.getDate() + 1);
  return date;
}

/** Lo que viaja al servidor: fechas en ISO con zona, y "hasta" exclusivo para incluir el dia entero. */
export function toQueryParams(filters: AdvancedFilters) {
  return {
    since: filters.since ? dayStart(filters.since).toISOString() : undefined,
    until: filters.until ? nextDay(filters.until).toISOString() : undefined,
    hasAttachments: filters.hasAttachments ? "true" : undefined,
    tag: filters.tag || undefined,
  };
}

export function formatDay(day: string) {
  return dayStart(day).toLocaleDateString("es-419", { day: "numeric", month: "short", year: "numeric" });
}
