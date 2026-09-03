import { useState } from "react";
import type { DateRange } from "../../types/reports";

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

/** Rango obligatorio en todo reporte (seccion 11.3); por defecto, los últimos 30 días. */
export function useDateRange() {
  const [range, setRange] = useState<DateRange>({ from: isoDaysAgo(30), to: isoDaysAgo(0) });
  return { range, setRange };
}
