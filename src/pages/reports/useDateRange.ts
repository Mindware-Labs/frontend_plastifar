import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
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

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDate(value: string | null): value is string {
  if (value === null || !ISO_DATE.test(value)) return false;
  // El patron acepta "2026-02-31"; Date lo corrige en silencio al 3 de marzo.
  return localIso(new Date(`${value}T12:00:00`)) === value;
}

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

/**
 * Rango obligatorio en todo reporte (seccion 11.3); por defecto, los ultimos 30
 * dias.
 *
 * Vive en la cadena de consulta y no en el estado del componente: una recarga o
 * una pestana nueva volvian en silencio a los ultimos 30 dias sin avisar de que
 * las cifras ya no eran las de antes, y nada en la direccion decia que periodo
 * cubria lo que se veia en pantalla —una captura de este reporte no se podia
 * atribuir a ningun rango—. Con el rango en la URL, el enlace es el reporte.
 */
export function useDateRange() {
  const [params, setParams] = useSearchParams();

  const rawFrom = params.get("desde");
  const rawTo = params.get("hasta");

  // Un parametro escrito a mano o truncado no puede dejar la pantalla en
  // blanco: lo que no sea una fecha valida cae al valor por defecto.
  const from = isIsoDate(rawFrom) ? rawFrom : isoDaysAgo(30);
  const to = isIsoDate(rawTo) ? rawTo : isoDaysAgo(0);

  function setRange(next: DateRange) {
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        updated.set("desde", next.from);
        updated.set("hasta", next.to);
        return updated;
      },
      // Cambiar el rango no es navegar: no debe llenar el historial de pasos
      // intermedios que el boton Atras tenga que deshacer uno a uno.
      { replace: true },
    );
  }

  // Se fija el rango resuelto en la direccion aunque nadie lo haya tocado: sin
  // esto, la URL de una primera visita no dice nada del periodo que se ve.
  useEffect(() => {
    if (rawFrom === from && rawTo === to) return;
    setRange({ from, to });
    // setRange es estable por identidad de `setParams`; lo que dispara el
    // efecto es que la direccion no coincida con el rango resuelto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawFrom, rawTo, from, to]);

  return { range: { from, to }, setRange };
}
