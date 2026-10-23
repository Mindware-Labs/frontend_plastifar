// Fechas de los formularios, sin React dentro. Un día (ISO corto) y un
// instante (UTC con hora) se muestran igual en todos los módulos.

const dayFormat = new Intl.DateTimeFormat("es-DO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const instantFormat = new Intl.DateTimeFormat("es-DO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Fecha de día (ISO corto). La conversión a hora local ocurre solo al mostrar. */
export function formatDay(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? "—" : dayFormat.format(parsed);
}

/** Instante UTC con hora. */
export function formatInstant(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : instantFormat.format(parsed);
}
