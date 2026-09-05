import { useState } from "react";
import type { DateRange } from "../../types/reports";

/**
 * `toISOString()` convierte el ahora local a UTC: en Santo Domingo (UTC-4)
 * cualquier consulta despues de las 20:00 devolvia la fecha de manana. Se
 * formatea desde los componentes locales, igual que el ancla al mediodia de
 * Dias no laborables.
 */
export function todayIso(): string {
  return localIso(new Date());
}

function localIso(date: Date): string {
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

/** Rango obligatorio en todo reporte (seccion 11.3); por defecto, los últimos 30 días. */
export function useDateRange() {
  const [range, setRange] = useState<DateRange>({ from: isoDaysAgo(30), to: isoDaysAgo(0) });
  return { range, setRange };
}
