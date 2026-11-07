import type { DateRange } from "../../types/reports";

/** AAAA-MM-DD a partir de los componentes locales de la fecha. */
export function localIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function isoDaysAgo(days: number): string {
  // Mediodia local: restar dias sobre medianoche cruza el cambio de horario.
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return localIso(date);
}

/**
 * El rango de reposo, los ultimos 30 dias. Lo usa el generador, que guarda sus
 * criterios en estado y no en la direccion.
 *
 * `localIso` formatea desde los componentes locales y no con `toISOString()`,
 * que convierte a UTC: en Santo Domingo (UTC-4) cualquier consulta despues de
 * las 20:00 devolvia la fecha de manana.
 */
export function defaultRange(): DateRange {
  return { from: isoDaysAgo(30), to: isoDaysAgo(0) };
}

/**
 * Tope maximo del rango, en meses. Espejo de `Reports:MaxRangeMonths` en el
 * servidor (`ReportsController.MaxRangeMonths`, 12 por defecto): la seccion 4.2
 * pide que el formulario y el endpoint digan lo mismo, y descubrir el limite
 * como un aviso rojo despues del viaje de ida y vuelta no es decirlo.
 *
 * Si Plastifar cambia la configuracion del servidor, hay que cambiar esto: el
 * valor no viaja en ninguna respuesta.
 */
export const MAX_RANGE_MONTHS = 12;

/** El ultimo dia que el servidor acepta para un «desde» dado. */
export function maxToFor(from: string): string {
  const date = new Date(`${from}T12:00:00`);
  date.setMonth(date.getMonth() + MAX_RANGE_MONTHS);
  return localIso(date);
}

/** El primer dia que el servidor acepta para un «hasta» dado. */
export function minFromFor(to: string): string {
  const date = new Date(`${to}T12:00:00`);
  date.setMonth(date.getMonth() - MAX_RANGE_MONTHS);
  return localIso(date);
}
