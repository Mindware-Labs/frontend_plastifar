// Calculo de vencimiento de SLA en horario laboral.
//
// Espejo de la regla del servidor descrita en la seccion 8.3 del plan: cuando la
// politica lo indica, el vencimiento se calcula sumando solo minutos de jornada,
// saltando los dias no laborables y los feriados. Este calculo vive en el cliente
// unicamente para que el dialogo pueda mostrar el efecto de la regla antes de
// guardarla; el vencimiento real lo sella el servidor al crear el ticket.

import { WEEKDAYS, type Holiday, type SlaPolicy, type Weekday } from "../types/settings";

const MINUTE = 60_000;

/** "08:30" -> minutos desde la medianoche. */
function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function weekdayOf(date: Date): Weekday | undefined {
  return WEEKDAYS.find((day) => day.jsDay === date.getDay())?.key;
}

export interface DeadlineResult {
  /** Instante de vencimiento. */
  at: Date;
  /** Dias de fin de semana o no laborables saltados por el camino. */
  skippedNonWorkdays: number;
  /** Feriados saltados por el camino. */
  skippedHolidays: number;
  /** Verdadero cuando la jornada esta mal definida y no hay minutos que sumar. */
  impossible: boolean;
}

/**
 * Suma `minutes` minutos de jornada a partir de `from`.
 *
 * Avanza en tramos de jornada, no minuto a minuto: entra al siguiente dia
 * laborable y consume lo que quepa hasta el cierre. Sin `businessHoursOnly` el
 * reloj corre continuo y el resultado es una suma directa.
 */
export function addWorkingMinutes(
  from: Date,
  minutes: number,
  policy: Pick<SlaPolicy, "businessHoursOnly" | "workdayStart" | "workdayEnd" | "workDays">,
  holidays: Holiday[],
): DeadlineResult {
  if (!policy.businessHoursOnly) {
    return {
      at: new Date(from.getTime() + minutes * MINUTE),
      skippedNonWorkdays: 0,
      skippedHolidays: 0,
      impossible: false,
    };
  }

  const opens = toMinutes(policy.workdayStart);
  const closes = toMinutes(policy.workdayEnd);
  const dayLength = closes - opens;

  // Una jornada vacia o invertida no puede consumir minutos: avisar en vez de
  // colgarse buscando un dia que nunca llega.
  if (dayLength <= 0 || policy.workDays.length === 0) {
    return { at: from, skippedNonWorkdays: 0, skippedHolidays: 0, impossible: true };
  }

  const closedDates = new Set(holidays.filter((day) => day.isActive).map((day) => day.date));

  let cursor = new Date(from);
  let remaining = minutes;
  let skippedNonWorkdays = 0;
  let skippedHolidays = 0;

  // Tope de seguridad: dos anios de jornadas. Un SLA mayor no es un SLA.
  for (let guard = 0; guard < 800 && remaining > 0; guard += 1) {
    const day = weekdayOf(cursor);
    const isWorkday = day !== undefined && policy.workDays.includes(day);
    const isHoliday = closedDates.has(isoDate(cursor));

    if (!isWorkday || isHoliday) {
      // Existiendo un feriado, el feriado es la razon: contarlo como «dia no
      // laborable» porque encima cae en sabado atribuye el salto a la jornada
      // cuando quien lo causa es un registro del calendario.
      if (isHoliday) skippedHolidays += 1;
      else skippedNonWorkdays += 1;
      cursor = nextDayAtOpening(cursor, opens);
      continue;
    }

    const minuteOfDay = cursor.getHours() * 60 + cursor.getMinutes();

    if (minuteOfDay < opens) {
      cursor = atMinute(cursor, opens);
      continue;
    }

    if (minuteOfDay >= closes) {
      cursor = nextDayAtOpening(cursor, opens);
      continue;
    }

    const availableToday = closes - minuteOfDay;

    if (remaining <= availableToday) {
      cursor = new Date(cursor.getTime() + remaining * MINUTE);
      remaining = 0;
      break;
    }

    remaining -= availableToday;
    cursor = nextDayAtOpening(cursor, opens);
  }

  return { at: cursor, skippedNonWorkdays, skippedHolidays, impossible: remaining > 0 };
}

function atMinute(date: Date, minuteOfDay: number): Date {
  const next = new Date(date);
  next.setHours(Math.floor(minuteOfDay / 60), minuteOfDay % 60, 0, 0);
  return next;
}

function nextDayAtOpening(date: Date, opens: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  next.setHours(Math.floor(opens / 60), opens % 60, 0, 0);
  return next;
}

/** Minutos de jornada de una politica, o null si su reloj corre continuo. */
export function workdayMinutes(
  policy: Pick<SlaPolicy, "businessHoursOnly" | "workdayStart" | "workdayEnd">,
): number | null {
  if (!policy.businessHoursOnly) return null;
  const length = toMinutes(policy.workdayEnd) - toMinutes(policy.workdayStart);
  return length > 0 ? length : null;
}

/**
 * "480" -> "8 h". Los minutos sueltos solo aparecen cuando existen.
 *
 * Con reloj de jornada se cuenta en jornadas, no en dias de calendario: decir
 * «2 d» de una politica que corre nueve horas diarias describe un plazo que la
 * regla nunca produce, y el simulador lo desmiente en la misma pantalla.
 */
export function humanizeMinutes(minutes: number, perWorkday?: number | null): string {
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const head = rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;

  if (perWorkday) {
    const days = minutes / perWorkday;
    if (days < 2) return head;
    // Formato explicito: es-DO usa punto decimal, como en-US y a diferencia de
    // es-ES. Se deja el locale a la vista para que nadie lo "corrija" a coma.
    const count = days.toLocaleString("es-DO", { maximumFractionDigits: 1 });
    return `${head} · ${count} jornadas`;
  }

  if (hours < 24) return head;

  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours === 0 ? `${days} d` : `${days} d ${restHours} h`;
}
