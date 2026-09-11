import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useState } from "react";

interface DateRangePickerProps {
  since: string;
  until: string;
  onChange: (since: string, until: string) => void;
}

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const WEEKDAY_NAMES = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(str: string): Date | null {
  if (!str) return null;
  const [y, m, d] = str.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDisplayDate(str: string): string {
  const d = parseDate(str);
  if (!d) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatFriendlyDate(str: string): string {
  const d = parseDate(str);
  if (!d) return "";
  const day = d.getDate();
  const monthShort = MONTH_NAMES[d.getMonth()].slice(0, 3).toLowerCase();
  return `${day} ${monthShort}`;
}

function countDays(since: string, until: string): number {
  const s = parseDate(since);
  const u = parseDate(until);
  if (!s || !u) return 1;
  const diffTime = Math.abs(u.getTime() - s.getTime());
  return Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

const PRESETS = [
  {
    label: "Hoy",
    getRange: () => {
      const today = toDateString(new Date());
      return { since: today, until: today };
    },
  },
  {
    label: "7 días",
    getRange: () => {
      const now = new Date();
      const until = toDateString(now);
      const past = new Date(now);
      past.setDate(now.getDate() - 6);
      return { since: toDateString(past), until };
    },
  },
  {
    label: "30 días",
    getRange: () => {
      const now = new Date();
      const until = toDateString(now);
      const past = new Date(now);
      past.setDate(now.getDate() - 29);
      return { since: toDateString(past), until };
    },
  },
  {
    label: "Este mes",
    getRange: () => {
      const now = new Date();
      const until = toDateString(now);
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { since: toDateString(start), until };
    },
  },
];

export function DateRangePicker({ since, until, onChange }: DateRangePickerProps) {
  const initialDate = parseDate(since) ?? parseDate(until) ?? new Date();
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const todayStr = toDateString(new Date());
  const hasSelection = Boolean(since || until);
  const isSingleDay = since && until && since === until;
  const isRange = since && until && since !== until;

  // Estado de selección interactiva: si solo hay 'since' y se está esperando el segundo clic
  const isSelectingRange = Boolean(since && (!until || isSingleDay));

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function handleDateClick(dateStr: string) {
    // Si no hay nada seleccionado, o ya había un rango completo definido:
    // El primer clic fija un día único y permite expandir en el segundo clic
    if (!since || (since && until && since !== until)) {
      onChange(dateStr, dateStr);
      setHoveredDate(null);
      return;
    }

    // Si ya había una fecha inicial (o día único):
    if (since === until) {
      if (dateStr === since) {
        // Clic en el mismo día de nuevo: se mantiene como día único
        return;
      }
      if (dateStr < since) {
        onChange(dateStr, since);
      } else {
        onChange(since, dateStr);
      }
      setHoveredDate(null);
      return;
    }

    // Caso general
    onChange(dateStr, dateStr);
    setHoveredDate(null);
  }

  function clearDates() {
    onChange("", "");
    setHoveredDate(null);
  }

  function applyPreset(preset: (typeof PRESETS)[number]) {
    const range = preset.getRange();
    onChange(range.since, range.until);
    setHoveredDate(null);
    const parsed = parseDate(range.since);
    if (parsed) {
      setViewYear(parsed.getFullYear());
      setViewMonth(parsed.getMonth());
    }
  }

  // Generar cuadrícula de días con inicio de semana en lunes (convención RD / LatAm)
  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay = new Date(viewYear, viewMonth + 1, 0);

  let startOffset = firstDay.getDay() - 1;
  if (startOffset === -1) startOffset = 6;

  const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

  const prevMonthLastDay = new Date(viewYear, viewMonth, 0).getDate();
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(viewYear, viewMonth - 1, prevMonthLastDay - i);
    days.push({
      dateStr: toDateString(d),
      dayNum: prevMonthLastDay - i,
      isCurrentMonth: false,
    });
  }

  for (let i = 1; i <= lastDay.getDate(); i++) {
    const d = new Date(viewYear, viewMonth, i);
    days.push({
      dateStr: toDateString(d),
      dayNum: i,
      isCurrentMonth: true,
    });
  }

  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(viewYear, viewMonth + 1, i);
      days.push({
        dateStr: toDateString(d),
        dayNum: i,
        isCurrentMonth: false,
      });
    }
  }

  // Resumen textual amigable
  let summaryText = "Cualquier fecha";
  let hintText = "Haz clic en un día o selecciona dos para definir un período.";

  if (isSingleDay) {
    summaryText = formatDisplayDate(since);
    hintText = `${formatFriendlyDate(since)} · Haz clic en otra fecha para crear un rango.`;
  } else if (isRange) {
    const daysCount = countDays(since, until);
    summaryText = `${formatDisplayDate(since)} – ${formatDisplayDate(until)}`;
    hintText = `${formatFriendlyDate(since)} al ${formatFriendlyDate(until)} (${daysCount} días).`;
  } else if (since && !until) {
    summaryText = `Desde ${formatDisplayDate(since)}`;
    hintText = `Desde ${formatFriendlyDate(since)} · Elige la fecha final o aplica.`;
  }

  return (
    <div className="flex flex-col gap-2.5 select-none">
      {/* Cabecera de período y estado de selección */}
      <div className="flex items-center justify-between">
        <span className="font-heading text-[10.5px] font-bold uppercase tracking-wider text-zinc-400">
          Período
        </span>

        {hasSelection ? (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-red-200/90 bg-red-50/80 px-2 py-0.5 text-[11px] font-semibold text-brand-red shadow-2xs">
            <CalendarIcon className="h-3 w-3 shrink-0 text-brand-red" />
            <span className="tabular-nums">{summaryText}</span>
            <button
              type="button"
              onClick={clearDates}
              aria-label="Quitar filtro de fecha"
              title="Quitar filtro de fecha"
              className="ml-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded text-brand-red hover:bg-red-200/50 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ) : (
          <span className="text-[11px] font-medium text-zinc-400">Cualquier fecha</span>
        )}
      </div>

      {/* Accesos rápidos de un solo clic */}
      <div className="grid grid-cols-4 gap-1.5">
        {PRESETS.map((preset) => {
          const range = preset.getRange();
          const isSelected = since === range.since && until === range.until;
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyPreset(preset)}
              className={`h-7.5 rounded-lg text-[11.5px] font-medium transition-all outline-none select-none cursor-pointer active:scale-[0.98] shadow-2xs ${
                isSelected
                  ? "border border-zinc-300 bg-zinc-100 font-semibold text-zinc-900"
                  : "border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Calendario interactivo Plastifar */}
      <div className="rounded-lg border border-zinc-200/90 bg-white p-2.5 shadow-2xs">
        {/* Navegación de mes */}
        <div className="mb-2 flex items-center justify-between">
          <span className="font-heading text-[12px] font-bold tracking-tight text-zinc-900 capitalize">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={prevMonth}
              aria-label="Mes anterior"
              className="flex h-6.5 w-6.5 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 shadow-2xs outline-none transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-red/20 cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={nextMonth}
              aria-label="Mes siguiente"
              className="flex h-6.5 w-6.5 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 shadow-2xs outline-none transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-red/20 cursor-pointer"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Encabezados de días */}
        <div className="mb-1 grid grid-cols-7 text-center">
          {WEEKDAY_NAMES.map((name) => (
            <span
              key={name}
              className="font-heading text-[10px] font-semibold uppercase tracking-wider text-zinc-400 py-0.5"
            >
              {name}
            </span>
          ))}
        </div>

        {/* Cuadrícula de días */}
        <div
          className="grid grid-cols-7 gap-y-0.5 text-center"
          onMouseLeave={() => setHoveredDate(null)}
        >
          {days.map(({ dateStr, dayNum, isCurrentMonth }) => {
            const isStart = dateStr === since;
            const isEnd = dateStr === until;
            const inSelectedRange = since && until && dateStr > since && dateStr < until;
            const isToday = dateStr === todayStr;

            // Previsualización interactiva al pasar el ratón mientras se define el rango
            const inHoverRange =
              isSelectingRange &&
              hoveredDate &&
              ((hoveredDate > since && dateStr > since && dateStr <= hoveredDate) ||
                (hoveredDate < since && dateStr >= hoveredDate && dateStr < since));

            let dayClass = "";
            if (isStart && isEnd) {
              dayClass =
                "rounded-md bg-brand-red text-white font-semibold shadow-2xs";
            } else if (isStart) {
              dayClass = until
                ? "rounded-l-md rounded-r-none bg-brand-red text-white font-semibold shadow-2xs"
                : "rounded-md bg-brand-red text-white font-semibold shadow-2xs";
            } else if (isEnd) {
              dayClass = since
                ? "rounded-r-md rounded-l-none bg-brand-red text-white font-semibold shadow-2xs"
                : "rounded-md bg-brand-red text-white font-semibold shadow-2xs";
            } else if (inSelectedRange) {
              dayClass = "rounded-none bg-red-50 font-medium text-brand-red";
            } else if (inHoverRange) {
              dayClass = "rounded-none bg-red-50/50 text-brand-red";
            } else if (isToday) {
              dayClass = "rounded-md font-bold text-brand-red bg-red-50/70 ring-1 ring-red-200/90";
            } else if (!isCurrentMonth) {
              dayClass = "text-zinc-300 hover:text-zinc-500 hover:bg-zinc-50 rounded-md";
            } else {
              dayClass = "text-zinc-700 font-medium hover:bg-zinc-100 hover:text-zinc-900 rounded-md";
            }

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => handleDateClick(dateStr)}
                onMouseEnter={() => {
                  if (isSelectingRange) setHoveredDate(dateStr);
                }}
                aria-label={dateStr}
                className={`flex h-7 w-full items-center justify-center text-[11px] tabular-nums outline-none transition-colors cursor-pointer select-none active:scale-95 ${dayClass}`}
              >
                {dayNum}
              </button>
            );
          })}
        </div>

        {/* Mensaje de guía intuitivo */}
        <p className="mt-2 border-t border-zinc-100 pt-2 text-center text-[10.5px] font-medium text-zinc-400">
          {hintText}
        </p>
      </div>
    </div>
  );
}
